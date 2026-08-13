import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { MonthlyPlan, PlannedItem } from "@/lib/ai/director/planner";

// Persistencia do plano mensal. A proposta vive em `monthly_plans` com
// `approved = false` ate a pessoa aceitar; so entao vira Conteudo de verdade
// no Pipeline. Enquanto nao for aprovada, ela pode ser regerada a vontade sem
// sujar o Pipeline com cards que ninguem pediu.

// O item guardado carrega o id do Momento ja resolvido. A IA devolve um indice
// relativo a lista que ela viu; guardar so o indice tornaria o plano
// impossivel de aplicar depois, porque a lista muda a cada geracao.
export interface StoredItem extends PlannedItem {
  momentId: string | null;
}

export interface StoredPlan {
  diagnosis: string;
  focus: string;
  items: StoredItem[];
  approved: boolean;
  generatedAt: string;
}

export async function saveMonthlyPlan(
  db: SupabaseClient,
  period: { year: number; month: number },
  plan: MonthlyPlan,
  momentIds: string[],
): Promise<void> {
  const items: StoredItem[] = plan.items.map((i) => ({
    ...i,
    momentId: i.momentIndex >= 0 && i.momentIndex < momentIds.length ? momentIds[i.momentIndex] : null,
  }));

  const { error } = await db.from("monthly_plans").upsert(
    {
      workspace_id: getWorkspaceId(),
      year: period.year,
      // O banco guarda o mes de 1 a 12; o codigo usa o mes do JS, de 0 a 11.
      month: period.month + 1,
      plan: { diagnosis: plan.diagnosis, focus: plan.focus, items },
      approved: false,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,year,month" },
  );

  if (error) throw new Error(error.message);
}

export async function loadMonthlyPlan(
  db: SupabaseClient,
  period: { year: number; month: number },
): Promise<StoredPlan | null> {
  const { data, error } = await db
    .from("monthly_plans")
    .select("plan, approved, generated_at")
    .eq("workspace_id", getWorkspaceId())
    .eq("year", period.year)
    .eq("month", period.month + 1)
    .maybeSingle();

  if (error || !data) return null;

  const p = (data.plan ?? {}) as Record<string, unknown>;
  return {
    diagnosis: String(p.diagnosis ?? ""),
    focus: String(p.focus ?? ""),
    items: Array.isArray(p.items) ? (p.items as StoredItem[]) : [],
    approved: !!data.approved,
    generatedAt: String(data.generated_at ?? ""),
  };
}

// Aprovar materializa o plano: cada item vira um Conteudo em "Ideia" com data e
// hora agendadas. Depois disso o plano fica marcado como aprovado, para nao
// criar os mesmos cards duas vezes.
export async function approveMonthlyPlan(
  db: SupabaseClient,
  period: { year: number; month: number },
): Promise<number> {
  const workspaceId = getWorkspaceId();
  const plan = await loadMonthlyPlan(db, period);

  if (!plan) throw new Error("Nao ha plano gerado para este mes.");
  if (plan.approved) throw new Error("Este plano ja foi aprovado.");
  if (plan.items.length === 0) throw new Error("O plano nao tem nenhum conteudo.");

  // Pilar chega por nome (a IA nao conhece uuid); aqui vira id.
  const { data: pillars } = await db
    .from("pillars")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const porNome = new Map(
    (pillars ?? []).map((p: { id: string; name: string }) => [p.name.toLowerCase(), p.id]),
  );

  const OBJETIVOS = ["autoridade", "venda", "conexao", "crescimento"];
  const ultimoDia = new Date(period.year, period.month + 1, 0).getDate();

  const rows = plan.items.map((item, i) => {
    const dia = Math.min(Math.max(Math.round(item.day) || 1, 1), ultimoDia);
    const hora = Math.min(Math.max(Math.round(item.hour) || 12, 0), 23);

    return {
      workspace_id: workspaceId,
      moment_id: item.momentId,
      title: item.title || "Sem titulo",
      format: item.format || null,
      status: "ideia" as const,
      pillar_id: porNome.get(item.pillar.toLowerCase()) ?? null,
      objective: OBJETIVOS.includes(item.objective) ? item.objective : null,
      hook: item.hook || null,
      planned_at: new Date(period.year, period.month, dia, hora, 0, 0).toISOString(),
      sort: i,
    };
  });

  const { data: created, error } = await db.from("contents").insert(rows).select("id");
  if (error) throw new Error(error.message);

  const { error: updErr } = await db
    .from("monthly_plans")
    .update({ approved: true })
    .eq("workspace_id", workspaceId)
    .eq("year", period.year)
    .eq("month", period.month + 1);
  if (updErr) throw new Error(updErr.message);

  await emit(db, {
    type: "conteudo.criado",
    workspaceId,
    payload: { origem: "planejamento", quantidade: (created ?? []).length },
  });

  return (created ?? []).length;
}
