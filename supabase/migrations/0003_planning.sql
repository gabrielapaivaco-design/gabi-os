-- Datas comemorativas: insumo do Planejamento Automatico do Mes e marcadores
-- visuais no Calendario. `workspace_id` nulo = data global (Natal, Dia das
-- Maes); preenchido = data propria daquele workspace (aniversario da empresa,
-- lancamento de colecao). Assim um workspace novo (Eisen Haus, Mari Calcados)
-- ja nasce com as datas globais sem precisar duplicar nada.
create table commemorative_dates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  -- Quantos dias antes da data faz sentido comecar a produzir sobre ela.
  lead_days int not null default 7,
  notes text,
  created_at timestamptz not null default now()
);
create index on commemorative_dates (workspace_id, month, day);

-- Planos mensais gerados pelo Diretor de Conteudo. O plano fica em `plan`
-- (JSONB) e o `context_snapshot` guarda exatamente o cenario usado para
-- gera-lo (Momentos, cerebros, DNA, objetivos, metricas, historico, pilares,
-- datas comemorativas) — sem isso e impossivel auditar depois por que a IA
-- sugeriu o que sugeriu. `approved` separa rascunho de plano aceito.
create table monthly_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  plan jsonb not null default '[]',
  context_snapshot jsonb not null default '{}',
  approved boolean not null default false,
  generated_at timestamptz not null default now(),
  unique (workspace_id, year, month)
);

-- Banco de Hooks: ganchos reutilizaveis, com desempenho observado ao longo do
-- tempo. `times_used`/`avg_performance` sao alimentados pela analise de
-- metricas quando essa etapa existir.
create table hooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  text text not null,
  category text,
  times_used int not null default 0,
  avg_performance numeric,
  created_at timestamptz not null default now()
);
create index on hooks (workspace_id, category);

-- Datas comemorativas globais (workspace_id nulo) — base minima do mercado
-- brasileiro; a usuaria pode adicionar as proprias depois.
insert into commemorative_dates (workspace_id, name, month, day, lead_days) values
  (null, 'Ano Novo', 1, 1, 10),
  (null, 'Carnaval (variavel)', 2, 15, 15),
  (null, 'Dia da Mulher', 3, 8, 10),
  (null, 'Dia das Maes', 5, 11, 21),
  (null, 'Dia dos Namorados', 6, 12, 21),
  (null, 'Dia dos Pais', 8, 10, 21),
  (null, 'Dia do Cliente', 9, 15, 10),
  (null, 'Dia das Criancas', 10, 12, 14),
  (null, 'Black Friday', 11, 28, 30),
  (null, 'Natal', 12, 25, 30);
