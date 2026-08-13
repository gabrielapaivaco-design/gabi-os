import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { Content, ContentStatus } from "@/types/db";

const TITLE_MAX = 60;

// Titulo provisorio a partir do corpo do Momento — sem etapa extra de edicao.
export function truncateTitle(body: string, max = TITLE_MAX): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

// Todo conteudo novo nasce em "ideia" (Acontecimento -> Ideia -> Conteudo...).
// O sort e calculado no servidor (posicao ao final da coluna Ideia) para nao
// depender do estado do cliente, que pode estar desatualizado.
export async function createContent(
  db: SupabaseClient,
  input: { title: string; momentId?: string },
): Promise<Content> {
  const workspaceId = getWorkspaceId();
  const { count } = await db
    .from("contents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "ideia")
    .eq("archived", false);

  const { data, error } = await db
    .from("contents")
    .insert({
      workspace_id: workspaceId,
      title: input.title,
      moment_id: input.momentId ?? null,
      sort: count ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await emit(db, {
    type: "conteudo.criado",
    workspaceId,
    payload: { id: (data as Content).id, moment_id: input.momentId ?? null },
  });

  return data as Content;
}

// Persiste a ordem final de uma coluna apos um drag: status + sort (indice) de
// cada card nela. Emite conteudo.movido apenas quando o card arrastado troca
// de status (reordenar dentro da mesma coluna nao e uma "movimentacao").
export async function reorderColumn(
  db: SupabaseClient,
  input: {
    status: ContentStatus;
    orderedIds: string[];
    movedContentId?: string;
    movedFromStatus?: ContentStatus;
  },
): Promise<void> {
  await Promise.all(
    input.orderedIds.map((id, index) =>
      db.from("contents").update({ status: input.status, sort: index }).eq("id", id),
    ),
  );

  if (
    input.movedContentId &&
    input.movedFromStatus &&
    input.movedFromStatus !== input.status
  ) {
    await emit(db, {
      type: "conteudo.movido",
      workspaceId: getWorkspaceId(),
      payload: { id: input.movedContentId, from: input.movedFromStatus, to: input.status },
    });
  }
}

export type EditableContentFields = Partial<
  Pick<Content, "title" | "format" | "objective" | "pillar_id" | "hook" | "script" | "caption" | "cta">
>;

// Edicao livre do card. Titulo vazio e rejeitado antes de tocar no banco —
// e o unico campo obrigatorio do dominio.
export async function updateContent(
  db: SupabaseClient,
  id: string,
  fields: EditableContentFields,
): Promise<Content> {
  if (fields.title !== undefined && !fields.title.trim()) {
    throw new Error("O titulo nao pode ficar vazio.");
  }

  const { data, error } = await db
    .from("contents")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await emit(db, {
    type: "conteudo.editado",
    workspaceId: getWorkspaceId(),
    payload: { id, fields: Object.keys(fields) },
  });

  return data as Content;
}

// Agendamento no Calendario. `plannedAt = null` desagenda (volta o card para
// a lista de nao planejados). Emite conteudo.agendado so quando ha data.
export async function scheduleContent(
  db: SupabaseClient,
  id: string,
  plannedAt: string | null,
): Promise<void> {
  const { error } = await db
    .from("contents")
    .update({ planned_at: plannedAt, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (plannedAt) {
    await emit(db, {
      type: "conteudo.agendado",
      workspaceId: getWorkspaceId(),
      payload: { id, planned_at: plannedAt },
    });
  }
}

// Exclusao e sempre arquivamento (archived = true) — nunca um delete fisico.
// Preserva o historico para o barramento de eventos e para o DNA do Conteudo.
export async function archiveContent(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("contents").update({ archived: true }).eq("id", id);
  if (error) throw new Error(error.message);

  await emit(db, {
    type: "conteudo.arquivado",
    workspaceId: getWorkspaceId(),
    payload: { id },
  });
}
