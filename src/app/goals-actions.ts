"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGoal, deleteGoal, updateGoal, updateGoalProgress } from "@/lib/goals/service";
import { AiNotConfiguredError } from "@/lib/ai";
import { suggestQuarterGoals, quarterOf, type GoalSuggestions } from "@/lib/ai/director/goals";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SuggestGoalsResult =
  | { ok: true; suggestions: GoalSuggestions }
  | { ok: false; error: string; notConfigured?: boolean };

export async function suggestGoalsAction(
  existingTitles: string[],
): Promise<SuggestGoalsResult> {
  try {
    const suggestions = await suggestQuarterGoals(createClient(), existingTitles);
    return { ok: true, suggestions };
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return { ok: false, error: err.message, notConfigured: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui sugerir metas.",
    };
  }
}

// Aceita as metas escolhidas de uma vez. O trimestre e calculado no servidor
// para nao depender do relogio do navegador.
export async function acceptGoalsAction(
  goals: { title: string; target: number | null }[],
): Promise<ActionResult> {
  if (goals.length === 0) return { ok: false, error: "Nenhuma meta selecionada." };

  const db = createClient();
  const quarter = quarterOf(new Date());

  try {
    for (const g of goals) {
      if (!g.title.trim()) continue;
      await createGoal(db, { title: g.title.trim(), target: g.target, quarter });
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }

  revalidatePath("/");
  return { ok: true };
}

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
