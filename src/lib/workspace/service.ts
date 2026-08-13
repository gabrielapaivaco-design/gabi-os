import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkspaceId } from "@/lib/workspace/current";

// Um Workspace e a fronteira de isolamento do sistema: cada um tem os seus
// proprios Cerebros, Momentos, Conteudos, Calendario, Metricas, Objetivos,
// Configuracoes e historico de IA. Nada atravessa a fronteira.
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  settings: WorkspaceSettings;
  created_at: string;
}

// Configuracoes por workspace. Cada cliente futuro pode ter um provedor de IA
// e um tom de voz diferentes sem tocar em codigo.
export interface WorkspaceSettings {
  ai_provider?: string;
  tone?: string;
  [key: string]: unknown;
}

const WORKSPACE_FIELDS = "id, name, slug, settings, created_at";
// `slug` e `settings` chegaram na 0004. Num banco onde ela ainda nao rodou, o
// select acima falha inteiro — e o app culparia o Supabase por uma migration
// pendente. Estas colunas existem desde a 0001 e sempre funcionam.
const WORKSPACE_FIELDS_LEGACY = "id, name, created_at";

// Migration 0004 e puramente aditiva, entao a leitura tenta o schema novo e
// cai no antigo quando as colunas ainda nao existem. Assim /config funciona
// antes e depois da migration, dizendo a verdade nos dois casos.
async function selectWorkspaces(
  db: SupabaseClient,
  apply: (query: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => unknown,
): Promise<Record<string, unknown>[]> {
  const modern = (await apply(db.from("workspaces").select(WORKSPACE_FIELDS))) as {
    data: unknown;
    error: { message: string } | null;
  };
  if (!modern.error) return toRows(modern.data);

  if (!isMissingColumnError(modern.error.message)) throw new Error(modern.error.message);

  const legacy = (await apply(db.from("workspaces").select(WORKSPACE_FIELDS_LEGACY))) as {
    data: unknown;
    error: { message: string } | null;
  };
  if (legacy.error) throw new Error(legacy.error.message);
  return toRows(legacy.data);
}

function toRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  return data ? [data as Record<string, unknown>] : [];
}

function isMissingColumnError(message: string): boolean {
  return /column .* does not exist/i.test(message);
}

export async function getCurrentWorkspace(db: SupabaseClient): Promise<Workspace> {
  const id = getWorkspaceId();
  const rows = await selectWorkspaces(db, (query) => (query as any).eq("id", id).single());

  if (rows.length === 0) throw new Error("Workspace atual nao encontrado.");
  return normalize(rows[0]);
}

// Ja funciona hoje e devolve o unico workspace existente. Quando houver mais
// de um, esta e a lista que alimenta o seletor — sem mudanca aqui.
export async function listWorkspaces(db: SupabaseClient): Promise<Workspace[]> {
  const rows = await selectWorkspaces(db, (query) =>
    (query as any).order("created_at", { ascending: true }),
  );
  return rows.map(normalize);
}

// Criar workspace passa pela funcao `create_workspace` no banco, nao por
// INSERT: sao tres escritas que precisam acontecer juntas (o workspace, o
// vinculo com quem criou e os tres Cerebros vazios). Se o vinculo falhasse
// depois do insert, o workspace nasceria orfao — invisivel ate para quem
// acabou de cria-lo, porque o RLS so mostra workspace de que voce e membro.
export async function createWorkspace(
  db: SupabaseClient,
  input: { name: string; slug: string },
): Promise<Workspace> {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  if (!name) throw new Error("O nome do workspace e obrigatorio.");
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("O identificador deve conter apenas letras minusculas, numeros e hifens.");
  }

  const { data, error } = await db.rpc("create_workspace", { p_name: name, p_slug: slug });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("O banco nao devolveu o workspace criado.");

  return normalize(data as Record<string, unknown>);
}

export async function renameWorkspace(
  db: SupabaseClient,
  input: { id: string; name: string },
): Promise<Workspace> {
  const name = input.name.trim();
  if (!name) throw new Error("O nome do workspace e obrigatorio.");

  const slug = slugify(name);
  if (!slug) {
    throw new Error("Esse nome nao gera um identificador valido. Use letras ou numeros.");
  }

  const { data, error } = await db.rpc("rename_workspace", {
    p_id: input.id,
    p_name: name,
    p_slug: slug,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("O banco nao devolveu o workspace renomeado.");

  return normalize(data as Record<string, unknown>);
}

export async function deleteWorkspace(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.rpc("delete_workspace", { p_id: id });
  if (error) throw new Error(error.message);
}

// O que uma exclusao levaria junto. Existe para que a confirmacao mostre
// numeros reais em vez de um aviso generico — apagar 6 conteudos e 14 geracoes
// de IA nao e a mesma decisao que apagar um workspace vazio.
export interface WorkspaceContents {
  moments: number;
  contents: number;
  filledBrains: number;
  goals: number;
  aiGenerations: number;
}

export async function countWorkspaceContents(
  db: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceContents> {
  const contar = async (table: string): Promise<number> => {
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    // Uma contagem que falha nao pode impedir a tela de abrir; 0 e o valor
    // seguro para exibir, e a confirmacao por digitacao continua protegendo.
    return error ? 0 : (count ?? 0);
  };

  const [moments, contents, goals, aiGenerations, brains] = await Promise.all([
    contar("moments"),
    contar("contents"),
    contar("goals"),
    contar("ai_generations"),
    db.from("brains").select("content").eq("workspace_id", workspaceId),
  ]);

  const rows = (brains.data ?? []) as { content: Record<string, unknown> | null }[];
  const filledBrains = rows.filter((b) => Object.keys(b.content ?? {}).length > 0).length;

  return { moments, contents, goals, aiGenerations, filledBrains };
}

// Gera um identificador a partir do nome: "Mari Calcados" -> "mari-calcados".
// Existe para que ninguem precise entender o que e um slug para criar uma marca.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    // Remove os acentos que o NFD separou das letras.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// `settings` e `slug` chegaram na migration 0004. Um banco onde ela ainda nao
// rodou devolve as colunas ausentes — normalizar aqui evita que a UI quebre
// por causa disso, no mesmo espirito de degradacao honesta do resto do app.
function normalize(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    name: String(row.name ?? "Workspace"),
    slug: typeof row.slug === "string" ? row.slug : "",
    settings: (row.settings as WorkspaceSettings) ?? {},
    created_at: String(row.created_at ?? ""),
  };
}
