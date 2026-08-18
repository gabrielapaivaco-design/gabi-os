"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markPublished } from "@/lib/metrics/service";

export type PublishResult = { ok: true } | { ok: false; error: string };

export async function markPublishedAction(
  contentId: string,
  input: { platform?: string | null; externalId?: string | null; url?: string | null },
): Promise<PublishResult> {
  try {
    await markPublished(createClient(), contentId, input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui marcar como publicado.",
    };
  }

  revalidatePath("/pipeline");
  revalidatePath("/conciliacao");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}
