# TODO

A partir daqui o desenvolvimento e continuo (modo CTO/Lead Engineer), sem
aprovacao por sprint — ver PROJECT_STATUS.md para o estado exato de cada
modulo e as decisoes que dependem do usuario.

## AÇÃO NECESSARIA
- [ ] Desativar **Confirm email** no Supabase (Authentication > Sign In /
      Providers > Email). Nao bloqueia nada hoje — a conta atual ja esta
      confirmada —, mas a proxima conta criada travaria.

O ganho agora e de conteudo, nao de codigo:
- [ ] Preencher o Business Brain em `/cerebros` (hoje vazio)
- [ ] Preencher o Learned Brain em `/cerebros` (hoje vazio)
- [ ] Ampliar o Brand Brain (hoje tem 1 secao)

## Planejamento automatico do mes (CONCLUIDA)
- [x] Diretor gera o cronograma lendo metricas, Cerebros, Momentos e horarios
- [x] Proposta revisavel; so vira card depois de aprovada
- [x] `scripts/importar-metricas.mjs` traz o desempenho do Metricool
- [ ] O app nao busca o Metricool sozinho — hoje o assistente puxa e roda o
      script. Alternativa gratuita: Graph API do Meta (token expira em 60 dias).
- [ ] Metricas por post (hoje so o resumo do mes entra)
- [x] Conversar sobre o plano e refazer o cronograma pela conversa
- [ ] Editar um item solto direto na lista (hoje se ajusta conversando)

## Diretor conversacional + historico (CONCLUIDA)
- [x] Conversa multi-turno com o Diretor, com contexto do workspace
- [x] "Usar como roteiro" leva a resposta para o card, sem gravar
- [x] `/historico`: ver, excluir registro e limpar tudo
- [ ] Salvar licoes da conversa no Learned Brain ("nunca escreva assim")
- [ ] Conversar tambem sobre legenda/CTA, nao so roteiro

## Autenticacao + multi-workspace real (CONCLUIDA)
- [x] Migration 0005: `workspace_members`, RLS em todas as tabelas, RPCs
- [x] `middleware.ts`: renova sessao, barra anonimo, corrige cookie de workspace
- [x] `/login`: entrar e criar conta (e-mail + senha)
- [x] Primeira conta adota os workspaces criados antes da autenticacao
- [x] Seletor de workspace no topo da sidebar + criar marca pela interface
- [x] Sair, com e-mail da conta visivel na sidebar
- [x] Isolamento provado por teste de invasao com segunda conta (22/22)
- [x] Excluir workspace pela interface, com confirmacao por digitacao
- [x] Renomear workspace pela interface
- [ ] Papeis `editor` e `viewer` existem no schema mas nao mudam nada ainda:
      toda policy so pergunta "e membro?". Convidar alguem hoje daria acesso
      total ao workspace.

## Plataforma: Workspaces + IA real (CONCLUIDA)
- [x] Migration 0004: `workspaces.slug`, `workspaces.settings`, `ai_generations`
- [x] `lib/workspace/service.ts` (getCurrent/list/createWorkspace)
- [x] Resolucao por cookie preparada em `getWorkspaceId()` (sem UI de troca)
- [x] `/cerebros`: Brand, Business e Learned Brain por workspace
- [x] `/config`: identidade do workspace, status da IA, isolamento explicito
- [x] Camada agnostica de provedor de IA (`lib/ai/types.ts` + registro)
- [x] Implementacao Anthropic (Claude Opus 5, saida estruturada)
- [x] Diretor de Conteudo: roteiro, legenda, outros angulos, analise
- [x] "Gerar com IA" no painel do card, sem gravar sozinho
- [x] Migration 0004 rodada no Supabase real
- [x] Geracao confirmada ponta a ponta com chave real (roteiro + analise)

## MVP utilizavel (CONCLUIDA)
- [x] Dashboard Hoje: metas do trimestre + filas Gravar/Editar/Postar
- [x] Pipeline: criar, editar, excluir, mover, salvar, pesquisar, filtrar
- [x] Calendario mensal com agendamento (drag-and-drop + campo de data)
- [x] Arquitetura do Planejamento Automatico (Motor de Contexto + tela honesta)
- [x] Migration 0003: commemorative_dates, monthly_plans, hooks

## Arquitetura multi-workspace + Dashboard Hoje (CONCLUIDA)
- [x] `getWorkspaceId()` centraliza a resolucao do workspace atual
- [x] Dashboard Hoje com dados reais (Momentos + resumo do Pipeline)

## Infra + Pipeline completo (CONCLUIDA)
- [x] Projeto Supabase real configurado (.env.local, migrations, sem RLS)
- [x] Persistencia real validada (Momentos, transformar em Conteudo, Pipeline)
- [x] Editar qualquer campo do card (painel lateral)
- [x] Excluir card com confirmacao (arquivamento, nunca delete fisico)
- [x] Atualizacao automatica da interface apos qualquer alteracao
- [x] Validacao de erros (mensagens reais no painel, nao redigidas)
- [x] Indicador de pilar no card + fix do link Momento/Conteudo arquivado

## Sprint 3 — Pipeline (CONCLUIDA)
- [x] Kanban com os 7 status do Product Playbook
- [x] Mover conteudos entre status (drag-and-drop com @dnd-kit)
- [x] Estrutura dos cards de conteudo
- [x] Integracao com Momentos (transformar em Conteudo + trecho no card)

## Sprint 2 — Momentos (CONCLUIDA)
- [x] Captura de Momento (campo sem friccao + atalho)
- [x] Excluir Momento (lixeira + confirmacao + aviso se ja virou Conteudo)
- [x] Feed cronologico estilo diario
- [x] Evento `momento.criado`
- [x] Persistencia e leitura via Supabase

## Ambiente — Ferramentas de qualidade (CONCLUIDA)
- [x] ESLint + Prettier (com plugin Tailwind)
- [x] shadcn/ui inicializado (`components.json`, tokens mapeados)
- [x] Verificacao Framer Motion / Supabase (ja instalados e configurados)

## Sprint 1 — Fundacao (CONCLUIDA)
- [x] Setup do projeto e configs
- [x] Identidade visual em tokens
- [x] Esquema do banco + seed
- [x] Clientes Supabase
- [x] Barramento de eventos + testes
- [x] Layout + sidebar
- [x] Tela Hoje (estado inicial)
- [x] README / CHANGELOG / TODO

## Roadmap do MVP (em andamento continuo)

Modulos sem dependencia de IA (posso implementar com o schema/padroes atuais):
- [ ] Objetivos (tabela `goals` ja existe)
- [ ] Calendario (visualizacao de `contents` por `planned_at`)
- [ ] Biblioteca (conteudos publicados/arquivados)
- [ ] Metricas — entrada manual (tabela `metrics` ja existe; Metricool e outro item)
- [ ] Estrutura de integracao com Metricool (stub/config, sem credenciais reais ainda)
- [ ] Banco de Hooks (schema ainda nao existe — precisa de migration nova)

Modulos que dependem do conteudo do Product Playbook / AI Manifesto (ainda
nao tenho acesso ao texto — ver PROJECT_STATUS.md "Decisoes pendentes"):
- [ ] Brand Brain / Business Brain / Learned Brain (edicao dos 3 cerebros)
- [ ] DNA do Conteudo (tabela `content_dna` ja existe)
- [ ] Diretor de Conteudo (orquestracao de IA)
- [ ] Integracao com Claude (precisa de `ANTHROPIC_API_KEY`)
- [ ] Motor de Contexto (monta cenario antes de cada chamada de IA)
- [ ] Analise automatica de Momento pela IA (sugestao de formatos)
- [ ] "Gerar com IA" no painel lateral do card
- [ ] Previsao x real (tabela `predictions` ja existe)
- [ ] Briefing diario + Ritual de Segunda
- [ ] Estado de fim de dia
