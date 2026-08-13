-- Gabi OS — renomear e excluir workspace.
--
-- As duas operacoes passam por funcao em vez de UPDATE/DELETE direto porque
-- carregam regras que nao podem viver so na interface: um nome errado tem que
-- gerar um identificador valido e livre, e ninguem pode apagar o ultimo
-- workspace que possui — isso deixaria a conta sem nenhum lugar para trabalhar.
--
-- Excluir workspace e destrutivo de verdade: o `on delete cascade` do schema
-- leva Momentos, Conteudos, Cerebros, Objetivos, Metricas, historico de IA e
-- log de eventos junto. Nao ha arquivamento aqui, e nao ha desfazer.

-- ============================================================
-- Renomear
-- ============================================================
-- Delimitadores nomeados ($rename_ws$) em vez de $$: com duas funcoes no mesmo
-- arquivo, um parser que divide o script por ";" pode emparelhar o $$ que
-- fecha a primeira com o que abre a segunda. O SQL Editor do Supabase faz
-- exatamente isso e reclama de "unterminated dollar-quoted string".
create or replace function public.rename_workspace(p_id uuid, p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $rename_ws$
declare
  ws public.workspaces;
begin
  if not public.is_workspace_member(p_id) then
    raise exception 'Voce nao tem acesso a esse workspace.';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'O nome do workspace e obrigatorio.';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9-]+$' then
    raise exception 'O identificador deve ter apenas letras minusculas, numeros e hifens.';
  end if;

  -- Livre para outro workspace, mas pode ser o proprio (renomear "Mari Loja"
  -- para "Mari Loja " nao pode falhar por colidir consigo mesmo).
  if exists (select 1 from public.workspaces w where w.slug = p_slug and w.id <> p_id) then
    raise exception 'Ja existe outro workspace com o identificador "%".', p_slug;
  end if;

  update public.workspaces
     set name = trim(p_name), slug = p_slug
   where id = p_id
  returning * into ws;

  return ws;
end;
$rename_ws$;

revoke all on function public.rename_workspace(uuid, text, text) from public;
grant execute on function public.rename_workspace(uuid, text, text) to authenticated;

-- ============================================================
-- Excluir
-- ============================================================
create or replace function public.delete_workspace(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $delete_ws$
declare
  restantes int;
begin
  if not public.is_workspace_member(p_id) then
    raise exception 'Voce nao tem acesso a esse workspace.';
  end if;

  -- A regra vive aqui, e nao na tela, porque uma conta sem nenhum workspace
  -- nao tem onde escrever nada. Melhor recusar do que deixar a pessoa se
  -- trancar para fora do proprio sistema.
  select count(*) into restantes
    from public.workspace_members m
   where m.user_id = auth.uid();

  if restantes <= 1 then
    raise exception 'Esse e o seu unico workspace. Crie outro antes de excluir este.';
  end if;

  delete from public.workspaces where id = p_id;
end;
$delete_ws$;

revoke all on function public.delete_workspace(uuid) from public;
grant execute on function public.delete_workspace(uuid) to authenticated;
