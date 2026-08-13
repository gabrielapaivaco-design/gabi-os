"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGoal, deleteGoal, updateGoal, updateGoalProgress } from "@/lib/goals/service";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createGoalAction(formData: FormData): Promise<ActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "O titulo da meta e obrigatorio." };

  const targetRaw = String(formData.get("target") ?? "").trim();
  const target = targetRaw ? Number(targetRaw) : null;
  const quarter = String(formData.get("quarter") ?? "");

  try {
    await createGoal(createClient(), { title, target, quarter });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function bumpGoalProgressAction(
  id: string,
  currentProgress: number,
  delta: number,
): Promise<ActionResult> {
  try {
    await updateGoalProgress(createClient(), id, currentProgress + delta);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function updateGoalAction(
  id: string,
  fields: { title?: string; target?: number | null },
): Promise<ActionResult> {
  try {
    await updateGoal(createClient(), id, fields);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  try {
    await deleteGoal(createClient(), id);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
