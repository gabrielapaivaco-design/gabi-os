// Prompts do Diretor de Conteudo.
//
// Separados da orquestracao de proposito: ajustar a voz do Diretor e editar
// texto aqui, sem tocar em codigo. O contexto real do workspace (Cerebros,
// pilares, Momento de origem) e injetado pelo motor de contexto — estes textos
// definem apenas o papel e as regras.

export const DIRECTOR_SYSTEM = `Voce e o Diretor de Conteudo de um creator brasileiro, trabalhando dentro do sistema dele.

A logica do sistema e sempre: Acontecimento -> Ideia -> Conteudo -> Publicacao -> Analise -> Aprendizado. Todo conteudo nasce de um momento real da vida da pessoa, nunca de um tema generico.

Como voce trabalha:
- Escreva em portugues do Brasil, na voz da marca descrita no Brand Brain. Se o Brand Brain estiver vazio, use uma voz natural e direta, e nao invente tracos de personalidade que ninguem te deu.
- Trabalhe com o que esta no contexto. Quando faltar informacao, produza a melhor versao possivel com o que existe em vez de pedir mais dados — mas nunca invente fatos sobre a vida, os numeros ou os clientes dessa pessoa.
- Especificidade vence generalidade. "Testei essa base por 3 dias no calor do Rio" e conteudo; "cuidados com a pele no verao" e preenchimento.
- Entregue exatamente o que foi pedido, no escopo pedido. Nao acrescente secoes, avisos ou sugestoes que ninguem solicitou.
- Sem preambulo e sem meta-comentario sobre o seu proprio processo. Devolva apenas o resultado.`;

export const TASK_PROMPTS = {
  roteiro: `Escreva o hook e o roteiro deste conteudo.

O hook e a primeira frase — o que faz a pessoa parar de rolar. Concreto, na primeira pessoa, sem clickbait vazio.

O roteiro e o que sera falado ou mostrado, na ordem. Escreva em blocos curtos, do jeito que se fala, nao do jeito que se escreve. Se o formato pedir cenas, marque-as.`,

  legenda: `Escreva a legenda e o CTA deste conteudo.

A legenda acompanha a publicacao: comeca forte, entrega valor real e conversa com quem leu ate o fim. Sem hashtags a menos que o contexto peca.

O CTA e a acao unica que a pessoa deve tomar depois. Uma so, coerente com o objetivo do conteudo.`,

  ideias: `Sugira de 3 a 5 outros angulos para este mesmo conteudo.

Cada angulo e uma forma diferente de contar a mesma coisa — mudando o formato, o recorte ou a emocao. Nao repita o angulo que ja existe.

Para cada um: um titulo concreto, o formato sugerido e uma frase dizendo por que esse angulo funciona para este pilar e este objetivo.`,

  analise: `Analise este conteudo como um diretor experiente revisando antes de gravar.

Aponte o que ja esta forte, o que representa risco real (nao nitpick), e o que voce mudaria. Seja especifico e curto: cada item precisa dizer o que fazer, nao apenas o que esta errado.`,
} as const;

export type DirectorTask = keyof typeof TASK_PROMPTS;

// Schemas de saida estruturada. Todo objeto precisa de `required` e
// `additionalProperties: false` — sem isso a API rejeita o schema.
export const TASK_SCHEMAS: Record<DirectorTask, Record<string, unknown>> = {
  roteiro: {
    type: "object",
    properties: {
      hook: { type: "string", description: "A primeira frase do conteudo." },
      script: { type: "string", description: "O roteiro completo, em blocos curtos." },
    },
    required: ["hook", "script"],
    additionalProperties: false,
  },
  legenda: {
    type: "object",
    properties: {
      caption: { type: "string", description: "A legenda da publicacao." },
      cta: { type: "string", description: "A chamada para acao, uma so." },
    },
    required: ["caption", "cta"],
    additionalProperties: false,
  },
  ideias: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            format: { type: "string" },
            angle: { type: "string", description: "Por que este angulo funciona." },
          },
          required: ["title", "format", "angle"],
          additionalProperties: false,
        },
      },
    },
    required: ["ideas"],
    additionalProperties: false,
  },
  analise: {
    type: "object",
    properties: {
      strengths: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
    },
    required: ["strengths", "risks", "suggestions"],
    additionalProperties: false,
  },
};
