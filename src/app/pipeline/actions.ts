"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  archiveContent,
  createContent,
  reorderColumn,
  truncateTitle,
  updateContent,
  type EditableContentFields,
} from "@/lib/contents/service";
import type { ContentStatus } from "@/types/db";

export async function createContentAction(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await createContent(createClient(), { title });

  revalidatePath("/pipeline");
}

export async function createContentFromMomentAction(
  momentId: string,
  momentBody: string,
): Promise<void> {
  const title = truncateTitle(momentBody);
  if (!title) return;

  await createContent(createClient(), { title, momentId });

  revalidatePath("/pipeline");
  revalidatePath("/momentos");
}

export async function reorderColumnAction(input: {
  status: ContentStatus;
  orderedIds: string[];
  movedContentId?: string;
  movedFromStatus?: ContentStatus;
}): Promise<void> {
  await reorderColumn(createClient(), input);
  revalidatePath("/pipeline");
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// updateContentAction/archiveContentAction retornam um resultado em vez de
// lancar: o Next.js redige a mensagem de erros nao tratados de Server Actions
// ("An error occurred in the Server Components render but no message was
// provided"), entao a unica forma de mostrar o motivo real no painel e
// capturar aqui e devolver como dado serializavel.
export async function updateContentAction(
  id: string,
  fields: EditableContentFields,
): Promise<ActionResult> {
  try {
    await updateContent(createClient(), id, fields);
    revalidatePath("/pipeline");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function archiveContentAction(id: string): Promise<ActionResult> {
  try {
    await archiveContent(createClient(), id);
    revalidatePath("/pipeline");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
