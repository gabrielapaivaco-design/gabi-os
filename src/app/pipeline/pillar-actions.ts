"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AiNotConfiguredError } from "@/lib/ai";
import { getWorkspaceId } from "@/lib/workspace/current";
import { applyPillars, suggestPillars, type PilarSugerido } from "@/lib/ai/director/classify";

export type SugerirResult =
  | { ok: true; sugestoes: PilarSugerido[] }
  | { ok: false; error: string; notConfigured?: boolean };

export async function sugerirPilaresAction(): Promise<SugerirResult> {
  try {
    const db = createClient();
    const workspaceId = getWorkspaceId();

    const [semPilar, pilares] = await Promise.all([
      db
        .from("contents")
        .select("id, title, hook, format")
        .eq("workspace_id", workspaceId)
        .eq("archived", false)
        .is("pillar_id", null)
        .order("created_at", { ascending: false })
        // Teto para nao mandar o acervo inteiro num prompt so. Ela roda de novo
        // se sobrar — e uma lista de revisao maior que isto ninguem confere.
        .limit(40),
      db.from("pillars").select("id, name").eq("workspace_id", workspaceId).order("sort"),
    ]);

    if (semPilar.error) throw new Error(semPilar.error.message);
    if (pilares.error) throw new Error(pilares.error.message);

    const itens = (semPilar.data ?? []) as {
      id: string;
      title: string;
      hook: string | null;
      format: string | null;
    }[];

    if (itens.length === 0) {
      return { ok: false, error: "Todos os conteudos ja tem pilar." };
    }

    const sugestoes = await suggestPillars(
      db,
      itens,
      (pilares.data ?? []) as { id: string; name: string }[],
    );

    return { ok: true, sugestoes };
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return { ok: false, error: err.message, notConfigured: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui sugerir os pilares.",
    };
  }
}

export type AplicarResult = { ok: true; gravados: number } | { ok: false; error: string };

export async function aplicarPilaresAction(
  pares: { contentId: string; pillarId: string }[],
): Promise<AplicarResult> {
  try {
    const gravados = await applyPillars(createClient(), pares);
    // O pilar pinta o card no Pipeline, a cor no Calendario e a bolinha na tela
    // Hoje; e passa a agrupar as Metricas.
    revalidatePath("/pipeline");
    revalidatePath("/calendario");
    revalidatePath("/metricas");
    revalidatePath("/");
    return { ok: true, gravados };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui gravar os pilares.",
    };
  }
}
