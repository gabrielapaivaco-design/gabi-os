# Gabi OS

Segundo cerebro para documentar a construcao de uma vida e transforma-la em conteudo.
Nao e um calendario nem um gerenciador de Instagram: e um ecossistema de inteligencia
com um Diretor de Conteudo virtual dentro.

A logica do sistema e sempre: **Acontecimento -> Ideia -> Conteudo -> Publicacao -> Analise -> Aprendizado.**

> Para o estado atual do projeto (o que esta implementado, o que falta, dividas
> tecnicas conhecidas), veja [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (identidade visual congelada em `tailwind.config.ts`)
- shadcn/ui (componentes gerados sob demanda via CLI, tokens mapeados na identidade)
- Supabase (Postgres) como banco
- Framer Motion para microinteracoes
- @dnd-kit para drag-and-drop acessivel (Pipeline)
- `@anthropic-ai/sdk` (Claude) como provedor de IA do Diretor de Conteudo,
  atras de uma interface agnostica em `lib/ai/types.ts`
- ESLint + Prettier (com `prettier-plugin-tailwindcss`) para qualidade e formatacao
- Vitest para testes

## Uso no dia a dia (Windows)

De um duplo clique em **`iniciar.bat`** na pasta do projeto. Ele coloca o Node
no PATH, instala as dependencias se for a primeira vez, sobe o servidor e abre
http://localhost:3000 no navegador. Para desligar, feche a janela preta.

O sistema roda **apenas nesta maquina** — nao esta publicado e nao abre pelo
celular.

### node_modules e .next ficam FORA do OneDrive

O projeto vive dentro do OneDrive, mas `node_modules` e `.next` sao
**junctions** apontando para `C:\gabi-os-cache\`:

```
node_modules  ->  C:\gabi-os-cache\node_modules
.next         ->  C:\gabi-os-cache\next
```

Isso nao e detalhe de organizacao, e desempenho. Dentro do OneDrive, cada um
dos ~26.000 arquivos de `node_modules` vira um *reparse point* do Files
On-Demand: toda leitura passa pelo driver do OneDrive e arquivos marcados como
"so na nuvem" precisam ser baixados antes de serem lidos. Num projeto Node,
que abre dezenas de milhares de arquivos por compilacao, isso derruba o
servidor para dezenas de segundos por rota e provoca erros `EBUSY` quando o
OneDrive trava um arquivo que o webpack esta escrevendo.

**Cuidado:** `npm ci` apaga a pasta `node_modules` inteira antes de instalar —
e leva a junction junto. Depois de rodar `npm ci`, refaca:

```bash
cd "C:\Users\gaabi\OneDrive\Documentos\GabiContentOS\gabi-os" && cmd /c 'move /Y node_modules C:\gabi-os-cache\node_modules' && cmd /c 'mklink /J node_modules C:\gabi-os-cache\node_modules'
```

`npm install` (sem o `ci`) preserva a junction e nao exige esse passo.

## Como executar localmente

Pre-requisitos: Node 18+ e uma conta no [Supabase](https://supabase.com).

1. Instale as dependencias:
   ```bash
   npm install
   ```
2. Crie um projeto no Supabase e rode as migrations do diretorio
   `supabase/migrations/` no SQL Editor, em ordem (`0001_init.sql`, depois `0002_seed.sql`).
3. Copie `.env.example` para `.env.local` e preencha com as chaves do seu projeto:
   ```bash
   cp .env.example .env.local
   ```
4. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Abra http://localhost:3000

## Scripts

| Comando              | O que faz                          |
| --------------------- | ---------------------------------- |
| `iniciar.bat`          | Sobe o sistema e abre o navegador (Windows) |
| `npm run dev`          | Servidor de desenvolvimento        |
| `npm run build`        | Build de producao                  |
| `npm run typecheck`    | Verificacao de tipos               |
| `npm run lint`         | ESLint (`next lint`)               |
| `npm run lint:fix`     | ESLint com correcao automatica     |
| `npm run format`       | Formata tudo com Prettier          |
| `npm run format:check` | Verifica formatacao sem alterar    |
| `npm run test`         | Testes (Vitest)                    |

## Adicionando componentes shadcn/ui

O projeto ja esta inicializado (`components.json`). Para adicionar um componente:
```bash
npx shadcn@latest add button
```
Os componentes caem em `src/components/ui/` e usam `cn` de `@/lib/utils`.

## Estrutura

```
src/
  app/            rotas (Hoje, Momentos, Pipeline, Calendario, Cerebros, Config)
    momentos/     captura + feed cronologico (Server Action, Client Components, error boundary)
    pipeline/     Kanban com drag-and-drop + painel do card com o Diretor de Conteudo
    cerebros/     editor dos tres Cerebros (Brand, Business, Learned)
    config/       identidade do workspace e status da IA
  components/
    layout/       sidebar e estrutura da pagina
    ui/            componentes gerados pelo shadcn/ui (sob demanda)
  lib/
    supabase/     clientes browser e server
    workspace/    resolucao do workspace atual (current.ts) e servico (service.ts)
    events/       barramento de eventos (nucleo orientado a eventos)
    moments/      captura de Momento (service) e agrupamento cronologico
    contents/     criacao e reordenacao de Conteudo (service)
    brains/       leitura e escrita dos tres Cerebros
    ai/           contrato agnostico de provedor (types.ts), implementacao
                  Anthropic (anthropic.ts), registro (index.ts)
      director/   Diretor de Conteudo: motor de contexto, prompts, orquestracao
    planning/     motor de contexto do planejamento mensal
    utils/        constantes e helpers
  types/          tipos do dominio
supabase/migrations/  esquema e seed
tests/            testes unitarios
```

## Workspaces

Todo dado do sistema pertence a um Workspace: os tres Cerebros, Momentos,
Conteudos, Calendario, Biblioteca, Objetivos, Metricas, DNA do Conteudo,
historico de IA e configuracoes. Nada atravessa a fronteira.

A resolucao do workspace atual acontece em um unico lugar,
`lib/workspace/current.ts` — nenhum outro arquivo importa a constante do
workspace padrao. Toda query e todo service filtram pelo valor que essa funcao
devolve.

O MVP usa apenas o workspace **Gabriela** e nao expoe troca pela interface. A
arquitetura, porem, ja esta pronta: `createWorkspace()` cria um workspace novo
com os tres Cerebros vazios, e `getWorkspaceId()` ja le um cookie antes de cair
no padrao. Adicionar Eisen Haus ou Mari Calcados e escrever esse cookie — nao
refatorar o sistema.

## Diretor de Conteudo (IA)

O Diretor gera roteiros, legendas, outros angulos e analises para um card do
Pipeline, usando como contexto os Cerebros do workspace, o pilar, o objetivo, o
Momento que originou o conteudo e os conteudos ja publicados.

Requer `ANTHROPIC_API_KEY` em `.env.local`. Sem a chave, a interface diz
exatamente isso em vez de oferecer um botao que so falha ao ser clicado.

A geracao abre em **tela cheia** (`director-studio.tsx`), nao dentro do painel
lateral: o texto gerado e o produto do trabalho e precisa de espaco para ser
lido. Coluna de leitura limitada por medida (~62 caracteres), corpo 15px e
entrelinha 1.75.

- **Roteiro** e **Legenda** preenchem campos do card. So com "Usar no card" —
  fechar o estudio nao escreve nada. Depois disso o texto ainda **nao esta
  gravado**: quem decide o que vai para o banco e voce, com o botao Salvar.
- **Outros angulos** e **Analisar** sao leitura; nao alteram o card.

### Conversar

As quatro tarefas acima sao de mao unica: uma pergunta, uma resposta. Servem
quando voce sabe o que quer. Nao servem quando o Diretor entendeu literal
demais e voce precisa dizer "mais leve", "corta o meio", "e se comecasse pelo
fim?".

O botao **Conversar** abre um dialogo com o mesmo contexto (Cerebros, pilar,
Momento de origem). O historico inteiro vai a cada turno, entao ele lembra do
que voce corrigiu antes. Cada resposta tem "Copiar" e "Usar como roteiro" —
nada e gravado sozinho.

## Historico da IA

`/historico` lista tudo o que foi gerado neste workspace: tipo, card de origem,
modelo, tokens gastos e o que voltou, inclusive as falhas. Da para excluir um
registro ou limpar tudo (com confirmacao por digitacao).

Apagar o historico nao mexe no texto que ja foi aplicado nos cards — o que se
perde e o registro de custo e a resposta da IA.

O ultimo resultado fica guardado enquanto o painel estiver aberto — "Reabrir"
mostra de novo sem gastar outra chamada de IA. `Escape` fecha o estudio
primeiro e o painel so no segundo toque.

**Trocar de provedor de IA** (OpenAI, Gemini) e escrever um arquivo em
`lib/ai/` que implemente a interface `AiProvider` de `lib/ai/types.ts` e
registra-lo em `lib/ai/index.ts`. Nenhuma regra de negocio muda: o Diretor
conversa apenas com a interface, nunca com a Anthropic diretamente.

## Momentos (Sprint 2)

Captura sem friccao em `/momentos`: um unico campo de texto, sem titulo nem
metadados. Atalhos: `Ctrl`/`Cmd`+`Enter` registra, `N` foca o campo a partir de
qualquer ponto da pagina (exceto quando ja se esta digitando em outro campo).
Cada registro grava na tabela `moments` e emite o evento `momento.criado` pelo
barramento de eventos. O feed abaixo do campo agrupa os Momentos por dia
(mais recente primeiro, ordem cronologica dentro do dia), estilo diario.

Cada Momento tem um botao de lixeira que pede confirmacao em dois passos. Ao
contrario de Conteudo (que e arquivado para preservar historico e metricas), o
Momento e **removido do banco de verdade** — e materia-prima, e quem escreveu
tem o direito de desfazer o registro.

Se aquele Momento ja tiver virado Conteudo, a confirmacao **nomeia o card**
afetado antes de excluir. O Conteudo sobrevive: a FK e `on delete set null`,
entao o card continua no Pipeline, apenas sem o vinculo com a origem. O evento
`momento.excluido` guarda o texto do que foi removido, ja que a linha some.

Se o Supabase ainda nao estiver configurado, a pagina mostra um aviso honesto
em vez de quebrar — tanto na leitura do feed quanto no envio do formulario
(com um boundary de erro dedicado).

## Pipeline (Sprint 3)

Kanban em `/pipeline` com as 7 colunas de status do Product Playbook (Ideia,
Roteiro, Gravar, Editar, Agendar, Publicado, Analisar). Cards sao arrastados
entre colunas e reordenados dentro delas com `@dnd-kit` (mouse/touch e
teclado). A ordem e o status de cada card sao persistidos ao soltar.

Um Conteudo nasce sempre em "Ideia", de duas formas:
- **A partir de um Momento**: botao "Transformar em Conteudo" em `/momentos`
  (titulo provisorio gerado a partir do corpo do Momento). Um Momento so pode
  virar Conteudo uma vez — depois disso o botao vira "Ja e conteudo".
- **Direto no Pipeline**: campo "+ Novo card", visivel apenas na coluna Ideia.

Cards ligados a um Momento mostram um trecho do Momento original. Mesmo
padrao de degradacao honesta de `/momentos` se o Supabase nao estiver
configurado (leitura e escrita).

Clicar em um card abre o painel lateral de edicao: todos os campos
(titulo, formato, objetivo, pilar, hook, roteiro, legenda, CTA). "Excluir"
pede confirmacao em dois passos antes de arquivar (`archived = true` —
nunca um delete fisico, preserva o historico). Erros de salvar/excluir
aparecem no proprio painel, sem derrubar a tela. Arquivar um card libera o
Momento de origem para ser transformado em Conteudo de novo.

## Documentacao do produto

A fonte unica de verdade e o **Product Playbook** e o **AI Manifesto** (documentos
externos ao repositorio). Nao altere arquitetura sem consulta-los.
