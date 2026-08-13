# Changelog

Formato baseado em Keep a Changelog. Uma entrada por sprint.

## [Planejamento] - Conversar sobre o mes, e refazer o plano pela conversa

### Adicionado
- Botao **Conversar** em `/planejamento`. O Diretor recebe o cronograma inteiro
  — diagnostico, foco e o `why` de cada item — junto com o mesmo contexto que
  usou para monta-lo.
- **Refazer o plano**: manda o dialogo de volta ao gerador, que devolve o
  cronograma revisado. O plano atual entra na instrucao para ele saber o que
  preservar; sem isso reinventaria tudo e a pessoa perderia as decisoes que ja
  tinha tomado. O resultado volta como proposta, para ser revisado de novo.
- `DirectorChat` virou generico: recebe quem envia, a acao por mensagem e a
  acao final. Serve ao card do Pipeline e ao plano do mes sem duplicar moldura,
  comportamento do campo nem tratamento de erro.

### Decisao
- A conversa **nao altera o plano sozinha**, e o prompt diz isso ao modelo
  ("nao reescreva o cronograma na conversa"). Discutir e barato; reescrever
  descarta trabalho. Sao dois gestos separados de proposito.

### Verificacao (API real, workspace de teste descartado depois)
- Plano inicial: 12 conteudos. Perguntei "nao vou dar conta desse volume, o que
  corto primeiro?" — ele respondeu citando os itens por dia, explicou a ordem de
  corte e ofereceu um piso de 6.
- Respondi "vamos com o piso de 6, e tira qualquer coisa de venda". Ele acatou,
  recalculou para 5 e justificou nao repor ("com saldo de -162, o que falta e
  vinculo").
- **Refazer o plano** devolveu exatamente 5 itens, nos dias 10, 11, 13, 20 e 31
  — os mesmos que ele havia dito que manteria. Nenhum objetivo `venda` restou.
  Os 5 ficaram ancorados em Momentos reais.
- Nada foi materializado: 0 cards no Pipeline enquanto a proposta nao e aprovada.

## [Planejamento] - O Diretor nao sabia que dia e hoje

### Corrigido
- O prompt informava o mes e quantos dias ele tem, mas **nunca a data de hoje**.
  Gerado no dia 10, o plano comecava no dia 3 — quase um terco do cronograma
  nascia no passado. Agora o prompt declara o dia corrente, quantos dias restam
  e proibe propor data anterior a hoje. Em mes futuro, o mes inteiro segue
  liberado.
- Segunda camada na tela: itens com data vencida aparecem esmaecidos, marcados
  "passou", e o rodape diz quantos sao. Um plano gerado no dia 1 e aprovado no
  dia 20 nao cria mais cards atrasados em silencio.
- Regra nova no prompt: so citar dia da semana no `why` se ele corresponder a
  data escolhida — o modelo escreveu "sabado 18h" num item de domingo.

## [Planejamento] - Cronograma do mes gerado pelo Diretor

### Adicionado
- `lib/ai/director/planner.ts`: o Diretor le o cenario inteiro e propoe o mes —
  diagnostico honesto das metricas, foco do mes, e os conteudos com dia, hora,
  formato, objetivo, pilar, hook e a justificativa de cada um.
- `lib/planning/service.ts`: a proposta e gravada em `monthly_plans` com
  `approved = false`. Nada vira card antes da aprovacao; regerar descarta a
  proposta anterior sem sujar o Pipeline.
- Aprovar materializa: cada item vira Conteudo em "Ideia" com `planned_at`
  (data + hora), pilar resolvido por nome e vinculo com o Momento de origem.
- `scripts/importar-metricas.mjs`: traz o desempenho do mes para dentro do
  sistema. Numeros vao para `metrics` (linha de conta, `content_id` nulo),
  melhores horarios para `workspaces.settings`, e a leitura em texto vira uma
  secao editavel do Learned Brain. Idempotente por mes.
- O Motor de Contexto passou a carregar os melhores horarios.

### Decisoes
- O indice do Momento devolvido pela IA e traduzido para o id real **no momento
  de salvar**. Guardar so o indice tornaria o plano inaplicavel depois, porque a
  lista de Momentos muda a cada geracao.
- O prompt exige que cada item justifique-se por um numero, um Momento ou o
  diagnostico. "Boa ideia" nao e justificativa.

### Corrigido
- `tsc` estourava a memoria (`heap out of memory`) por causa de um `as const`
  no schema JSON do plano: o literal aninhado gera um tipo gigante. Tipado como
  `Record<string, unknown>`, compila normal.

### Verificacao (API real, workspace de teste descartado depois)
- Cenario semeado com 4 Momentos, 3 Cerebros, 3 pilares, metricas de julho e
  melhores horarios. O Diretor produziu **16 conteudos** para agosto.
- O diagnostico leu os numeros certos e chegou a conclusao certa: "nao e o
  algoritmo, e frequencia" — o Reel unico fez 1.673 contra media de 401.
- Regras respeitadas: 0 dias fora do mes, horas todas vindas dos melhores
  horarios, 10 dos 16 itens ancorados em Momentos reais, indices resolvidos
  corretamente (idx 1 -> Momento da CLT, idx 0 -> Momento do treino).
- Aprovacao criou 16 cards: todos em "ideia", todos com data em agosto/2026,
  16/16 com objetivo e hook, 14/16 com pilar resolvido, 10/16 ligados ao
  Momento de origem. O plano ficou marcado como aprovado e o botao sumiu.

## [Diretor] - Conversa e historico da IA

### Adicionado — Conversar com o Diretor
- `lib/ai/director/chat.ts` + botao **Conversar** no painel do card. As quatro
  tarefas continuam de mao unica; esta e a que permite corrigir o Diretor
  quando ele entende literal demais.
- Sem `jsonSchema`: a resposta e texto livre. O historico inteiro vai a cada
  turno, entao ele lembra do que foi corrigido tres mensagens atras.
- Prompt de conversa proprio, por cima do `DIRECTOR_SYSTEM`: respostas curtas,
  acatar correcao de verdade em vez de repetir a ideia com outras palavras, e
  interpretar intencao ("ficou quadrado" pede outro ritmo, nao sinonimos).
- `effort: "medium"` — dialogo pede resposta rapida; o esforco alto fica para
  as tarefas estruturadas.
- Cada resposta tem "Copiar" e "Usar como roteiro". Nada e gravado sozinho.
- Falha de rede devolve a pergunta para o campo em vez de descarta-la.

### Adicionado — Historico da IA (`/historico`)
- Lista tudo o que foi gerado no workspace, com tipo, card de origem, modelo,
  tokens de entrada/saida e o resumo do que voltou (inclusive as falhas).
- Excluir registro individual e "Limpar tudo", este com confirmacao por
  digitacao reconferida no servidor.
- Nao precisou de migration: a policy `workspace_isolation` em `ai_generations`
  ja e `for all`, entao DELETE por membro do workspace ja estava autorizado.

### Corrigido
- `/historico` quebrava com "You're importing a component that needs
  next/headers" — o componente cliente importava `lib/ai/history`, que puxa
  `getWorkspaceId` -> `next/headers` pela cadeia. As partes puras (tipo,
  rotulos, `summarize`) foram para `lib/ai/history-view.ts`, sem import de
  servidor. **Nem `typecheck` nem `lint` pegam esse erro** — so aparece ao
  abrir a rota.

### Verificacao (API real)
- Conversa: pedido de hook respondido em 2s na voz do Brand Brain. A correcao
  seguinte ("ficou ironico demais, quero mais honesto, sem piada, bem curto")
  mudou a ideia de verdade — a piada final sumiu e o texto encurtou, nao foi
  troca de sinonimos.
- "Usar como roteiro" levou o texto corrigido para o campo do card, com o aviso
  de rascunho e sem gravar.
- Historico: 2 conversas registradas, 2.078 tokens somados; excluir um registro
  deixou 1; "Limpar tudo" so liberou com a palavra exata e zerou a lista.

## [Workspaces] - Renomear e excluir marca

### Adicionado
- Migration `0006_workspace_admin.sql`: `rename_workspace` e `delete_workspace`.
- `/config`: renomear a marca ativa (o identificador e regerado do nome) e
  excluir, numa secao separada que antes lista **o que sera perdido**, contado
  do banco — Momentos, Conteudos, Cerebros preenchidos, metas e geracoes de IA.
- Confirmacao por digitacao do nome da marca. Reconferida no servidor: botao
  desabilitado e sugestao, nao protecao.

### Regras que vivem no banco, nao na tela
- Nao da para excluir o unico workspace da conta — ela ficaria sem lugar para
  trabalhar. A checagem esta dentro da funcao, entao vale mesmo para quem
  chamar a Server Action sem passar pela interface.
- Renomear para o identificador de outra marca e recusado; para o proprio
  identificador e aceito (corrigir um acento no nome nao pode falhar por
  "colidir consigo mesmo").
- Renomear ou excluir workspace de outra conta: recusado por `is_workspace_member`.

### Verificacao
- 14 asserções contra o banco real, todas passaram, incluindo a recusa de
  apagar o ultimo workspace e a tentativa de renomear/excluir o workspace da
  Gabriela a partir de outra conta.
- Pela interface: renomear "Marca Errada Store" para "Marca Certa" atualizou
  nome, sidebar e slug (`marca-certa`); a exclusao so liberou o botao com o
  nome digitado exatamente certo, e o app trocou sozinho para a marca restante.
- Cascata verificada com dados dos dois lados: a marca excluida levou apenas os
  proprios Momentos e Cerebros; a outra ficou intacta.

### Nota de migration
- As funcoes usam delimitadores nomeados (`$rename_ws$`, `$delete_ws$`) em vez
  de `$$`. Com duas funcoes no mesmo arquivo, o SQL Editor do Supabase
  emparelha o `$$` que fecha a primeira com o que abre a segunda e falha com
  "unterminated dollar-quoted string".

## [Plataforma] - Autenticacao e troca de workspace

### Adicionado
- Migration `0005_auth_workspaces.sql`: `workspace_members`, RLS em **todas** as
  15 tabelas, e as funcoes `is_workspace_member`, `create_workspace` e
  `claim_orphan_workspaces`.
- `middleware.ts`: renova a sessao, barra acesso anonimo e resolve o cookie de
  workspace.
- `/login`: entrar e criar conta com e-mail e senha.
- Seletor de workspace no topo da sidebar: trocar de marca, criar marca nova
  (o identificador sai do nome — "Mari Calcados" vira `mari-calcados`), e sair.
- A primeira conta criada adota os workspaces que ja existiam. So dispara
  enquanto nao houver nenhum vinculo — depois disso, contas novas comecam vazias.

### Corrigido
- Conta sem nenhum workspace via "Nenhum workspace ainda" **sem botao para
  criar o primeiro** — beco sem saida. O seletor vazio agora abre direto no
  formulario de criacao.
- Cookie apontando para workspace excluido deixava o app num estado
  contraditorio: sidebar mostrando uma marca, telas vindo vazias (as paginas
  leem o cookie direto, nao a lista). O middleware nao pegava isso porque, por
  desempenho, so consulta os vinculos quando o cookie esta ausente. A correcao
  passou para o seletor, que se conserta sozinho quando a inconsistencia
  aparece — custo zero no caso comum. Verificado com um cookie forjado
  apontando para um id inexistente: voltou ao workspace real no primeiro
  carregamento.
- A adocao criava um cliente Supabase novo para chamar a RPC, sem a sessao em
  memoria. `auth.uid()` chegava nulo no banco e nada era adotado.

### Isolamento — verificado, nao presumido
Teste de invasao com uma segunda conta real, contra o banco de producao
(22 asserções, todas passaram; conta e workspaces removidos depois):
- Leitura sem filtro em 7 tabelas: 0 linhas de outro workspace.
- Consulta apontando direto para o `workspace_id` da Gabriela: 0 linhas.
- `INSERT` no workspace alheio: recusado pela policy.
- `UPDATE` e `DELETE` no workspace alheio: 0 linhas afetadas.
- `INSERT` em `workspace_members` para se autopromover: recusado.
- `claim_orphan_workspaces` por uma segunda conta: devolve 0.
- Uso legitimo intacto: cria o proprio workspace, grava, e le so o que e seu.

Pela interface, com duas marcas reais (Eisen Haus e Mari Calcados): dado
gravado numa nao aparece na outra, nos dois sentidos, e cada uma nasce com os
seus tres Cerebros.

## [Desempenho] - O app estava lento por dois motivos independentes

### Corrigido — OneDrive (causa dominante)
- `node_modules` (26.293 arquivos) e `.next` estavam dentro do OneDrive, e
  **todo** arquivo era um *reparse point* do Files On-Demand: cada leitura
  passava pelo driver do OneDrive. Sintomas medidos: `/login` em **20.307ms**,
  erros `EBUSY: resource busy or locked` em `.next\server\webpack-runtime.js`
  no meio da compilacao, e recompilacoes repetidas.
- As duas pastas viraram junctions para `C:\gabi-os-cache\`. Restam **0**
  reparse points. Nenhum `EBUSY` desde entao.
- Resposta em regime permanente: de **~150-290ms** para **~40-60ms**.

### Corrigido — idas a rede que eu mesmo introduzi com a autenticacao
- Eram 4 chamadas de rede sequenciais por pagina (~50ms cada) antes de
  qualquer renderizacao: `getUser()` no middleware, consulta de membros,
  `getUser()` de novo no layout e a lista de workspaces. Agora sao 2.
- O middleware repassa o e-mail ja validado por cabecalho
  (`x-gabios-user-email`), eliminando o segundo `getUser()`. O cabecalho e
  **apagado no inicio de toda requisicao** e so reescrito depois da validacao,
  entao um valor forjado pelo cliente nunca sobrevive — verificado.
- A consulta de `workspace_members` no middleware so roda quando o cookie de
  workspace esta ausente. Um cookie errado nao vaza dado (quem barra e o RLS);
  no maximo o seletor mostra outro workspace como ativo.

### Nota
- A **primeira** visita a cada rota continua levando ~3-16s: e o Next
  compilando sob demanda em modo dev. Isso nao tem conserto sem `npm run
  build`, e some depois da primeira visita.

## [Diretor] - Estudio em tela cheia para a saida gerada

### Adicionado
- `pipeline/director-studio.tsx`: a geracao do Diretor abre em tela cheia
  (`max-w-[820px]`, `max-h-[88vh]`), com coluna de leitura limitada a ~62
  caracteres, corpo 15px e entrelinha 1.75. Antes o texto — que e o produto do
  trabalho — dividia uma caixa de 3px de padding com os campos de metadado.
- Estado de carregamento com placeholder pulsante: a geracao leva ~7-10s e uma
  area vazia por esse tempo parece travamento.
- Erro agora aparece dentro do estudio, com espaco e um botao "Tentar de novo".
- "Reabrir": o ultimo resultado sobrevive ao fechar o estudio, para reler sem
  gastar outra chamada de IA.

### Alterado
- Roteiro e legenda **nao preenchem mais os campos automaticamente**. O estudio
  mostra o texto e a aplicacao acontece por decisao explicita ("Usar no card").
  Fechar nao escreve nada. O passo seguinte nao mudou: nada vai para o banco
  sem Salvar.
- Painel lateral de 420px para 520px; roteiro de 4 para 10 linhas, legenda de
  3 para 6, hook de 2 para 3 — os campos que recebem o texto gerado.
- `Escape` fecha o estudio primeiro (listener em fase de captura) e o painel so
  no segundo toque.

### Validacao
- Contra a API real, no card "carteira de habilitacao": roteiro gerado em 7s
  (hook 107 chars, roteiro 1712 chars aplicados nos campos), analise renderizada
  com as tres secoes. Confirmado no banco que **nada foi gravado** sem Salvar
  (`hook` e `script` continuam `null`).
- Estudio 88vh no maximo, corpo rolando por dentro, sem rolagem horizontal.
- 62/62 testes, `typecheck` e `lint` limpos.

## [Momentos] - Exclusao de Momento

### Adicionado
- Botao de lixeira em cada Momento do feed, com confirmacao em dois passos
  dentro do proprio card (mesmo padrao do painel do Pipeline, sem modal).
- `deleteMoment()` em `lib/moments/service.ts`: delete escopado por `id` **e**
  `workspace_id` — o id chega do cliente e nao pode apagar Momento de outro
  workspace.
- Evento `momento.excluido`, com o **texto** do Momento no payload: como a linha
  sai do banco, o evento e o unico registro de que aquilo existiu.
- `deleteMomentAction` devolve `{ ok, error }` em vez de lancar, porque o Next
  redige a mensagem de excecoes nao tratadas em Server Action.
- `iniciar.bat`: sobe o sistema e abre o navegador com um duplo clique.

### Decisao de design
- Momento e **excluido de verdade**, nao arquivado como Conteudo. Conteudo
  carrega historico e metricas; Momento e materia-prima, e quem escreveu tem o
  direito de desfazer o registro. Foi o que o usuario pediu explicitamente.
- Se o Momento ja virou Conteudo, a confirmacao **nomeia o card** afetado. O
  Conteudo sobrevive (`moment_id` e `on delete set null`) — verificado no banco
  real: apos excluir o Momento, o card continuou vivo com `moment_id = null` e
  `archived = false`.

### Validacao
- 62/62 testes (4 novos em `moments-service.test.ts`), `typecheck` e `lint` limpos.
- Testado no navegador contra o Supabase real com dados de teste proprios
  (depois removidos): aviso nomeando o card, Cancelar sem excluir, exclusao do
  Momento solto e do vinculado, evento gravado com o corpo preservado.

## [Plataforma] - Arquitetura de Workspaces + Diretor de Conteudo com IA real

### Adicionado — Workspaces
- Migration `0004_workspaces_ai.sql`: `workspaces.slug` (identificador legivel,
  base da futura resolucao por rota/subdominio), `workspaces.settings` (JSONB,
  configuracao isolada por workspace) e a tabela `ai_generations` (auditoria de
  toda chamada de IA, por workspace). **Precisa ser rodada no SQL Editor.**
- `lib/workspace/service.ts`: `getCurrentWorkspace`, `listWorkspaces` e
  `createWorkspace` — este ultimo ja cria os tres Cerebros vazios, para que um
  workspace novo nasca utilizavel. Nao exposto na UI por decisao de escopo.
- `getWorkspaceId()` passou a ler um cookie (`gabios_workspace`) antes de cair
  no workspace padrao, validando o formato UUID antes de usar o valor como
  filtro — o valor vem do cliente. O caminho de multiplos workspaces esta
  escrito; falta apenas escrever o cookie.
- `/config`: workspace ativo (nome, slug, id), quantidade de workspaces no
  banco, status do provedor de IA e a lista explicita do que cada workspace
  isola. Torna a arquitetura verificavel em vez de apenas afirmada.
- `/cerebros`: editor dos tres Cerebros (Brand, Business, Learned) como secoes
  livres (titulo -> texto), isolados por workspace. Um Cerebro vazio abre com
  titulos sugeridos; secoes sem titulo ou sem texto nao sao gravadas.

### Adicionado — Diretor de Conteudo (IA real)
- **Camada agnostica de provedor** (`lib/ai/types.ts`): `AiProvider`,
  `AiGenerateRequest/Result`, `AiNotConfiguredError`, `AiProviderError`. Nada
  nesse contrato menciona Anthropic — trocar ou somar OpenAI/Gemini e escrever
  um arquivo novo e registra-lo, sem tocar em regra de negocio.
- **Implementacao Anthropic** (`lib/ai/anthropic.ts`): Claude Opus 5, pensamento
  adaptativo, saida estruturada por JSON Schema e erros do SDK traduzidos para
  mensagens que a usuaria entende (classes tipadas, nunca comparacao de
  strings). O parametro `fallbacks` reexecuta o pedido em outro modelo se os
  classificadores recusarem — e se a conta nao tiver acesso a esse beta, a
  geracao acontece sem ele em vez de ficar fora do ar.
- **Registro por ambiente** (`lib/ai/index.ts`): `AI_PROVIDER` escolhe o
  provedor, `isAiConfigured()` permite a UI dizer a verdade sem tentar gerar.
- **Motor de contexto por conteudo** (`lib/ai/director/context.ts`): junta
  Cerebros, pilar, objetivo, Momento de origem, conteudos ja publicados e DNA.
  Cerebros e campos vazios sao **omitidos** do prompt em vez de virarem
  "(vazio)" — nao ocupam espaco nem induzem o modelo a preencher lacunas.
- **Diretor** (`lib/ai/director/index.ts`): quatro capacidades — `roteiro`
  (hook + roteiro), `legenda` (legenda + CTA), `ideias` (outros angulos) e
  `analise`. Cada chamada e auditada em `ai_generations` (inclusive as que
  falham) e emite `ia.gerou`.
- **"Gerar com IA" no painel do card**: os quatro botoes preenchem os campos do
  card (roteiro/legenda) ou exibem o resultado (angulos/analise). O texto
  gerado **nao e gravado automaticamente** — fica no formulario para revisao.
- Novos tipos de evento: `cerebro.atualizado` e `ia.gerou`.

### Corrigido
- `/config` acusava "nao consegui falar com o Supabase" quando o unico problema
  era a migration 0004 pendente (as colunas `slug`/`settings` ainda nao
  existiam). A leitura de workspace agora tenta o schema novo e cai no antigo,
  mostrando "migration 0004 pendente" — a mensagem verdadeira.

### Validacao
- `typecheck`, `lint` e `build` limpos; 58/58 testes (10 arquivos, 22 novos).
- Testado no navegador contra o Supabase real: `/cerebros` grava e recarrega uma
  secao do Brand Brain; `/config` mostra o workspace ativo; o painel do card
  mostra a secao do Diretor com o aviso honesto de chave ausente.
- **Validado com chave real** (2026-08-05): migration `0004` rodada e
  `ANTHROPIC_API_KEY` configurada. `/config` mostra `anthropic / conectado`.
  No card "hoje eu comprei maquiagem" o Diretor gerou **roteiro** (~9s,
  1746 tokens de entrada / 911 de saida) e **analise** (1744 / 1702), ambos
  com `claude-opus-5`, ambos ancorados no Brand Brain salvo — a voz e os dados
  biograficos do texto vieram do contexto real, nao de invencao. As duas
  chamadas ficaram registradas em `ai_generations` sem erro, confirmando a
  auditoria por workspace.

## [MVP utilizavel] - Calendario, Planejamento, Metas, busca no Pipeline

### Adicionado
- **Calendario** (`/calendario`): grade mensal completa (6 semanas fixas, para
  o layout nao "pular" ao trocar de mes), navegacao entre meses, painel lateral
  "Sem data" e agendamento por drag-and-drop. Soltar um conteudo num dia grava
  `planned_at`; soltar de volta em "Sem data" desagenda. Marcadores de datas
  comemorativas quando a migration 0003 estiver aplicada.
- **Campo "Planejado para"** no painel do card do Pipeline — caminho por
  teclado para a mesma acao do arraste (e o unico testavel de forma confiavel
  em automacao). Usa a mesma Server Action do Calendario.
- **Planejamento do mes** (`/planejamento`): monta de verdade, a partir do
  banco, todo o cenario que o Diretor de Conteudo vai consumir, e mostra
  honestamente quais das 11 fontes ja tem dados e quais estao vazias. Deixa
  explicito que a geracao por IA ainda nao esta ligada, em vez de fingir.
  Linkado a partir do Calendario (a navegacao lateral segue congelada em 6
  destinos pelo Product Playbook).
- **Motor de Contexto** (`src/lib/planning/context.ts`): `buildPlanningContext`
  agrega Momentos recentes, os 3 cerebros, pilares, objetivos do trimestre,
  historico de conteudos, ja planejado no mes, metricas, DNA do Conteudo e
  datas comemorativas — tudo escopado por `workspace_id`. Reporta em `missing`
  o que nao pode ser carregado, para o Diretor nunca confundir "sem dados" com
  "tabela inexistente".
- **Metas do trimestre** na tela Hoje: criar, editar, excluir (com confirmacao)
  e incrementar progresso, com barra de progresso. Usa a tabela `goals`.
- **Filas de acao** na tela Hoje: listas reais de conteudos em Gravar, Editar e
  Agendar, cada item linkando direto para o card no Pipeline (`?open=<id>`).
- **Busca e filtro no Pipeline**: campo de busca por titulo ou trecho do
  Momento + filtro por pilar. Cards fora do filtro ficam esmaecidos e
  inertes em vez de sumirem — assim as colunas nao "pulam" e o drag-and-drop
  nao quebra durante a busca.
- Migration `0003_planning.sql` (aplicada e verificada): tabelas
  `commemorative_dates` (com 10 datas globais do mercado brasileiro),
  `monthly_plans` (plano + snapshot do contexto usado para gera-lo, para
  auditoria posterior) e `hooks` (Banco de Hooks).

### Corrigido
- Warning de hidratacao do `@dnd-kit`: o `aria-describedby` gerado por um
  contador global divergia entre servidor e cliente. Removido apenas esse
  atributo (role/tabIndex preservados, acesso por teclado intacto).

### Validacao
- `typecheck`, `lint` e `build` limpos; 36/36 testes (7 arquivos).
- Testado no navegador contra o Supabase real: criar meta, incrementar
  progresso (persistiu apos reload), agendar conteudo pelo campo de data e
  confirmar que ele aparece no dia certo do Calendario e sai de "Sem data".

## [Arquitetura multi-workspace + Dashboard Hoje]

### Adicionado
- `getWorkspaceId()` em `src/lib/workspace/current.ts`: unico ponto de
  resolucao do workspace atual. Todo call site que antes importava a
  constante `WORKSPACE_ID` diretamente (rotas e services de Momentos e
  Conteudo) agora chama essa funcao. Hoje ela so devolve a constante fixa;
  quando workspaces multiplos existirem (Eisen Haus, Mari Calcados etc.), so
  essa implementacao muda — nenhum call site precisa ser tocado, porque
  `cookies()`/`headers()` do Next sao sincronos e a assinatura da funcao
  pode continuar igual.
- Tela Hoje (`/`) agora mostra dados reais: total de Momentos registrados,
  quantos ainda nao viraram Conteudo, e um resumo do Pipeline por status
  (contagem + cor de cada status ativo). Sem dados ainda, mantem o exato
  texto de onboarding original — nunca inventa numero nem insight.

### Validacao
- `typecheck`, `lint` e `build` limpos; 19/19 testes.
- Testado no navegador contra o Supabase real: Hoje reflete corretamente
  Momento nao convertido e depois Conteudo em "Ideia" apos transformar.

## [Infra + Pipeline completo] - Supabase real, edicao e exclusao de cards

### Infraestrutura
- Projeto Supabase real conectado (`.env.local` preenchido, fora do controle
  de versao). Migrations rodadas sem RLS — o app usa a anon key em toda
  consulta (browser e servidor), sem autenticacao ainda; RLS fica para a
  sprint de multiusuario.
- Persistencia real validada: Momentos, transformar Momento em Conteudo, e
  mover status no Pipeline testados de ponta a ponta contra o banco real.

### Adicionado — Pipeline completo
- Painel lateral (`src/app/pipeline/card-panel.tsx`) para editar qualquer
  campo do card: titulo, formato, objetivo, pilar, hook, roteiro, legenda,
  CTA. Abre ao clicar no card.
- Exclusao com confirmacao em dois passos ("Excluir" -> "Confirmar exclusao?").
  Sempre arquivamento (`archived = true`), nunca delete fisico — preserva
  historico para o barramento de eventos e o futuro DNA do Conteudo.
- `updateContent`/`archiveContent` em `src/lib/contents/service.ts`, com
  testes. Novos tipos de evento `conteudo.editado` e `conteudo.arquivado`.
- Indicador de pilar no card (ponto colorido + nome), com
  `resolvePillarColor()` em `lib/utils/constants.ts` mapeando os nomes de
  cor do seed (`rose`, `amber`, etc. — nem todos sao keywords CSS validas)
  para hex, reaproveitando a paleta de `STATUS_COLOR`.
- Sincronizacao automatica: `PipelineBoard` ressincroniza com os dados do
  servidor apos qualquer criacao/edicao/exclusao/movimentacao
  (`useEffect` em `initialColumns`), nao so na montagem inicial.
- Arquivar um card libera o Momento de origem para ser transformado de novo
  (fix em `src/app/momentos/page.tsx`: a query de "Momentos ja convertidos"
  agora filtra `archived = false`).

### Corrigido durante o desenvolvimento
- **`AnimatePresence` travava o painel montado para sempre ao fechar**: com
  dois `motion.div` irmaos (fundo + painel) sob a mesma chave, a animacao de
  saida nunca terminava de verdade e o componente nunca era removido do DOM,
  mesmo com o estado React corretamente atualizado (confirmado via log de
  render). Removido o `AnimatePresence`; o painel ainda anima ao abrir, so
  nao desliza para fora ao fechar.
- **Mensagens de erro de Server Action redigidas pelo Next.js**: por padrao,
  erros lancados (`throw`) em Server Actions chegam ao cliente como "An error
  occurred in the Server Components render but no message was provided",
  escondendo a causa real. `updateContentAction`/`archiveContentAction` agora
  retornam `{ok: true} | {ok: false, error}` em vez de lancar, preservando a
  mensagem real para o painel mostrar.

### Validacao
- `typecheck`, `lint` e `build` limpos; 19/19 testes (4 arquivos, 12 so em
  `contents-service`).
- Testado no navegador contra o Supabase real: criar card, editar todos os
  campos, salvar, excluir com confirmacao, e o ciclo completo Momento ->
  Conteudo -> exclusao -> Momento liberado de novo.

## [Sprint 3] - Pipeline

### Adicionado
- Kanban em `/pipeline` com as 7 colunas de status (`STATUS_ORDER` /
  `STATUS_LABEL` / `STATUS_COLOR`, reaproveitados de `lib/utils/constants.ts`
  sem alteracao).
- Drag-and-drop real com `@dnd-kit/core` + `@dnd-kit/sortable` +
  `@dnd-kit/utilities`: arrastar entre colunas, reordenar dentro da coluna,
  suporte a teclado (`KeyboardSensor` + `sortableKeyboardCoordinates`),
  `DragOverlay` para o card em arraste.
- `src/lib/contents/service.ts`: `createContent` (sempre nasce em "Ideia",
  `sort` calculado no servidor contando a coluna atual — nao depende do
  estado do cliente), `reorderColumn` (persiste status + sort de toda a
  coluna de destino apos um drag, emite `conteudo.movido` so quando o status
  de origem muda) e `truncateTitle`.
- Botao "Transformar em Conteudo" em `/momentos`: cria um card em "Ideia"
  ligado ao Momento (`moment_id`), com titulo provisorio truncado do corpo do
  Momento. Um Momento ja transformado mostra "Ja e conteudo" em vez do botao
  (consulta extra que verifica `contents.moment_id` antes de renderizar).
- Campo "+ Novo card" (mesmo padrao sem friccao do Momentos) na coluna Ideia,
  para criar Conteudo direto no Pipeline sem passar por um Momento.
- Cards ligados a um Momento mostram um trecho do corpo original (join
  `contents.moment:moments(body)`).
- `error.tsx` dedicado em `/pipeline`, mesma logica de `/momentos`: leitura e
  escrita degradam com aviso honesto se o Supabase falhar.
- 7 novos testes (`tests/contents-service.test.ts`): criacao, calculo de
  `sort`, persistencia de reordenacao e emissao condicional de
  `conteudo.movido`.

### Corrigido durante a revisao critica
- **Estado "fantasma" ao soltar um card fora de qualquer coluna, ou cancelar
  o drag (Esc)**: o card ficava visualmente na posicao movida pelo
  `onDragOver` sem nunca persistir no servidor, e sem reverter — divergindo
  silenciosamente do banco ate o proximo reload. Corrigido com um snapshot do
  estado pre-drag, restaurado em `onDragEnd`/`onDragCancel` quando o drop e
  invalido.

### Validacao
- `typecheck`, `lint` e `build` limpos; 14/14 testes passando (4 arquivos).
- Testado no navegador: `/pipeline` e `/momentos` degradam graciosamente sem
  Supabase configurado (sem erros no console, sem crash).
- **Limitacao**: sem um projeto Supabase real conectado neste ambiente, o
  fluxo completo de drag-and-drop com persistencia (arrastar um card de
  verdade, reordenar, transformar Momento em Conteudo) nao pode ser
  exercitado ponta a ponta aqui — so o caminho de degradacao. Ver instrucoes
  de teste manual no PROJECT_STATUS.md / mensagem de entrega da sprint.

## [Sprint 2] - Momentos

### Adicionado
- Captura de Momento sem friccao em `/momentos`: campo unico de texto, sem
  titulo nem metadados (`src/app/momentos/moment-capture.tsx`).
- Atalhos: `Ctrl`/`Cmd`+`Enter` registra; `N` foca o campo a partir de
  qualquer ponto da pagina (ignorado quando ha modificador ou foco em outro
  campo de digitacao).
- `insertMoment` (`src/lib/moments/service.ts`): grava em `moments` e emite
  `momento.criado` pelo barramento de eventos existente.
- `groupMomentsByDay` (`src/lib/moments/group-by-day.ts`): agrupamento
  cronologico puro (dias do mais recente ao mais antigo, momentos em ordem
  de vivencia dentro do dia) para o feed estilo diario.
- Feed com microinteracao de entrada via Framer Motion
  (`src/app/momentos/moment-feed.tsx`) — primeiro uso real da dependencia.
- Server Action `createMomentAction` + `error.tsx` dedicado: se o Supabase
  falhar ao gravar, a pagina mostra um estado de erro recuperavel em vez de
  quebrar.
- Leitura do feed tambem degrada com honestidade se o Supabase nao estiver
  configuravel (mesma logica do estado de onboarding da tela Hoje).
- Botao "+ Momento" da tela Hoje agora leva a `/momentos` (antes era estatico).
- 4 novos testes (`tests/moments-service.test.ts`, `tests/group-by-day.test.ts`).

### Validacao
- `typecheck`, `lint` e `build` limpos; 7/7 testes passando.
- Testado manualmente no navegador com Supabase **nao** configurado: feed e
  submit degradam graciosamente, botao "Tentar de novo" recupera o estado.
- no fluxo de escrita real (Supabase configurado com dados) ainda nao foi
  testado neste ambiente — ver nota na secao de revisao critica.

### Nota de revisao
- Em modo dev, o console mostra um warning React/Next
  ("Cannot update a component (`HotReload`) while rendering...") ao errar o
  submit. E ruido conhecido da combinacao Server Action + `useTransition` +
  Fast Refresh do Next 14 em dev; nao aparece em build de producao e nao
  afeta o comportamento (o `error.tsx` captura corretamente).

## [Ambiente] - Ferramentas de qualidade e shadcn/ui

### Adicionado
- ESLint (`next/core-web-vitals` + `eslint-config-prettier`) com scripts `lint`/`lint:fix`.
- Prettier com `prettier-plugin-tailwindcss`, scripts `format`/`format:check`.
- shadcn/ui inicializado (`components.json`), com `cn` movido para `tailwind-merge`
  em `@/lib/utils` (alias esperado pela CLI) e `@/lib/utils/cn` mantido como origem.
- Tokens semanticos do shadcn (`background`, `foreground`, `card`, `popover`,
  `primary`, `secondary`, `accent`, `destructive`, `border`, `input`, `ring`)
  mapeados sobre a identidade visual congelada, sem alterar nenhum token existente.
- Plugin `tailwindcss-animate` e dependencia `class-variance-authority` para
  suportar componentes gerados pela CLI do shadcn.

### Nota
- O token `muted` existente (texto secundario) nao foi remapeado para o par
  `muted`/`muted-foreground` do shadcn para nao quebrar seu uso atual — resolver
  ao introduzir o primeiro componente shadcn que dependa de `muted-foreground`.

## [Sprint 1] - Fundacao

### Adicionado
- Estrutura do projeto Next.js 14 + TypeScript + Tailwind.
- Identidade visual como tokens do Tailwind (fundo papel, acento preto, rose de identidade).
- Esquema completo do banco (`0001_init.sql`): workspaces, tres cerebros, pilares,
  momentos, conteudos com os 7 status, metricas historicas, DNA do Conteudo,
  previsoes, log de eventos, revisoes semanais e objetivos.
- Seed de desenvolvimento (`0002_seed.sql`): workspace, cerebros vazios, 9 pilares.
- Clientes Supabase (browser e server).
- Barramento de eventos (`lib/events/bus.ts`): nucleo orientado a eventos, com
  persistencia de eventos e handlers best-effort.
- Layout raiz com sidebar minimalista de 6 destinos + rodape (Cerebros, Config).
- Tela Hoje inicial com estado de onboarding honesto (sem inventar inteligencia).
- Testes do barramento de eventos (3 casos, incluindo tolerancia a falha de handler).
- README, CHANGELOG e TODO.

### Validacao
- `typecheck` limpo, `build` de producao bem-sucedido, testes 3/3 passando.
