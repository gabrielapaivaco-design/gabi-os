import { createAnthropicProvider } from "./anthropic";
import { AiNotConfiguredError, type AiProvider } from "./types";

export * from "./types";

// Registro de provedores. Adicionar OpenAI ou Gemini e escrever
// lib/ai/openai.ts implementando AiProvider e acrescentar uma linha aqui —
// nenhuma outra parte do sistema muda, porque tudo consome a interface.
//
// A escolha e por variavel de ambiente (AI_PROVIDER), com Anthropic como
// padrao. Um workspace pode sobrescrever via settings.ai_provider quando
// existir mais de um provedor configurado.

interface ProviderEntry {
  envKey: string;
  create: (apiKey: string) => AiProvider;
}

const REGISTRY: Record<string, ProviderEntry> = {
  anthropic: { envKey: "ANTHROPIC_API_KEY", create: createAnthropicProvider },
};

const DEFAULT_PROVIDER = "anthropic";

export function resolveProviderName(preferred?: string): string {
  const name = preferred ?? process.env.AI_PROVIDER ?? DEFAULT_PROVIDER;
  return name in REGISTRY ? name : DEFAULT_PROVIDER;
}

// Estado consultavel sem tentar gerar nada: a UI usa isto para dizer com
// honestidade que a IA ainda nao esta ligada, em vez de oferecer um botao que
// so falha quando clicado.
export function isAiConfigured(preferred?: string): boolean {
  const entry = REGISTRY[resolveProviderName(preferred)];
  return Boolean(entry && process.env[entry.envKey]);
}

export function getAiProvider(preferred?: string): AiProvider {
  const name = resolveProviderName(preferred);
  const entry = REGISTRY[name];
  const apiKey = entry ? process.env[entry.envKey] : undefined;

  if (!entry || !apiKey) {
    throw new AiNotConfiguredError(
      `O provedor de IA "${name}" nao esta configurado. Defina ${entry?.envKey ?? "a chave da API"} em .env.local e reinicie o servidor.`,
    );
  }

  return entry.create(apiKey);
}
