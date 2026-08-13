import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { BrainKind } from "@/types/db";

// Os tres Cerebros de um workspace. Cada um e um documento livre de secoes
// nomeadas (titulo -> texto), guardado em brains.content como JSONB.
//
// A estrutura e deliberadamente aberta: as secoes abaixo sao um ponto de
// partida sugerido, nao um esquema fixo. A usuaria renomeia, remove e cria
// secoes conforme a marca dela pede — e o Diretor de Conteudo le o que existir.

export const BRAIN_LABEL: Record<BrainKind, string> = {
  brand: "Brand Brain",
  business: "Business Brain",
  learned: "Learned Brain",
};

export const BRAIN_DESCRIPTION: Record<BrainKind, string> = {
  brand: "Quem e a marca: voz, valores, temas, o que ela nunca faria.",
  business: "Como o negocio funciona: ofertas, precos, publico, metas comerciais.",
  learned: "O que a pratica ensinou: o que funcionou, o que nao funcionou, e por que.",
};

// Secoes sugeridas ao abrir um Cerebro vazio. Servem de andaime para a usuaria
// preencher — nenhuma delas e obrigatoria.
export const SUGGESTED_SECTIONS: Record<BrainKind, string[]> = {
  brand: ["Voz e tom", "Valores", "Temas centrais", "O que nunca fariamos"],
  business: ["Ofertas", "Publico", "Diferencial", "Metas do trimestre"],
  learned: ["O que funcionou", "O que nao funcionou", "Padroes observados"],
};

export type BrainContent = Record<string, string>;

export async function loadBrains(db: SupabaseClient): Promise<Record<BrainKind, BrainContent>> {
  const workspaceId = getWorkspaceId();
  const { data, error } = await db
    .from("brains")
    .select("kind, content")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const brains: Record<BrainKind, BrainContent> = { brand: {}, business: {}, learned: {} };
  for (const row of (data ?? []) as { kind: BrainKind; content: unknown }[]) {
    brains[row.kind] = normalizeContent(row.content);
  }
  return brains;
}

export async function saveBrain(
  db: SupabaseClient,
  kind: BrainKind,
  content: BrainContent,
): Promise<void> {
  const workspaceId = getWorkspaceId();

  // Secoes vazias nao sao gravadas: o Cerebro guarda o que a pessoa escreveu,
  // e um titulo sem conteudo so poluiria o contexto enviado a IA.
  const cleaned: BrainContent = {};
  for (const [section, text] of Object.entries(content)) {
    const title = section.trim();
    const body = text.trim();
    if (title && body) cleaned[title] = body;
  }

  // upsert pelo par (workspace_id, kind), que ja e unico no schema: cria o
  // Cerebro se o workspace ainda nao tiver aquele registro.
  const { error } = await db
    .from("brains")
    .upsert(
      { workspace_id: workspaceId, kind, content: cleaned, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,kind" },
    );

  if (error) throw new Error(error.message);

  await emit(db, {
    type: "cerebro.atualizado",
    workspaceId,
    payload: { kind, sections: Object.keys(cleaned) },
  });
}

// brains.content e JSONB livre: aceita qualquer forma. Só pares
// titulo -> texto viram secoes; o resto e descartado em vez de quebrar a UI.
function normalizeContent(raw: unknown): BrainContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: BrainContent = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
