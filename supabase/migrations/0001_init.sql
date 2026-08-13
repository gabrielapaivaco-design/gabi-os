-- Gabi OS — esquema inicial do MVP
-- Toda tabela nasce com workspace_id (preparacao multi-tenant; sem multiusuario no codigo por ora).

create extension if not exists "pgcrypto";

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Os tres cerebros: um documento por workspace, secoes em JSONB para edicao livre.
create table brains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('brand','business','learned')),
  content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (workspace_id, kind)
);

create table pillars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text not null default 'gray',
  sort int not null default 0
);

-- Momentos: materia-prima. Captura sem friccao; classificacao vem depois.
create table moments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  body text not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create type content_status as enum
  ('ideia','roteiro','gravar','editar','agendar','publicado','analisar');

create table contents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  moment_id uuid references moments(id) on delete set null,
  title text not null,
  format text,
  status content_status not null default 'ideia',
  pillar_id uuid references pillars(id) on delete set null,
  objective text check (objective in ('autoridade','venda','conexao','crescimento')),
  hook text, script text, caption text, cta text,
  scenes jsonb not null default '[]',
  planned_at timestamptz, published_at timestamptz,
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on contents (workspace_id, status) where archived = false;

create table metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_id uuid references contents(id) on delete cascade,
  reach int, retention numeric, saves int, shares int,
  comments int, followers_gained int,
  collected_at timestamptz not null default now()
);

create table content_dna (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_id uuid not null references contents(id) on delete cascade,
  theme text, emotion text, hook_type text, format text,
  cta text, objective text, pillar text, result jsonb,
  created_at timestamptz not null default now(),
  unique (content_id)
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_id uuid not null references contents(id) on delete cascade,
  predicted jsonb not null,
  created_at timestamptz not null default now()
);

-- Log de eventos: espinha dorsal do nucleo orientado a eventos.
create table events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on events (workspace_id, type, created_at desc);

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  week_start date not null,
  answers jsonb not null default '{}',
  plan jsonb not null default '[]',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  target numeric, progress numeric not null default 0,
  quarter text, metric_key text,
  created_at timestamptz not null default now()
);
