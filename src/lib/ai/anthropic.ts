import Anthropic from "@anthropic-ai/sdk";
import {
  AiProviderError,
  type AiGenerateRequest,
  type AiGenerateResult,
  type AiProvider,
  type AiTier,
} from "./types";

// Implementacao Anthropic do contrato em ./types. Tudo que e especifico da
// API do Claude fica confinado neste arquivo.

// Os dois niveis, traduzidos para modelos. Opus 5 custa 5/25 dolares por milhao
// de tokens (entrada/saida); Sonnet 5 custa 2/10 — dois e meio a menos nas duas
// pontas. Como o sistema manda o contexto inteiro (Cerebros, Momentos, posts)
// em toda chamada, a entrada e o lado que pesa.
const MODELS: Record<AiTier, string> = {
  best: "claude-opus-5",
  efficient: "claude-sonnet-5",
};

const DEFAULT_TIER: AiTier = "best";
// Teto de saida. Cobre pensamento + texto: no Claude Opus 5 o pensamento
// adaptativo esta ligado por padrao e consome deste mesmo orcamento, entao um
// valor apertado trunca a resposta no meio. 16k e o teto seguro para
// requisicoes sem streaming (acima disso o risco e timeout de HTTP).
const DEFAULT_MAX_TOKENS = 16000;

export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    modelFor: (tier?: AiTier) => MODELS[tier ?? DEFAULT_TIER],

    async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
      try {
        const params = {
          model: MODELS[request.tier ?? DEFAULT_TIER],
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.system,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          // Pensamento adaptativo: o modelo decide sozinho quanto pensar por
          // pedido. Explicito aqui por clareza — e o padrao no Opus 5.
          thinking: { type: "adaptive" as const },
          output_config: {
            effort: request.effort ?? "high",
            ...(request.jsonSchema
              ? { format: { type: "json_schema" as const, schema: request.jsonSchema } }
              : {}),
          },
        };

        // Se os classificadores de seguranca recusarem o pedido, a API
        // reexecuta em um modelo de fallback dentro da mesma chamada em vez de
        // devolver a recusa. "default" deixa a Anthropic escolher o substituto
        // por categoria, entao nao ha modelo fixado para migrar depois.
        //
        // O fallback e uma rede de seguranca, nao um requisito: se a conta nao
        // tiver acesso a esse beta, geramos sem ele em vez de deixar a IA
        // inteira fora do ar por causa de um extra.
        let response;
        try {
          response = await client.beta.messages.create({
            ...params,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          });
        } catch (err) {
          if (!isUnsupportedParamError(err)) throw err;
          response = await client.beta.messages.create(params);
        }

        // stop_reason vem antes do conteudo: numa recusa `content` pode estar
        // vazio, e ler content[0] direto quebraria.
        if (response.stop_reason === "refusal") {
          throw new AiProviderError(
            "O modelo recusou este pedido por politica de conteudo. Reformule e tente de novo.",
          );
        }

        const text = response.content
          .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();

        if (!text) {
          throw new AiProviderError(
            response.stop_reason === "max_tokens"
              ? "A resposta foi cortada antes de gerar texto. Tente um pedido mais curto."
              : "O modelo devolveu uma resposta vazia.",
          );
        }

        return {
          text,
          parsed: request.jsonSchema ? safeParse(text) : null,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          provider: "anthropic",
          model: response.model,
        };
      } catch (err) {
        throw translateError(err);
      }
    },
  };
}

// A conta pode nao ter acesso ao beta de fallback. A API sinaliza isso com um
// 400 citando o parametro ou o beta — distinto de uma falha real da geracao,
// que deve continuar subindo.
function isUnsupportedParamError(err: unknown): boolean {
  if (!(err instanceof Anthropic.BadRequestError)) return false;
  return /fallback|beta/i.test(err.message);
}

// Com `output_config.format` a resposta e garantidamente JSON valido, mas um
// corte por max_tokens ainda pode entregar JSON truncado — por isso o parse
// nunca derruba a chamada.
function safeParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Erros do SDK viram mensagens que a usuaria entende. Classes tipadas, do mais
// especifico para o mais generico — nunca comparando strings de mensagem.
function translateError(err: unknown): Error {
  if (err instanceof AiProviderError) return err;

  if (err instanceof Anthropic.AuthenticationError) {
    return new AiProviderError(
      "A chave da API da Anthropic foi recusada. Confira ANTHROPIC_API_KEY em .env.local.",
    );
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new AiProviderError("Esta chave da Anthropic nao tem acesso ao modelo usado.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiProviderError("Limite de uso da Anthropic atingido. Tente de novo em instantes.", true);
  }
  // Em TypeScript APIConnectionError herda de APIError — precisa vir antes.
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiProviderError("Nao consegui falar com a Anthropic. Confira sua conexao.", true);
  }
  if (err instanceof Anthropic.APIError) {
    const retryable = typeof err.status === "number" && err.status >= 500;
    return new AiProviderError(`A Anthropic respondeu com erro: ${err.message}`, retryable);
  }

  return new AiProviderError(err instanceof Error ? err.message : "Erro desconhecido ao chamar a IA.");
}
