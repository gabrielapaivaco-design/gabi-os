"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveBrain, type BrainContent } from "@/lib/brains/service";
import { createPillar, deletePillar, updatePillar } from "@/lib/pillars/service";
import type { BrainKind } from "@/types/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveBrainAction(
  kind: BrainKind,
  content: BrainContent,
): Promise<ActionResult> {
  try {
    await saveBrain(createClient(), kind, content);
    revalidatePath("/cerebros");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

// Pilares. Mudar um pilar muda como o Pipeline e o Calendario pintam os cards,
// entao as tres telas sao revalidadas juntas.
function revalidarPilares(): void {
  revalidatePath("/cerebros");
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
}

export async function createPillarAction(name: string, color?: string): Promise<ActionResult> {
  try {
    await createPillar(createClient(), name, color);
    revalidarPilares();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui criar o pilar." };
  }
}

export async function updatePillarAction(
  id: string,
  campos: { name?: string; color?: string },
): Promise<ActionResult> {
  try {
    await updatePillar(createClient(), id, campos);
    revalidarPilares();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui salvar o pilar." };
  }
}

export async function deletePillarAction(id: string): Promise<ActionResult> {
  try {
    await deletePillar(createClient(), id);
    revalidarPilares();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui remover o pilar." };
  }
}
