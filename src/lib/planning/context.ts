import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { BrainKind, ContentStatus, Objective } from "@/types/db";

// Motor de Contexto: monta, em uma unica estrutura, todo o cenario que o
// Diretor de Conteudo precisa para planejar um mes. Nenhuma chamada de IA
// acontece aqui — esta camada so LE e AGREGA. A geracao em si (prompt +
// chamada ao Claude) e uma etapa separada, ainda nao implementada, e vai
// consumir exatamente este objeto.
//
// Todo o contexto e sempre de um unico workspace. Quando existirem varios
// (Eisen Haus, Mari Calcados), cada um monta o seu proprio cenario sem
// nenhuma mudanca aqui — o `workspaceId` ja atravessa todas as consultas.

export interface PlanningContext {
  workspaceId: string;
  period: { year: number; month: number };
  brains: Record<BrainKind, Record<string, unknown>>;
  pillars: { id: string; name: string; color: string }[];
  objectives: {
    id: string;
    title: string;
    target: number | null;
    progress: number;
    quarter: string | null;
  }[];
  recentMoments: { id: string; body: string; created_at: string; converted: boolean }[];
  contentHistory: {
    id: string;
    title: string;
    status: ContentStatus;
    format: string | null;
    objective: Objective | null;
    pillar_id: string | null;
    published_at: string | null;
  }[];
  alreadyPlanned: { id: string; title: string; planned_at: string }[];
  metrics: {
    content_id: string | null;
    reach: number | null;
    retention: number | null;
    saves: number | null;
    shares: number | null;
    comments: number | null;
    followers_gained: number | null;
    collected_at: string;
  }[];
  contentDna: Record<string, unknown>[];
  commemorativeDates: { id: string; name: string; month: number; day: number; lead_days: number }[];
  // Melhores horarios por dia da semana, importados do Metricool. Ficam em
  // workspaces.settings porque sao propriedade da marca, nao de um mes.
  bestTimes: Record<string, number[]> | null;
  // Resultado real por conteudo publicado: o que o Diretor precisa para ligar
  // formato/pilar/hook a numero. Vazio ate existir conciliacao.
  published: {
    title: string;
    format: string | null;
    objective: string | null;
    pillarName: string | null;
    hook: string | null;
    platform: string | null;
    publishedAt: string | null;
    reach: number | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
  }[];
  // Sinaliza o que nao pode ser carregado (ex.: migration 0003 ainda nao
  // rodada). O Diretor precisa saber o que esta faltando em vez de assumir
  // que a ausencia de dados significa "nao ha nada".
  missing: string[];
}

const MOMENTS_LOOKBACK_DAYS = 60;
const HISTORY_LIMIT = 100;

function quarterOf(year: number, month: number): string {
  return `${year}-Q${Math.floor(month / 3) + 1}`;
}

export async function buildPlanningContext(
  db: SupabaseClient,
  period: { year: number; month: number },
): Promise<PlanningContext> {
  const workspaceId = getWorkspaceId();
  const missing: string[] = [];

  const since = new Date();
  since.setDate(since.getDate() - MOMENTS_LOOKBACK_DAYS);

  const monthStart = new Date(period.year, period.month, 1).toISOString();
  const monthEnd = new Date(period.year, period.month + 1, 1).toISOString();

  const [
    brainsRes,
    pillarsRes,
    goalsRes,
    momentsRes,
    linkedRes,
    historyRes,
    plannedRes,
    metricsRes,
    dnaRes,
    datesRes,
    settingsRes,
    publishedRes,
  ] = await Promise.all([
    db.from("brains").select("kind, content").eq("workspace_id", workspaceId),
    db.from("pillars").select("id, name, color").eq("workspace_id", workspaceId).order("sort"),
    db
      .from("goals")
      .select("id, title, target, progress, quarter")
      .eq("workspace_id", workspaceId)
      .eq("quarter", quarterOf(period.year, period.month)),
    db
      .from("moments")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
    db
      .from("contents")
      .select("moment_id")
      .eq("workspace_id", workspaceId)
      .eq("archived", false)
      .not("moment_id", "is", null),
    db
      .from("contents")
      .select("id, title, status, format, objective, pillar_id, published_at")
      .eq("workspace_id", workspaceId)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    db
      .from("contents")
      .select("id, title, planned_at")
      .eq("workspace_id", workspaceId)
      .eq("archived", false)
      .gte("planned_at", monthStart)
      .lt("planned_at", monthEnd),
    db
      .from("metrics")
      .select("content_id, reach, retention, saves, shares, comments, followers_gained, collected_at")
      .eq("workspace_id", workspaceId)
      .order("collected_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    db.from("content_dna").select("*").eq("workspace_id", workspaceId).limit(HISTORY_LIMIT),
    db
      .from("commemorative_dates")
      .select("id, name, month, day, lead_days")
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`),
    db.from("workspaces").select("settings").eq("id", workspaceId).maybeSingle(),
    // Conteudos publicados com metrica ligada. O join sai de metrics porque a
    // metrica e o fato novo; o conteudo e o contexto dela.
    db
      .from("metrics")
      .select(
        "reach, views, likes, comments, shares, saves, platform, collected_at, contents!inner(title, format, objective, hook, published_at, pillars(name))",
      )
      .eq("workspace_id", workspaceId)
      .not("content_id", "is", null)
      .order("collected_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const brains = { brand: {}, business: {}, learned: {} } as PlanningContext["brains"];
  if (brainsRes.error) {
    missing.push("brains");
  } else {
    for (const row of (brainsRes.data ?? []) as { kind: BrainKind; content: Record<string, unknown> }[]) {
      brains[row.kind] = row.content ?? {};
    }
  }

  if (pillarsRes.error) missing.push("pillars");
  if (goalsRes.error) missing.push("goals");
  if (momentsRes.error) missing.push("moments");
  if (historyRes.error) missing.push("contents");
  if (metricsRes.error) missing.push("metrics");
  if (dnaRes.error) missing.push("content_dna");
  if (datesRes.error) missing.push("commemorative_dates");

  const linkedIds = new Set(
    (linkedRes.data ?? []).map((r: { moment_id: string }) => r.moment_id),
  );

  return {
    workspaceId,
    period,
    brains,
    pillars: (pillarsRes.data ?? []) as PlanningContext["pillars"],
    objectives: (goalsRes.data ?? []) as PlanningContext["objectives"],
    recentMoments: ((momentsRes.data ?? []) as { id: string; body: string; created_at: string }[]).map(
      (m) => ({ ...m, converted: linkedIds.has(m.id) }),
    ),
    contentHistory: (historyRes.data ?? []) as PlanningContext["contentHistory"],
    alreadyPlanned: (plannedRes.data ?? []) as PlanningContext["alreadyPlanned"],
    metrics: (metricsRes.data ?? []) as PlanningContext["metrics"],
    contentDna: (dnaRes.data ?? []) as Record<string, unknown>[],
    commemorativeDates: (datesRes.data ?? []) as PlanningContext["commemorativeDates"],
    bestTimes:
      ((settingsRes.data?.settings as { best_times?: Record<string, number[]> } | null)
        ?.best_times) ?? null,
    published: normalizarPublicados(publishedRes.data),
    missing,
  };
}

// Uma midia pode ter varias coletas; a mais recente e a que vale. Como a
// consulta ja vem ordenada por data desc, o primeiro de cada titulo ganha.
function normalizarPublicados(data: unknown): PlanningContext["published"] {
  const vistos = new Set<string>();
  const saida: PlanningContext["published"] = [];

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const c = row.contents as Record<string, unknown> | Record<string, unknown>[] | null;
    const conteudo = Array.isArray(c) ? c[0] : c;
    if (!conteudo) continue;

    const titulo = String(conteudo.title ?? "");
    if (vistos.has(titulo)) continue;
    vistos.add(titulo);

    const p = conteudo.pillars as { name?: string } | { name?: string }[] | null;
    const pilar = Array.isArray(p) ? p[0] : p;

    saida.push({
      title: titulo,
      format: (conteudo.format as string | null) ?? null,
      objective: (conteudo.objective as string | null) ?? null,
      pillarName: pilar?.name ?? null,
      hook: (conteudo.hook as string | null) ?? null,
      platform: (row.platform as string | null) ?? null,
      publishedAt: (conteudo.published_at as string | null) ?? null,
      reach: (row.reach as number | null) ?? null,
      views: (row.views as number | null) ?? null,
      likes: (row.likes as number | null) ?? null,
      comments: (row.comments as number | null) ?? null,
      shares: (row.shares as number | null) ?? null,
      saves: (row.saves as number | null) ?? null,
    });
  }

  return saida;
}

// Resumo legivel do cenario — usado hoje para mostrar a usuaria exatamente com
// que dados o Diretor vai trabalhar, e util depois como base do prompt.
export function summarizeContext(ctx: PlanningContext): {
  label: string;
  value: string;
  ready: boolean;
}[] {
  const brandKeys = Object.keys(ctx.brains.brand).length;
  const businessKeys = Object.keys(ctx.brains.business).length;
  const learnedKeys = Object.keys(ctx.brains.learned).length;

  return [
    {
      label: "Momentos recentes",
      value: `${ctx.recentMoments.length} nos ultimos ${MOMENTS_LOOKBACK_DAYS} dias (${ctx.recentMoments.filter((m) => !m.converted).length} sem virar conteudo)`,
      ready: ctx.recentMoments.length > 0,
    },
    { label: "Brand Brain", value: brandKeys > 0 ? `${brandKeys} secoes` : "vazio", ready: brandKeys > 0 },
    { label: "Business Brain", value: businessKeys > 0 ? `${businessKeys} secoes` : "vazio", ready: businessKeys > 0 },
    { label: "Learned Brain", value: learnedKeys > 0 ? `${learnedKeys} secoes` : "vazio", ready: learnedKeys > 0 },
    { label: "DNA do Conteudo", value: `${ctx.contentDna.length} registros`, ready: ctx.contentDna.length > 0 },
    { label: "Objetivos do trimestre", value: `${ctx.objectives.length}`, ready: ctx.objectives.length > 0 },
    { label: "Metricas", value: `${ctx.metrics.length} coletas`, ready: ctx.metrics.length > 0 },
    {
      label: "Melhores horarios",
      value: ctx.bestTimes ? `${Object.keys(ctx.bestTimes).length} dias mapeados` : "nao importados",
      ready: !!ctx.bestTimes,
    },
    {
      label: "Resultado por conteudo",
      value:
        ctx.published.length > 0
          ? `${ctx.published.length} publicados com metrica`
          : "nenhum conteudo conciliado",
      ready: ctx.published.length > 0,
    },
    { label: "Historico de conteudos", value: `${ctx.contentHistory.length}`, ready: ctx.contentHistory.length > 0 },
    { label: "Pilares", value: `${ctx.pillars.length}`, ready: ctx.pillars.length > 0 },
    {
      label: "Datas comemorativas",
      value: ctx.missing.includes("commemorative_dates")
        ? "tabela ainda nao criada (migration 0003)"
        : `${ctx.commemorativeDates.length}`,
      ready: ctx.commemorativeDates.length > 0,
    },
    {
      label: "Ja planejado no mes",
      value: `${ctx.alreadyPlanned.length} conteudos com data`,
      ready: true,
    },
  ];
}
