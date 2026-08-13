import type { SupabaseClient } from "@supabase/supabase-js";

// Nucleo orientado a eventos: modulos nunca se chamam diretamente.
// Cada acao relevante vira um evento imutavel, persistido e (opcionalmente) reagido.

export type EventType =
  | "momento.criado"
  | "momento.excluido"
  | "conteudo.criado"
  | "conteudo.movido"
  | "conteudo.editado"
  | "conteudo.arquivado"
  | "conteudo.agendado"
  | "conteudo.publicado"
  | "metrica.recebida"
  | "previsao.registrada"
  | "cerebro.atualizado"
  | "ia.gerou";

export interface EmitInput {
  type: EventType;
  payload?: Record<string, unknown>;
  workspaceId: string;
}

type Handler = (e: EmitInput) => void | Promise<void>;
const handlers: Partial<Record<EventType, Handler[]>> = {};

// Assinar um tipo de evento. Handlers rodam apos a persistencia.
export function on(type: EventType, handler: Handler): void {
  (handlers[type] ??= []).push(handler);
}

// Emitir: persiste o evento e dispara os handlers registrados.
// Falha de handler nunca derruba a acao principal (best-effort, por design).
export async function emit(db: SupabaseClient, input: EmitInput): Promise<void> {
  await db.from("events").insert({
    workspace_id: input.workspaceId,
    type: input.type,
    payload: input.payload ?? {},
  });
  for (const h of handlers[input.type] ?? []) {
    try {
      await h(input);
    } catch (err) {
      console.error(`[events] handler de ${input.type} falhou:`, err);
    }
  }
}
