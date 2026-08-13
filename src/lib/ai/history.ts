import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { Generation } from "./history-view";

// Acesso ao historico de tudo o que a IA gerou neste workspace: o que foi
// pedido, quanto custou em tokens, e o que voltou (inclusive as falhas). E a
// memoria do sistema sobre a propria IA — por isso precisa ser visivel e
// apagavel por quem usa, nao so por quem tem acesso ao banco.
//
// Este arquivo toca `next/headers` atraves de `getWorkspaceId`, entao so pode
// ser importado do servidor. O que a interface precisa esta em `history-view.ts`.

export type { Generation } from "./history-view";
export { KIND_LABEL, summarize } from "./history-view";

export async function listGenerations(db: SupabaseClient, limit = 100): Promise<Generation[]> {
  const { data, error } = await db
    .from("ai_generations")
    .select(
      "id, kind, provider, model, input_tokens, output_tokens, result, error, created_at, contents(title)",
    )
    .eq("workspace_id", getWorkspaceId())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    // O join devolve objeto ou array conforme a cardinalidade inferida.
    const c = row.contents as { title?: string } | { title?: string }[] | null;
    const conteudo = Array.isArray(c) ? c[0] : c;

    return {
      id: String(row.id),
      kind: String(row.kind),
      provider: String(row.provider),
      model: String(row.model),
      inputTokens: (row.input_tokens as number | null) ?? null,
      outputTokens: (row.output_tokens as number | null) ?? null,
      result: (row.result as Record<string, unknown> | null) ?? null,
      error: (row.error as string | null) ?? null,
      createdAt: String(row.created_at),
      contentTitle: conteudo?.title ?? null,
    };
  });
}

export async function deleteGeneration(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db
    .from("ai_generations")
    .delete()
    .eq("id", id)
    // Redundante com o RLS, mas mantem a regra visivel no codigo: um id vindo
    // do cliente nunca apaga registro de outro workspace.
    .eq("workspace_id", getWorkspaceId());

  if (error) throw new Error(error.message);
}

export async function clearGenerations(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .from("ai_generations")
    .delete()
    .eq("workspace_id", getWorkspaceId())
    .select("id");

  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
