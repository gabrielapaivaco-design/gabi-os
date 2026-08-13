-- Gabi OS — autenticacao real e isolamento imposto pelo banco.
--
-- Ate aqui `workspace_id` era uma convencao do codigo: toda query filtrava por
-- ele porque os services foram escritos assim. Isso organiza os dados, mas nao
-- isola nada — qualquer chamada que esquecesse o filtro veria tudo, e um
-- cookie editado a mao trocaria de workspace sem pedir licenca.
--
-- Esta migration move a fronteira para o banco: RLS decide o que cada usuario
-- enxerga, e o app passa a ser incapaz de vazar dado entre workspaces mesmo se
-- o codigo errar.
--
-- ATENCAO: depois de rodar isto, o app so mostra dados para usuarios
-- autenticados. Os workspaces que ja existem ficam sem dono ate a primeira
-- conta ser criada — e essa primeira conta os adota automaticamente.

-- ============================================================
-- 1. Quem pertence a qual workspace
-- ============================================================
create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members (user_id);

-- ============================================================
-- 2. Funcao de pertencimento
--
-- `security definer` nao e conveniencia: a policy de `moments` precisa
-- consultar `workspace_members`, que tambem tem RLS. Sem definer, essa consulta
-- dispararia a policy de `workspace_members`, que consultaria `workspace_members`
-- de novo — recursao infinita. O definer le a tabela ignorando RLS e corta o ciclo.
-- ============================================================
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- ============================================================
-- 3. Criar workspace
--
-- Passa por funcao, nao por INSERT direto, porque criar um workspace sao tres
-- escritas que precisam acontecer juntas: o workspace, o vinculo com quem
-- criou e os tres Cerebros vazios. Se o vinculo falhasse depois do insert, o
-- workspace nasceria orfao — invisivel para todo mundo, inclusive para quem
-- acabou de cria-lo, e impossivel de apagar pela interface.
-- ============================================================
create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  ws public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'E preciso estar autenticado para criar um workspace.';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'O nome do workspace e obrigatorio.';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9-]+$' then
    raise exception 'O identificador deve ter apenas letras minusculas, numeros e hifens.';
  end if;

  if exists (select 1 from public.workspaces w where w.slug = p_slug) then
    raise exception 'Ja existe um workspace com o identificador "%".', p_slug;
  end if;

  insert into public.workspaces (name, slug, settings)
  values (trim(p_name), p_slug, '{}'::jsonb)
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws.id, auth.uid(), 'owner');

  -- Um workspace sem Cerebros nao e utilizavel: o Diretor de Conteudo nao teria
  -- onde ler o contexto nem onde escrever o que aprende.
  insert into public.brains (workspace_id, kind, content)
  values (ws.id, 'brand', '{}'::jsonb),
         (ws.id, 'business', '{}'::jsonb),
         (ws.id, 'learned', '{}'::jsonb);

  return ws;
end;
$$;

revoke all on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;

-- ============================================================
-- 4. Adocao dos workspaces que existiam antes da autenticacao
--
-- Roda uma unica vez na vida do banco: a condicao e "nao existe nenhum vinculo
-- ainda". Depois que a primeira conta adota os dados, qualquer conta nova cai
-- no `return 0` e comeca vazia. Sem isso, ligar RLS faria os dados da Gabriela
-- sumirem sem nenhuma forma de recupera-los pela interface.
-- ============================================================
create or replace function public.claim_orphan_workspaces()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed int;
begin
  if auth.uid() is null then
    return 0;
  end if;

  if exists (select 1 from public.workspace_members) then
    return 0;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  select w.id, auth.uid(), 'owner'
  from public.workspaces w
  on conflict do nothing;

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.claim_orphan_workspaces() from public;
grant execute on function public.claim_orphan_workspaces() to authenticated;

-- ============================================================
-- 5. RLS
-- ============================================================

-- Workspaces: visiveis apenas para quem e membro. Nao ha policy de INSERT de
-- proposito — criacao so pela funcao acima, que garante o vinculo junto.
alter table workspaces enable row level security;

drop policy if exists workspaces_read on workspaces;
create policy workspaces_read on workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

drop policy if exists workspaces_update on workspaces;
create policy workspaces_update on workspaces
  for update to authenticated
  using (public.is_workspace_member(id))
  with check (public.is_workspace_member(id));

-- Vinculos: cada um enxerga apenas os proprios.
alter table workspace_members enable row level security;

drop policy if exists workspace_members_read_own on workspace_members;
create policy workspace_members_read_own on workspace_members
  for select to authenticated
  using (user_id = auth.uid());

-- Tabelas de dados: mesma regra para todas, aplicada em laco para que nenhuma
-- fique de fora por esquecimento — uma tabela sem policy e exatamente o buraco
-- que esta migration existe para fechar.
do $$
declare
  t text;
begin
  foreach t in array array[
    'brains', 'pillars', 'moments', 'contents', 'metrics', 'content_dna',
    'predictions', 'events', 'weekly_reviews', 'goals', 'monthly_plans',
    'hooks', 'ai_generations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists workspace_isolation on public.%I', t);
    execute format(
      'create policy workspace_isolation on public.%I
         for all to authenticated
         using (public.is_workspace_member(workspace_id))
         with check (public.is_workspace_member(workspace_id))', t);
  end loop;
end $$;

-- Datas comemorativas sao a excecao: `workspace_id` nulo significa data global
-- (Natal, Dia das Maes), que todo workspace le. Escrever, porem, so no proprio
-- workspace — ninguem edita o calendario global pela interface.
alter table commemorative_dates enable row level security;

drop policy if exists commemorative_dates_read on commemorative_dates;
create policy commemorative_dates_read on commemorative_dates
  for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists commemorative_dates_write on commemorative_dates;
create policy commemorative_dates_write on commemorative_dates
  for all to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id));
