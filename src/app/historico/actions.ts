"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clearGenerations, deleteGeneration } from "@/lib/ai/history";

export type HistoryActionResult = { ok: true; removed?: number } | { ok: false; error: string };

export async function deleteGenerationAction(id: string): Promise<HistoryActionResult> {
  try {
    await deleteGeneration(createClient(), id);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui excluir esse registro.",
    };
  }
  revalidatePath("/historico");
  return { ok: true };
}

export async function clearGenerationsAction(confirmacao: string): Promise<HistoryActionResult> {
  // Reconferido no servidor: o botao desabilitado na tela e sugestao, nao
  // protecao — a action e alcancavel sem passar pela interface.
  if (confirmacao.trim().toLowerCase() !== "limpar") {
    return { ok: false, error: 'Digite "limpar" para confirmar.' };
  }

  let removed: number;
  try {
    removed = await clearGenerations(createClient());
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui limpar o historico.",
    };
  }

  revalidatePath("/historico");
  return { ok: true, removed };
}
