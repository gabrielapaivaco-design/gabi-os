import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { Moment } from "@/types/db";

// Captura de Momento: grava e emite momento.criado. Sem campos extras —
// classificacao e responsabilidade de etapas futuras (IA / Pipeline).
export async function insertMoment(db: SupabaseClient, body: string): Promise<Moment> {
  const workspaceId = getWorkspaceId();
  const { data, error } = await db
    .from("moments")
    .insert({ workspace_id: workspaceId, body })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await emit(db, {
    type: "momento.criado",
    workspaceId,
    payload: { id: (data as Moment).id },
  });

  return data as Moment;
}

// Exclusao de Momento. Diferente de Conteudo (que e arquivado para preservar
// historico e metricas), um Momento e materia-prima: quando a pessoa diz que
// nao quer aquilo registrado, o registro sai do banco de verdade.
//
// Conteudos ja criados a partir dele sobrevivem: a FK e `on delete set null`,
// entao o card continua no Pipeline, apenas sem o vinculo com a origem.
//
// Devolve false quando nada foi removido (id inexistente ou de outro
// workspace) — isso e um resultado, nao um erro.
export async function deleteMoment(db: SupabaseClient, momentId: string): Promise<boolean> {
  const workspaceId = getWorkspaceId();

  // O filtro por workspace nao e redundante: o id chega do cliente e nao pode
  // servir para apagar Momento de outro workspace.
  const { data, error } = await db
    .from("moments")
    .delete()
    .eq("id", momentId)
    .eq("workspace_id", workspaceId)
    .select("id, body");

  if (error) throw new Error(error.message);

  const removed = ((data ?? []) as Pick<Moment, "id" | "body">[])[0];
  if (!removed) return false;

  // Como a linha some do banco, o evento e o unico lugar que ainda sabe que
  // esse Momento existiu — por isso guarda o texto, nao so o id.
  await emit(db, {
    type: "momento.excluido",
    workspaceId,
    payload: { id: removed.id, body: removed.body },
  });

  return true;
}
