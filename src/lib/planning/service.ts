import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import { montarSemana, type MonthlyPlan, type PlannedItem } from "@/lib/ai/director/planner";

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
  // Ritual diario de Stories, por dia da semana. Nao vira card por design.
  storiesRoutine: { weekday: string; theme: string; why: string }[];
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
      plan: {
        diagnosis: plan.diagnosis,
        focus: plan.focus,
        storiesRoutine: plan.storiesRoutine,
        items,
      },
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
    // Saneado na leitura, e nao so na gravacao: planos ja salvos com dia
    // repetido (aconteceu — "domingo" veio duas vezes) passam a exibir a semana
    // certa sem precisar gerar de novo. Planos antigos, sem rotina, devolvem
    // lista vazia e a tela apenas nao mostra a secao.
    storiesRoutine: montarSemana(p.storiesRoutine),
    approved: !!data.approved,
    generatedAt: String(data.generated_at ?? ""),
  };
}

// Cards deste mes que nunca sairam do papel: continuam em "Ideia", sem roteiro,
// legenda nem hook escritos. Sao o resto de um plano anterior que foi
// substituido — mante-los ao lado dos novos cria um Pipeline com duas versoes
// do mesmo mes.
//
// A regra e conservadora de proposito: qualquer sinal de trabalho (mudou de
// coluna, ganhou texto, virou publicacao) tira o card desta lista.
export async function listUntouchedFromMonth(
  db: SupabaseClient,
  period: { year: number; month: number },
): Promise<{ id: string; title: string }[]> {
  const inicio = new Date(period.year, period.month, 1).toISOString();
  const fim = new Date(period.year, period.month + 1, 1).toISOString();

  const { data, error } = await db
    .from("contents")
    .select("id, title, script, caption, hook, cta")
    .eq("workspace_id", getWorkspaceId())
    .eq("archived", false)
    .eq("status", "ideia")
    .gte("planned_at", inicio)
    .lt("planned_at", fim);

  if (error) return [];

  return ((data ?? []) as Record<string, unknown>[])
    .filter((c) => !c.script && !c.caption && !c.cta)
    .map((c) => ({ id: String(c.id), title: String(c.title) }));
}

export interface Leftover {
  id: string;
  title: string;
  status: string;
  format: string | null;
  plannedAt: string;
  // Sinal de trabalho: quem ja tem roteiro ou legenda custa mais para descartar.
  trabalhado: boolean;
}

// O que sobrou de um mes: planejado nele e nao publicado.
//
// Deliberadamente mais amplo que `listUntouchedFromMonth`, que so pega o
// intocado. Aqui entra tambem o card com roteiro escrito que nao chegou a ser
// gravado — justamente o que mais vale trazer adiante, porque ja tem trabalho
// dentro. Quem decide o destino e a pessoa, na tela.
export async function listLeftovers(
  db: SupabaseClient,
  period: { year: number; month: number },
): Promise<Leftover[]> {
  const inicio = new Date(period.year, period.month, 1).toISOString();
  const fim = new Date(period.year, period.month + 1, 1).toISOString();

  const { data, error } = await db
    .from("contents")
    .select("id, title, status, format, planned_at, script, caption, cta")
    .eq("workspace_id", getWorkspaceId())
    .eq("archived", false)
    .neq("status", "publicado")
    .gte("planned_at", inicio)
    .lt("planned_at", fim)
    .order("planned_at", { ascending: true });

  if (error) return [];

  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    title: String(c.title),
    status: String(c.status),
    format: (c.format as string | null) ?? null,
    plannedAt: String(c.planned_at),
    trabalhado: !!(c.script || c.caption || c.cta),
  }));
}

// Traz conteudos para outro mes, preservando o dia e a hora quando possivel.
// Dia 31 num mes de 30 cai no ultimo dia, em vez de virar o mes seguinte.
export async function carryOverContents(
  db: SupabaseClient,
  ids: string[],
  destino: { year: number; month: number },
): Promise<number> {
  if (ids.length === 0) return 0;
  const workspaceId = getWorkspaceId();

  const { data, error } = await db
    .from("contents")
    .select("id, planned_at")
    .eq("workspace_id", workspaceId)
    .in("id", ids);

  if (error) throw new Error(error.message);

  const ultimoDia = new Date(destino.year, destino.month + 1, 0).getDate();

  for (const c of (data ?? []) as { id: string; planned_at: string }[]) {
    const antigo = new Date(c.planned_at);
    const dia = Math.min(antigo.getDate(), ultimoDia);
    const novo = new Date(
      destino.year,
      destino.month,
      dia,
      antigo.getHours(),
      antigo.getMinutes(),
    );

    const { error: errUpd } = await db
      .from("contents")
      .update({ planned_at: novo.toISOString() })
      .eq("id", c.id)
      .eq("workspace_id", workspaceId);
    if (errUpd) throw new Error(errUpd.message);
  }

  await emit(db, {
    type: "conteudo.agendado",
    workspaceId,
    payload: { origem: "virada-de-mes", quantidade: (data ?? []).length },
  });

  return (data ?? []).length;
}

export async function retireContents(db: SupabaseClient, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const workspaceId = getWorkspaceId();

  const { data, error } = await db
    .from("contents")
    .update({ archived: true })
    .eq("workspace_id", workspaceId)
    .in("id", ids)
    .select("id");

  if (error) throw new Error(error.message);

  await emit(db, {
    type: "conteudo.arquivado",
    workspaceId,
    payload: { origem: "virada-de-mes", quantidade: (data ?? []).length },
  });

  return (data ?? []).length;
}

// Aprovar materializa o plano: cada item vira um Conteudo em "Ideia" com data e
// hora agendadas. Depois disso o plano fica marcado como aprovado, para nao
// criar os mesmos cards duas vezes.
//
// Antes de criar, arquiva os cards intocados deste mesmo mes — senao o Pipeline
// acumularia o plano velho junto com o novo. Arquivar, nunca apagar: se voce
// mudar de ideia, o card ainda existe no banco.
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

  // Aposenta o resto do plano anterior antes de criar o novo.
  const intocados = await listUntouchedFromMonth(db, period);
  if (intocados.length > 0) {
    const { error: errArquivar } = await db
      .from("contents")
      .update({ archived: true })
      .in(
        "id",
        intocados.map((c) => c.id),
      );
    if (errArquivar) throw new Error(errArquivar.message);

    await emit(db, {
      type: "conteudo.arquivado",
      workspaceId,
      payload: { origem: "plano-substituido", quantidade: intocados.length },
    });
  }

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

export interface ApprovePreview {
  criar: number;
  arquivar: { id: string; title: string }[];
}
