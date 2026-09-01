import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkspaceId } from "@/lib/workspace/current";
import { PILLAR_COLORS } from "@/lib/utils/constants";

// Pilares: os assuntos recorrentes da marca.
//
// Ate agora eles so podiam nascer de migration, e por isso a Eisen Haus tinha
// zero — nao havia tela para criar. O efeito nao era estetico: o Diretor
// aprende por pilar, entao sem pilar ele so chega em "Reel funciona" e nunca em
// "Reel de bastidor funciona, Reel de venda nao", que e a parte que muda
// decisao.

export interface Pillar {
  id: string;
  name: string;
  color: string;
  sort: number;
  // Quantos conteudos usam este pilar. Existe para a tela poder avisar antes de
  // remover, em vez de descobrir depois.
  usos: number;
}

export async function listPillars(db: SupabaseClient): Promise<Pillar[]> {
  const workspaceId = getWorkspaceId();

  const [pillarsRes, contentsRes] = await Promise.all([
    db
      .from("pillars")
      .select("id, name, color, sort")
      .eq("workspace_id", workspaceId)
      .order("sort", { ascending: true }),
    db.from("contents").select("pillar_id").eq("workspace_id", workspaceId).not("pillar_id", "is", null),
  ]);

  if (pillarsRes.error) throw new Error(pillarsRes.error.message);

  const usos = new Map<string, number>();
  for (const c of (contentsRes.data ?? []) as { pillar_id: string }[]) {
    usos.set(c.pillar_id, (usos.get(c.pillar_id) ?? 0) + 1);
  }

  return ((pillarsRes.data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    color: String(p.color ?? "gray"),
    sort: Number(p.sort ?? 0),
    usos: usos.get(String(p.id)) ?? 0,
  }));
}

export async function createPillar(
  db: SupabaseClient,
  name: string,
  color?: string,
): Promise<void> {
  const workspaceId = getWorkspaceId();
  const nome = name.trim();
  if (!nome) throw new Error("O pilar precisa de um nome.");

  const { data: existentes, error: errLer } = await db
    .from("pillars")
    .select("name, sort")
    .eq("workspace_id", workspaceId);
  if (errLer) throw new Error(errLer.message);

  const lista = (existentes ?? []) as { name: string; sort: number }[];

  // Nome repetido nao e bloqueado pelo banco, e dois pilares com o mesmo nome
  // tornam impossivel ler qualquer analise por pilar.
  if (lista.some((p) => p.name.trim().toLowerCase() === nome.toLowerCase())) {
    throw new Error(`Ja existe um pilar chamado "${nome}".`);
  }

  const { error } = await db.from("pillars").insert({
    workspace_id: workspaceId,
    name: nome,
    // Sem cor escolhida, pega a proxima da paleta em vez de deixar tudo cinza:
    // a cor e o que distingue os pilares no Calendario e no Pipeline.
    color: color ?? PILLAR_COLORS[lista.length % PILLAR_COLORS.length],
    sort: lista.reduce((max, p) => Math.max(max, p.sort ?? 0), -1) + 1,
  });
  if (error) throw new Error(error.message);
}

export async function updatePillar(
  db: SupabaseClient,
  id: string,
  campos: { name?: string; color?: string },
): Promise<void> {
  const patch: Record<string, string> = {};

  if (campos.name !== undefined) {
    const nome = campos.name.trim();
    if (!nome) throw new Error("O pilar precisa de um nome.");
    patch.name = nome;
  }
  if (campos.color !== undefined) patch.color = campos.color;
  if (Object.keys(patch).length === 0) return;

  const { error } = await db
    .from("pillars")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", getWorkspaceId());
  if (error) throw new Error(error.message);
}

// Remover e definitivo, mas nao destrutivo: a chave em contents e
// `on delete set null`, entao os conteudos continuam existindo — perdem so a
// classificacao. A tela avisa quantos serao afetados antes.
export async function deletePillar(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db
    .from("pillars")
    .delete()
    .eq("id", id)
    .eq("workspace_id", getWorkspaceId());
  if (error) throw new Error(error.message);
}
