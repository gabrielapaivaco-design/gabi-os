"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AiNotConfiguredError } from "@/lib/ai";
import { generateMonthlyPlan } from "@/lib/ai/director/planner";
import { chatAboutPlan } from "@/lib/ai/director/plan-chat";
import { buildPlanningContext } from "@/lib/planning/context";
import { approveMonthlyPlan, loadMonthlyPlan, saveMonthlyPlan } from "@/lib/planning/service";

type Turn = { role: "user" | "assistant"; content: string };

export type PlanActionResult =
  | { ok: true; created?: number }
  | { ok: false; error: string; notConfigured?: boolean };

export async function generatePlanAction(
  period: { year: number; month: number },
  // Presente quando a pessoa pediu "refazer com esta conversa": o plano atual e
  // o dialogo entram como instrucao de revisao.
  conversa?: Turn[],
): Promise<PlanActionResult> {
  const db = createClient();

  try {
    // O contexto e montado duas vezes de proposito: o gerador precisa dele para
    // o prompt, e aqui precisamos da MESMA lista de Momentos para traduzir o
    // indice devolvido pela IA em id real. Ler de novo e mais barato e mais
    // simples do que carregar o objeto inteiro entre camadas.
    const ctx = await buildPlanningContext(db, period);
    const momentIds = ctx.recentMoments.filter((m) => !m.converted).map((m) => m.id);

    const anterior = conversa?.length ? await loadMonthlyPlan(db, period) : null;
    const plan = await generateMonthlyPlan(
      db,
      period,
      conversa,
      anterior ? { diagnosis: anterior.diagnosis, focus: anterior.focus, items: anterior.items } : undefined,
    );
    await saveMonthlyPlan(db, period, plan, momentIds);
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return { ok: false, error: err.message, notConfigured: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui gerar o plano.",
    };
  }

  revalidatePath("/planejamento");
  return { ok: true };
}

export type PlanChatResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; notConfigured?: boolean };

export async function chatAboutPlanAction(
  period: { year: number; month: number },
  history: Turn[],
): Promise<PlanChatResult> {
  const db = createClient();
  try {
    const plan = await loadMonthlyPlan(db, period);
    if (!plan) return { ok: false, error: "Nao ha plano gerado para conversar." };

    const { text } = await chatAboutPlan(db, period, plan, history);
    return { ok: true, reply: text };
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return { ok: false, error: err.message, notConfigured: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido ao chamar a IA.",
    };
  }
}

export async function approvePlanAction(period: {
  year: number;
  month: number;
}): Promise<PlanActionResult> {
  let created: number;
  try {
    created = await approveMonthlyPlan(createClient(), period);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui aprovar o plano.",
    };
  }

  revalidatePath("/planejamento");
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true, created };
}
