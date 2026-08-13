"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { scheduleContent } from "@/lib/contents/service";
import { isoFromDayKey } from "@/lib/calendar/month";

export type ActionResult = { ok: true } | { ok: false; error: string };

// dayKey no formato "YYYY-MM-DD", ou null para desagendar.
export async function scheduleContentAction(id: string, dayKey: string | null): Promise<ActionResult> {
  try {
    await scheduleContent(createClient(), id, dayKey ? isoFromDayKey(dayKey) : null);
    revalidatePath("/calendario");
    revalidatePath("/pipeline");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
