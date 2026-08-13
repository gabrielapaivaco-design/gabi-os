"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteMoment, insertMoment } from "@/lib/moments/service";

export async function createMomentAction(formData: FormData): Promise<void> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await insertMoment(createClient(), body);

  revalidatePath("/momentos");
  revalidatePath("/");
}

// Devolve o erro em vez de lancar: o Next redige a mensagem de excecoes nao
// tratadas em Server Action, e "algo deu errado" nao ajuda ninguem.
export type DeleteMomentResult = { ok: true } | { ok: false; error: string };

export async function deleteMomentAction(momentId: string): Promise<DeleteMomentResult> {
  try {
    const removed = await deleteMoment(createClient(), momentId);
    if (!removed) {
      return { ok: false, error: "Momento nao encontrado. Talvez ja tenha sido excluido." };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui excluir o Momento.",
    };
  }

  revalidatePath("/momentos");
  revalidatePath("/");
  // O card no Pipeline perde o trecho do Momento de origem.
  revalidatePath("/pipeline");
  return { ok: true };
}
