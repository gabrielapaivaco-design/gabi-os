import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiProvider, AiProviderError, type AiGenerateResult } from "@/lib/ai";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import { buildContentContext, renderContextForPrompt } from "./context";
import { DIRECTOR_SYSTEM, TASK_PROMPTS, TASK_SCHEMAS, type DirectorTask } from "./prompts";

export type { DirectorTask } from "./prompts";

// O Diretor de Conteudo: orquestra motor de contexto -> prompt -> provedor de
// IA -> resultado tipado -> auditoria. Nao conhece a Anthropic; fala apenas
// com a interface AiProvider, entao trocar de provedor nao encosta neste
// arquivo.

export interface ScriptDraft {
  hook: string;
  script: string;
}
export interface CaptionDraft {
  caption: string;
  cta: string;
}
export interface IdeaSuggestion {
  title: string;
  format: string;
  angle: string;
}
export interface ContentAnalysis {
  strengths: string[];
  risks: string[];
  suggestions: string[];
}

export type DirectorOutput =
  | { task: "roteiro"; data: ScriptDraft }
  | { task: "legenda"; data: CaptionDraft }
  | { task: "ideias"; data: { ideas: IdeaSuggestion[] } }
  | { task: "analise"; data: ContentAnalysis };

export async function runDirector(
  db: SupabaseClient,
  contentId: string,
  task: DirectorTask,
): Promise<DirectorOutput> {
  const provider = getAiProvider();
  const context = await buildContentContext(db, contentId);

  let result: AiGenerateResult;
  try {
    result = await provider.generate({
      system: DIRECTOR_SYSTEM,
      messages: [
        {
          role: "user",
          content: `${renderContextForPrompt(context)}\n\n---\n\n# Tarefa\n${TASK_PROMPTS[task]}`,
        },
      ],
      jsonSchema: TASK_SCHEMAS[task],
      effort: "high",
    });
  } catch (err) {
    // A falha tambem e auditada: sem isso, um problema recorrente com um
    // provedor ficaria invisivel no historico.
    await logGeneration(db, {
      contentId,
      task,
      provider: provider.name,
      model: provider.model,
      error: err instanceof Error ? err.message : "Erro desconhecido.",
    });
    throw err;
  }

  const data = parseOutput(task, result.parsed);

  await logGeneration(db, {
    contentId,
    task,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    result: data as unknown as Record<string, unknown>,
  });

  await emit(db, {
    type: "ia.gerou",
    workspaceId: getWorkspaceId(),
    payload: { content_id: contentId, task, model: result.model },
  });

  return { task, data } as DirectorOutput;
}

// A saida estruturada garante JSON valido no formato do schema, mas a resposta
// ainda pode chegar truncada por teto de tokens. Validar aqui converte isso em
// uma mensagem util em vez de um campo `undefined` silencioso na UI.
function parseOutput(task: DirectorTask, parsed: unknown): DirectorOutput["data"] {
  if (!parsed || typeof parsed !== "object") {
    throw new AiProviderError("A IA devolveu uma resposta que nao consegui interpretar.");
  }
  const value = parsed as Record<string, unknown>;

  switch (task) {
    case "roteiro":
      requireStrings(value, ["hook", "script"]);
      return { hook: String(value.hook), script: String(value.script) };
    case "legenda":
      requireStrings(value, ["caption", "cta"]);
      return { caption: String(value.caption), cta: String(value.cta) };
    case "ideias": {
      if (!Array.isArray(value.ideas)) {
        throw new AiProviderError("A IA nao devolveu a lista de ideias.");
      }
      return {
        ideas: (value.ideas as Record<string, unknown>[]).map((i) => ({
          title: String(i.title ?? ""),
          format: String(i.format ?? ""),
          angle: String(i.angle ?? ""),
        })),
      };
    }
    case "analise":
      return {
        strengths: toStringArray(value.strengths),
        risks: toStringArray(value.risks),
        suggestions: toStringArray(value.suggestions),
      };
  }
}

function requireStrings(value: Record<string, unknown>, keys: string[]): void {
  for (const key of keys) {
    if (typeof value[key] !== "string" || !value[key]) {
      throw new AiProviderError(`A IA devolveu uma resposta incompleta (faltou "${key}").`);
    }
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

// Auditoria por workspace: custo, historico e materia-prima futura do Learned
// Brain. Nunca derruba a geracao — se o log falhar, o resultado ainda vale.
async function logGeneration(
  db: SupabaseClient,
  entry: {
    contentId: string;
    task: string;
    provider: string;
    model: string;
    usage?: { inputTokens: number; outputTokens: number };
    result?: Record<string, unknown>;
    error?: string;
  },
): Promise<void> {
  try {
    await db.from("ai_generations").insert({
      workspace_id: getWorkspaceId(),
      content_id: entry.contentId,
      kind: entry.task,
      provider: entry.provider,
      model: entry.model,
      input_tokens: entry.usage?.inputTokens ?? null,
      output_tokens: entry.usage?.outputTokens ?? null,
      result: entry.result ?? null,
      error: entry.error ?? null,
    });
  } catch {
    // Tabela ausente (migration 0004 nao rodada) ou banco indisponivel.
  }
}
