-- Gabi OS — fundacao do ciclo Conteudo -> Publicacao -> Post externo -> Metrica.
--
-- O ciclo do sistema estava rompido num ponto so: nada registrava que um
-- conteudo foi publicado, e por isso nenhuma metrica podia ser ligada a ele.
-- Esta migration fecha esse elo e deixa a origem dos dados trocavel: hoje as
-- linhas entram a mao (ou por script), depois podem vir de uma API sem que a
-- forma de armazenar, ou a leitura pelo Diretor, mude.
--
-- Nada aqui e especifico de Instagram. `platform` e texto justamente para que
-- TikTok, YouTube ou LinkedIn entrem sem nova migration.

-- ============================================================
-- 1. Identidade externa do Conteudo
--
-- `published_at` ja existia desde a 0001 e nunca foi escrito. O que faltava
-- era saber ONDE o conteudo foi publicado e QUAL post ele virou.
-- ============================================================
alter table contents add column if not exists platform text;
alter table contents add column if not exists external_id text;
alter table contents add column if not exists external_url text;

-- Um conteudo nao pode reivindicar o mesmo post que outro ja reivindicou.
-- Parcial porque a esmagadora maioria dos conteudos nunca tera identidade
-- externa (rascunho, ideia, arquivado) e nulos nao devem colidir entre si.
create unique index if not exists contents_external_key
  on contents (workspace_id, platform, external_id)
  where platform is not null and external_id is not null;

create index if not exists contents_published_idx
  on contents (workspace_id, published_at desc)
  where published_at is not null;

-- ============================================================
-- 2. Posts que existem fora do sistema
--
-- E o LADO B da conciliacao: o que realmente foi publicado na plataforma,
-- importado como esta, antes de qualquer interpretacao. `content_id` nulo
-- significa "ainda nao sei a qual conteudo do Gabi OS isso corresponde".
--
-- Guardar o post separado do Conteudo e deliberado: existe post que nunca
-- passou pelo sistema (publicado direto no celular), e ele tambem tem metrica
-- que vale aprender. Forcar tudo a existir como Conteudo primeiro perderia
-- esse dado.
-- ============================================================
create table if not exists external_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null,
  external_id text not null,
  url text,
  caption text,
  media_type text,
  published_at timestamptz,
  -- O vinculo da conciliacao. `set null` e nao `cascade`: apagar um Conteudo
  -- nao deve apagar a prova de que o post existiu.
  content_id uuid references contents(id) on delete set null,
  -- De onde a linha veio. 'manual' hoje; 'windsor' quando houver API.
  source text not null default 'manual',
  -- A resposta crua da origem, para nao perder campo que hoje nao usamos.
  raw jsonb not null default '{}',
  imported_at timestamptz not null default now(),
  unique (workspace_id, platform, external_id)
);

create index if not exists external_posts_workspace_idx
  on external_posts (workspace_id, published_at desc);
create index if not exists external_posts_content_idx
  on external_posts (workspace_id, content_id);

-- ============================================================
-- 3. Metricas por conteudo
--
-- A tabela ja existia com reach/saves/shares/comments/followers_gained e
-- `content_id` nulavel. Faltava a identidade externa e tres numeros que as
-- plataformas entregam.
--
-- `content_id` continua nulavel de proposito: uma metrica pode chegar antes da
-- conciliacao (ligada so ao post) ou ser resumo de conta (sem post nenhum).
-- ============================================================
alter table metrics add column if not exists platform text;
alter table metrics add column if not exists external_media_id text;
alter table metrics add column if not exists impressions int;
alter table metrics add column if not exists views int;
alter table metrics add column if not exists likes int;
alter table metrics add column if not exists source text not null default 'manual';

-- Busca por midia externa. NAO e unico de proposito: varias coletas ao longo do
-- tempo para o mesmo post sao desejaveis — e assim que se ve o alcance crescer.
--
-- A primeira versao tentava um indice unico por dia usando `(collected_at::date)`.
-- Postgres recusa: converter timestamptz para date depende do fuso da sessao,
-- entao a expressao nao e IMMUTABLE e nao pode entrar em indice. A protecao
-- contra reimportar o mesmo dia duas vezes ficou no codigo (importExternalPosts
-- apaga as coletas do dia antes de gravar), onde da para escrever a regra sem
-- depender do fuso do servidor.
create index if not exists metrics_external_idx
  on metrics (workspace_id, platform, external_media_id, collected_at desc)
  where platform is not null and external_media_id is not null;

create index if not exists metrics_content_idx
  on metrics (workspace_id, content_id, collected_at desc)
  where content_id is not null;

-- ============================================================
-- 4. RLS na tabela nova
--
-- Mesma regra das demais: so membro do workspace ve e escreve. A 0005 aplicou
-- isso em laco sobre uma lista fixa de tabelas, entao uma tabela nova precisa
-- da sua propria policy — sem isso ela nasceria aberta.
-- ============================================================
alter table external_posts enable row level security;

drop policy if exists workspace_isolation on external_posts;
create policy workspace_isolation on external_posts
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
