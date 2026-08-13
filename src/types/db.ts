// Tipos do dominio Gabi OS. Espelham o esquema em supabase/migrations/0001_init.sql.

export type BrainKind = "brand" | "business" | "learned";

export type ContentStatus =
  | "ideia" | "roteiro" | "gravar" | "editar" | "agendar" | "publicado" | "analisar";

export type Objective = "autoridade" | "venda" | "conexao" | "crescimento";

export interface Workspace { id: string; name: string; created_at: string; }

export interface Brain {
  id: string; workspace_id: string; kind: BrainKind;
  content: Record<string, unknown>; updated_at: string;
}

export interface Pillar {
  id: string; workspace_id: string; name: string; color: string; sort: number;
}

export interface Moment {
  id: string; workspace_id: string; body: string;
  processed: boolean; created_at: string;
}

export interface Content {
  id: string; workspace_id: string; moment_id: string | null;
  title: string; format: string | null; status: ContentStatus;
  pillar_id: string | null; objective: Objective | null;
  hook: string | null; script: string | null; caption: string | null; cta: string | null;
  scenes: unknown[]; planned_at: string | null; published_at: string | null;
  archived: boolean; sort: number; created_at: string; updated_at: string;
}

export interface AppEvent {
  id: string; workspace_id: string; type: string;
  payload: Record<string, unknown>; created_at: string;
}
