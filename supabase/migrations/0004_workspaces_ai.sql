-- 0004: identidade propria dos Workspaces + auditoria de IA.
--
-- O schema ja nascia multi-tenant (todo registro tem workspace_id desde
-- 0001). O que falta e o Workspace ter identidade e configuracao proprias,
-- para que Eisen Haus / Mari Calcados possam existir sem refatoracao.

-- slug: identificador legivel, base da futura resolucao por rota/subdominio
-- (/w/eisen-haus ou eisen-haus.gabios.app). settings: configuracoes isoladas
-- por workspace (tom de voz, provedor de IA preferido, integracoes).
alter table workspaces add column if not exists slug text;
alter table workspaces add column if not exists settings jsonb not null default '{}';

update workspaces set slug = 'gabriela'
  where slug is null and id = '00000000-0000-0000-0000-000000000001';
update workspaces set slug = 'workspace-' || left(id::text, 8) where slug is null;

alter table workspaces alter column slug set not null;
create unique index if not exists workspaces_slug_key on workspaces (slug);

-- Log de toda chamada de IA: auditoria, custo por workspace, e materia-prima
-- do Learned Brain (o que foi gerado, com que contexto, e o que deu certo).
create table if not exists ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_id uuid references contents(id) on delete set null,
  kind text not null,
  provider text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ai_generations_workspace_idx
  on ai_generations (workspace_id, created_at desc);
