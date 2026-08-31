import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkspaceId } from "@/lib/workspace/current";

// A Biblioteca: tudo que ja foi escrito neste workspace, inclusive o que foi
// arquivado.
//
// Existe por duas razoes. A primeira e memoria — "ja escrevi sobre isso?" era
// uma pergunta sem tela que respondesse. A segunda e consequencia da virada de
// mes: "Aposentar" arquiva, e sem um lugar que mostre o arquivado o botao
// pareceria um apagador. Aqui o conteudo aposentado continua encontravel, com
// o texto inteiro pronto para ser reaproveitado.
//
// Nao seleciona as colunas de identidade externa (platform, external_id,
// external_url) de proposito: elas chegaram na migration 0007 e a Biblioteca
// nao precisa delas. Pedir coluna que talvez nao exista derrubaria a consulta
// inteira por nada.

export interface LibraryItem {
  id: string;
  title: string;
  format: string | null;
  status: string;
  archived: boolean;
  pillarName: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  plannedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export async function listLibrary(db: SupabaseClient): Promise<LibraryItem[]> {
  const workspaceId = getWorkspaceId();

  const [contentsRes, pillarsRes] = await Promise.all([
    db
      .from("contents")
      .select(
        "id, title, format, status, archived, pillar_id, hook, script, caption, cta, planned_at, published_at, created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    db.from("pillars").select("id, name").eq("workspace_id", workspaceId),
  ]);

  if (contentsRes.error) throw new Error(contentsRes.error.message);

  const pilarPorId = new Map(
    ((pillarsRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  );

  return ((contentsRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    title: String(c.title ?? ""),
    format: (c.format as string | null) ?? null,
    status: String(c.status ?? "ideia"),
    archived: Boolean(c.archived),
    pillarName: c.pillar_id ? (pilarPorId.get(String(c.pillar_id)) ?? null) : null,
    hook: (c.hook as string | null) ?? null,
    script: (c.script as string | null) ?? null,
    caption: (c.caption as string | null) ?? null,
    cta: (c.cta as string | null) ?? null,
    plannedAt: (c.planned_at as string | null) ?? null,
    publishedAt: (c.published_at as string | null) ?? null,
    createdAt: String(c.created_at ?? ""),
  }));
}

// A busca e a classificacao vivem em ./filter.ts — a tela filtra no cliente, e
// nada dela pode depender deste arquivo, que alcanca `next/headers`.
