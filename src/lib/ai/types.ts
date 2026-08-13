// Contrato agnostico de provedor de IA.
//
// Nada abaixo menciona Anthropic, Claude, OpenAI ou Gemini. O Diretor de
// Conteudo (lib/ai/director) conversa apenas com esta interface, entao trocar
// ou adicionar um provedor e escrever um arquivo novo em lib/ai/ e registra-lo
// em lib/ai/index.ts — nenhuma regra de negocio muda.
//
// Os conceitos escolhidos aqui sao os que todo provedor moderno tem de alguma
// forma (prompt de sistema, turnos, teto de saida, esforco, saida estruturada).
// Detalhes especificos de cada API ficam dentro da implementacao.

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

// "esforco" e um conceito portavel: quanto o modelo deve investir na resposta.
// Cada provedor mapeia para o que tiver (parametro nativo, escolha de modelo,
// ou simplesmente ignora).
export type AiEffort = "low" | "medium" | "high";

export interface AiGenerateRequest {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  effort?: AiEffort;
  // JSON Schema da saida esperada. Provedores que suportam saida estruturada
  // nativa usam; os demais precisam instruir via prompt e validar.
  jsonSchema?: Record<string, unknown>;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiGenerateResult {
  text: string;
  // Preenchido quando `jsonSchema` foi informado e a resposta pode ser lida.
  parsed: unknown | null;
  usage: AiUsage;
  provider: string;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}

// Nenhuma chave configurada. Nao e um erro de execucao — e um estado esperado
// do sistema, que a UI mostra com honestidade em vez de quebrar.
export class AiNotConfiguredError extends Error {
  constructor(message = "Nenhum provedor de IA esta configurado.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

// Falha real na chamada (rede, rate limit, recusa, resposta ilegivel). A
// mensagem ja vem pronta para ser mostrada a usuaria.
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
