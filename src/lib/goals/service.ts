import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkspaceId } from "@/lib/workspace/current";

export interface Goal {
  id: string;
  title: string;
  target: number | null;
  progress: number;
  quarter: string | null;
  metric_key: string | null;
}

export async function createGoal(
  db: SupabaseClient,
  input: { title: string; target: number | null; quarter: string },
): Promise<Goal> {
  const { data, error } = await db
    .from("goals")
    .insert({
      workspace_id: getWorkspaceId(),
      title: input.title,
      target: input.target,
      quarter: input.quarter,
    })
    .select("id, title, target, progress, quarter, metric_key")
    .single();

  if (error) throw new Error(error.message);
  return data as Goal;
}

export async function updateGoalProgress(
  db: SupabaseClient,
  id: string,
  progress: number,
): Promise<void> {
  const { error } = await db
    .from("goals")
    .update({ progress: Math.max(progress, 0) })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateGoal(
  db: SupabaseClient,
  id: string,
  fields: Partial<Pick<Goal, "title" | "target">>,
): Promise<void> {
  if (fields.title !== undefined && !fields.title.trim()) {
    throw new Error("O titulo da meta nao pode ficar vazio.");
  }
  const { error } = await db.from("goals").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

// Metas nao tem coluna "archived" no schema (menos historico critico que
// Conteudo) — exclusao aqui e sempre um delete real.
export async function deleteGoal(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
