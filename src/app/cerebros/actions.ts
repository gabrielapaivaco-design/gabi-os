"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveBrain, type BrainContent } from "@/lib/brains/service";
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
