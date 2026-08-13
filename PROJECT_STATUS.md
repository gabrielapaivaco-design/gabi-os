# Project Status — Gabi OS

Snapshot do estado real do projeto. Diferente do CHANGELOG (histórico por sprint)
e do TODO (lista de tarefas), este documento descreve **o que existe e funciona
agora**, para qualquer pessoa (ou IA) retomar o contexto sem precisar ler todo
o histórico.

**Última atualização:** Arquitetura de Workspaces (slug, settings, serviço,
resolução por cookie) + Cérebros + Diretor de Conteúdo com IA real da Anthropic,
atrás de uma camada agnóstica de provedor. Desenvolvimento contínuo em modo
CTO/Lead Engineer (2026-08-05).

A migration `0004_workspaces_ai.sql` foi rodada e a `ANTHROPIC_API_KEY` está
configurada: o Diretor de Conteúdo gera roteiro, legenda, ângulos e análise
contra a API real, com cada chamada auditada em `ai_generations`.

**Modo de trabalho mudou**: a partir daqui não há mais aprovação por sprint.
O usuário pediu desenvolvimento contínuo até o MVP completo, parando só para
decisões estratégicas que dependam exclusivamente dele (ver "Decisões
pendentes" abaixo) ou ao concluir tudo.

## Resumo

| Etapa | Escopo | Status |
| --- | --- | --- |
| Ambiente | Next.js + TS + Tailwind + ESLint/Prettier + shadcn/ui + Supabase | Concluído |
| Sprint 1 | Fundação: schema do banco, clientes Supabase, barramento de eventos, layout, tela Hoje | Concluído |
| Sprint 2 | Momentos: captura sem fricção, feed cronológico, evento `momento.criado`, persistência | Concluído, aprovado |
| Sprint 3 | Pipeline: Kanban com drag-and-drop, cards de conteúdo, integração com Momentos | Concluído, aprovado |
| Infra | Projeto Supabase real conectado, migrations rodadas, persistência validada de ponta a ponta | Concluído |
| Pipeline completo | Editar/excluir card, painel lateral, auto-refresh, tratamento de erros | Concluído |
| Demais módulos do MVP | Ver roadmap em [TODO.md](TODO.md) | Em desenvolvimento contínuo |

## Rotas

| Rota | Estado | Descrição |
| --- | --- | --- |
| `/` (Hoje) | Implementada | Briefing com dados reais, metas do trimestre (criar/editar/excluir/+1) e filas de ação (Gravar, Editar, Postar) linkando direto ao card; volta ao onboarding honesto se ainda não há nada registrado |
| `/momentos` | Implementada | Captura sem fricção + feed cronológico + "Transformar em Conteúdo"; leitura/escrita reais no Supabase, degradação honesta se indisponível |
| `/pipeline` | Implementada | Kanban com 7 colunas: criar, editar, excluir, mover, salvar, pesquisar (título/Momento) e filtrar (pilar). Painel lateral com todos os campos + data de planejamento. Aceita `?open=<id>` para abrir um card direto |
| `/calendario` | Implementada | Grade mensal, navegação entre meses, painel "Sem data", agendamento por drag-and-drop (grava `planned_at`); marcadores de datas comemorativas após migration 0003 |
| `/planejamento` | Implementada (sem IA) | Monta o cenário real do Diretor de Conteúdo a partir do banco e mostra quais fontes já têm dados. Geração automática ainda não ligada. Acessível pelo botão no Calendário (nav lateral congelada em 6 itens) |
| `/cerebros` | Implementada | Editor dos três Cérebros (Brand, Business, Learned) como seções livres título → texto, isolados por workspace. Alimenta o contexto do Diretor de Conteúdo |
| `/config` | Implementada | Workspace ativo (nome, slug, id), total de workspaces, provedor e status da IA, e a lista do que cada workspace isola |
| `/metricas` | **Não implementada** | Só existe o item de navegação na sidebar; acessar a rota gera 404 |
| `/biblioteca` | **Não implementada** | Idem |

## Arquitetura implementada

- **Núcleo orientado a eventos** (`src/lib/events/bus.ts`): toda ação relevante
  emite um evento imutável, persistido em `events` antes de disparar handlers.
  Falha de handler nunca derruba a ação principal (best-effort, testado).
  Em uso ativo: `momento.criado`, `conteudo.criado`, `conteudo.movido`
  (emitido só quando o status de origem muda, não em reordenação simples),
  `conteudo.editado`, `conteudo.arquivado`. Os demais tipos
  (`conteudo.agendado`, `conteudo.publicado`, `metrica.recebida`,
  `previsao.registrada`) seguem declarados no tipo `EventType` sem emissor
  ainda — ligar quando a funcionalidade correspondente existir.
- **Exclusão é sempre arquivamento**: `archived = true`, nunca delete físico.
  Histórico preservado para o barramento de eventos e o futuro DNA do
  Conteúdo. Todo `SELECT` de listagem já filtra `archived = false`.
- **Erros de Server Action retornados, não lançados, onde há UI inline para
  mostrá-los**: `updateContentAction`/`archiveContentAction` retornam
  `{ok: true} | {ok: false, error: string}` em vez de `throw`, porque o
  Next.js redige a mensagem de erros não tratados de Server Actions antes de
  chegar ao cliente. `createContentAction`/`reorderColumnAction` continuam
  lançando (sem UI inline dedicada) e caem no `error.tsx` da rota.
- **Workspace único, mas arquitetura multi-workspace pronta**: toda tabela já
  nasce com `workspace_id` (schema desde a Sprint 1) e toda query passa por
  `getWorkspaceId()` (`src/lib/workspace/current.ts`) em vez de importar a
  constante `WORKSPACE_ID` diretamente. Essa função hoje **lê o cookie
  `gabios_workspace`** (validando o formato UUID, porque o valor vem do
  cliente) e cai no workspace padrão quando ele não existe — que é sempre,
  porque a UI de troca não existe. O caminho de múltiplos workspaces está
  escrito; habilitá-lo é escrever o cookie. `lib/workspace/service.ts` fecha o
  ciclo com `getCurrentWorkspace`, `listWorkspaces` e `createWorkspace` (que já
  cria os três Cérebros vazios). Ainda sem autenticação e sem RLS — ver
  "Limitações conhecidas", porque é isso que separa a arquitetura pronta de
  multi-workspace de verdade.
- **IA atrás de uma interface agnóstica**: `lib/ai/types.ts` define
  `AiProvider` sem mencionar nenhum fornecedor; `lib/ai/anthropic.ts`
  implementa para Claude; `lib/ai/index.ts` é o registro escolhido por
  `AI_PROVIDER`. O Diretor de Conteúdo (`lib/ai/director/`) conversa só com a
  interface, então somar OpenAI ou Gemini é escrever um arquivo e registrá-lo.
  `isAiConfigured()` deixa a UI dizer a verdade sem tentar gerar.
- **Contexto de IA é montado, nunca inventado**: `lib/ai/director/context.ts`
  agrega Cérebros, pilar, objetivo, Momento de origem e conteúdos publicados —
  e **omite** o que está vazio em vez de mandar "(vazio)", para não induzir o
  modelo a preencher lacunas. Texto gerado preenche os campos do card mas não
  grava sozinho: quem decide o que vai ao banco continua sendo a usuária.
- **Degradação honesta**: qualquer leitura/escrita no Supabase que falhe
  (env não configurado, projeto fora do ar, etc.) mostra um aviso claro em
  vez de quebrar a tela ou inventar dado. Padrão usado na tela Hoje (Sprint 1),
  em `/momentos` (Sprint 2) e em `/pipeline` (Sprint 3) — cada rota com seu
  próprio `error.tsx` para falhas de escrita. Aplicar o mesmo padrão em toda
  tela nova.
- **Identidade visual congelada** (`tailwind.config.ts`): cores, raios e a
  curva de easing "premium" não devem ser alterados sem consultar o Product
  Playbook. Tokens semânticos do shadcn/ui foram adicionados por cima, sem
  tocar nos tokens originais.
- **Server Actions + Client Components mínimos**: páginas são Server
  Components por padrão; interatividade (formulários, atalhos de teclado,
  drag-and-drop) fica isolada em Client Components pequenos (ex.:
  `moment-capture.tsx`, `pipeline-board.tsx`).
- **Ordenação otimista com snapshot restaurável**: o Kanban atualiza a UI
  imediatamente durante o drag e persiste ao soltar; se o drop for inválido
  ou o drag for cancelado, o estado local pré-drag é restaurado em vez de
  ficar dessincronizado do servidor (`src/app/pipeline/pipeline-board.tsx`).

## Banco de dados (Supabase / Postgres)

Schema em `supabase/migrations/0001_init.sql`, seed em `0002_seed.sql`. Tabelas:

| Tabela | Uso atual |
| --- | --- |
| `workspaces` | **Em uso** — 1 registro (Gabriela). `slug` e `settings` chegam na 0004; a leitura cai no schema antigo se ela ainda não rodou |
| `brains` (brand/business/learned) | **Em uso** — editadas em `/cerebros` e lidas como contexto pelo Diretor de Conteúdo |
| `ai_generations` | Auditoria de toda chamada de IA (inclusive falhas), por workspace. Criada na 0004; o log é pulado silenciosamente enquanto ela não roda |
| `pillars` | 9 pilares no seed; sem UI ainda |
| `moments` | **Em uso** — leitura, escrita e exclusão via `/momentos`. Único recurso com delete físico (decisão explícita: matéria-prima, não histórico) |
| `contents` | **Em uso** — leitura/escrita completa via `/pipeline`: `title`, `status`, `sort`, `moment_id`, `format`, `pillar_id`, `objective`, `hook`, `script`, `caption`, `cta`, `archived`. `scenes`, `planned_at`, `published_at` ainda sem UI (aguardam Calendário/Agendamento) |
| `metrics` | Schema pronto; sem integração (Metricool) ainda |
| `content_dna` | Schema pronto; sem uso ainda |
| `predictions` | Schema pronto; sem uso ainda |
| `events` | **Em uso** — log de todo evento emitido pelo barramento |
| `weekly_reviews` | Schema pronto; sem uso ainda |
| `goals` | **Em uso** — metas do trimestre na tela Hoje (criar/editar/excluir/progresso) |
| `commemorative_dates` | **Em uso** — 10 datas globais no seed; marcadores no Calendário e insumo do Planejamento. `workspace_id` nulo = global, preenchido = do workspace |
| `monthly_plans` | Schema pronto (plano + `context_snapshot` para auditoria); aguarda a geração por IA |
| `hooks` | Schema pronto (Banco de Hooks); sem UI ainda |

## Stack e versões

- Next.js `14.2.15` (App Router) + React `18.3.1` + TypeScript `5.6.3`
- Tailwind CSS `3.4.13` + `tailwindcss-animate`
- shadcn/ui (`components.json`, sem componentes gerados ainda — base pronta)
- `@supabase/ssr` `0.5.2` + `@supabase/supabase-js` `2.45.0`
- Framer Motion `11.11.0` (feed de Momentos e overlay do Pipeline)
- `@dnd-kit/core` `6.1.0` + `@dnd-kit/sortable` `8.0.0` + `@dnd-kit/utilities` `3.2.2`
  (drag-and-drop do Pipeline, com suporte a teclado)
- `@anthropic-ai/sdk` `0.115.0` — modelo `claude-opus-5`, pensamento adaptativo,
  saída estruturada por JSON Schema
- ESLint `8.57.1` (`eslint-config-next`) + Prettier `3.3.3`
- Vitest `2.1.3`

## Qualidade

Comandos e resultado na última verificação (Workspaces + IA):

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Limpo |
| `npm run lint` | Sem warnings/erros |
| `npm run test` | 58/58 testes (10 arquivos; novos: `ai-provider`, `director-context`, `brains-service`) |
| `npm run build` | Build de produção ok (10 rotas) |

Testado no navegador **contra o Supabase real**: `/cerebros` grava uma seção do
Brand Brain e ela sobrevive ao reload; `/config` mostra workspace ativo, total
de workspaces e o status honesto da IA; o painel do card exibe a seção do
Diretor com o aviso de chave ausente. Sem erros de console em nenhuma rota.

**O que a validação não cobre:** a chamada real à Anthropic (sem chave neste
ambiente) — ver "Limitações conhecidas".

## Ações pendentes (dependem do usuário)

Nenhuma. As duas que existiam foram concluídas em 2026-08-05:

- ~~Rodar `supabase/migrations/0004_workspaces_ai.sql`~~ — rodada. O workspace
  Gabriela tem `slug = gabriela` e `ai_generations` está gravando.
- ~~Definir `ANTHROPIC_API_KEY`~~ — definida. `/config` mostra
  `PROVEDOR: anthropic / STATUS: conectado`.

O que mais ajuda o sistema agora não é código, é conteúdo: o **Business Brain**
e o **Learned Brain** estão vazios, e o Brand Brain tem uma seção só. O Diretor
só sabe o que os Cérebros contam — cada seção preenchida em `/cerebros` é
contexto real substituindo suposição plausível.

## Decisões pendentes (dependem do usuário)

- **Conteúdo do Product Playbook / AI Manifesto**: continuo sem acesso ao texto
  desses documentos. Onde eles seriam a fonte de verdade, escolhi estruturas
  abertas em vez de inventar um esquema fixo, e essas escolhas merecem revisão:
  - **Cérebros**: modelados como seções livres (título → texto), com títulos
    apenas *sugeridos* ("Voz e tom", "Ofertas", "O que funcionou"). Se o
    Playbook define seções canônicas, elas entram como padrão sem migration —
    o conteúdo é JSONB.
  - **Prompts do Diretor** (`lib/ai/director/prompts.ts`): a voz e as regras
    foram derivadas da própria lógica do produto (Acontecimento → Ideia →
    Conteúdo) e dos comentários já no código. Estão isolados em um arquivo só,
    editável sem tocar em código.
  - **DNA do Conteúdo**: a tabela é lida e enviada ao Diretor como contexto,
    mas nada ainda a *escreve* — falta definir como um padrão é extraído de um
    conteúdo publicado.
  - **Banco de Hooks**: tabela criada na 0003, sem UI e sem uso.

## Limitações conhecidas / dívidas técnicas

- **`AnimatePresence` do Framer Motion não é usado no painel lateral do
  Pipeline**: numa primeira versão, o painel travava montado para sempre ao
  fechar (o estado React chegava a `null` corretamente, mas o componente
  nunca saía do DOM — provável problema de `AnimatePresence` com múltiplos
  `motion.div` irmãos exigindo sinais de conclusão de animação que não
  chegavam). Removido; o painel anima ao abrir mas não desliza para fora ao
  fechar. Reavaliar se for reintroduzir animação de saída em outro lugar.
- **Reordenação não é atômica**: `reorderColumn` faz um `UPDATE` por card via
  `Promise.all` (sem transação/RPC). Se um `UPDATE` falhar no meio, a coluna
  pode ficar com `sort` parcialmente atualizado. Aceitável para uso pessoal
  de baixa concorrência (Product Playbook); revisitar se isso mudar.
- `planned_at`/`published_at`/`scenes` de `contents` ainda sem UI — nenhum é
  setado automaticamente ao mover um card para "Publicado" (decisão
  deliberada; ligar quando Calendário/Agendamento existir).
- Token `muted` do Tailwind não foi remapeado para o par `muted`/`muted-foreground`
  do shadcn/ui, para não quebrar o uso atual — resolver ao introduzir o
  primeiro componente shadcn que precise de `muted-foreground`.
- Warning de console em modo dev ("Cannot update a component (`HotReload`)...")
  ao errar um Server Action dentro de `useTransition` (visto no submit de
  Momento) — ruído conhecido da combinação Server Action + `useTransition` +
  Fast Refresh do Next 14; não aparece em build de produção.
- A geração por IA **foi validada de ponta a ponta** em 2026-08-05 (roteiro e
  análise, com `claude-opus-5`, contra a chave real). O que continua sem
  verificação é o comportamento sob falha da API em produção: `RateLimitError`,
  `APIConnectionError` e recusa do modelo têm tradução escrita e testada por
  unidade, mas nunca foram observados vindos do servidor de verdade.
- Não foi possível confirmar **qual dos dois caminhos** de `anthropic.ts` rodou:
  a chamada com `fallbacks: "default"` + beta `server-side-fallback-2026-07-01`,
  ou o retry sem esses parâmetros. As duas terminam em sucesso e o código não
  distingue as duas no log. Se importar saber, basta registrar isso em
  `ai_generations`.
- **`fallbacks` da Anthropic não pôde ser validado**: o parâmetro reexecuta o
  pedido em outro modelo se os classificadores recusarem. Como não dava para
  testar se a conta tem acesso a esse beta, a implementação repete a chamada
  sem ele quando a API o rejeita — a IA nunca fica fora do ar por causa disso.
- **Sem autenticação/multiusuário, sem RLS**: o workspace atual vem de um cookie
  com fallback para o padrão, mas nada autentica *quem* pode setá-lo, e as
  migrations rodaram sem Row Level Security (a anon key precisa de acesso
  irrestrito enquanto não há sessão de usuário). **Isto é o que separa a
  arquitetura multi-workspace de multi-workspace de verdade** — antes de expor
  à internet ou aceitar um segundo cliente, é preciso autenticação + RLS por
  `workspace_id`.
- Rotas `/metricas` e `/biblioteca` ainda não existem (ver tabela de rotas
  acima) — em desenvolvimento.

## Próximos passos

Roadmap completo em [TODO.md](TODO.md). Desenvolvimento contínuo — próximos
módulos: Biblioteca, Métricas (entrada manual), Banco de Hooks, escrita do DNA
do Conteúdo a partir de conteúdos publicados, e a geração do plano mensal pelo
Diretor (o Motor de Contexto de `/planejamento` já monta o cenário; falta ligá-lo
ao provedor de IA, que agora existe).
