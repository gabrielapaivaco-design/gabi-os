"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AiNotConfiguredError } from "@/lib/ai";
import { generateMonthlyPlan } from "@/lib/ai/director/planner";
import { chatAboutPlan } from "@/lib/ai/director/plan-chat";
import { buildPlanningContext } from "@/lib/planning/context";
import { separarRepetidos } from "@/lib/planning/dedupe";
import {
  approveMonthlyPlan,
  carryOverContents,
  loadMonthlyPlan,
  retireContents,
  saveMonthlyPlan,
} from "@/lib/planning/service";

type Turn = { role: "user" | "assistant"; content: string };

export type PlanActionResult =
  | { ok: true; created?: number; aviso?: string }
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
      anterior
        ? {
            diagnosis: anterior.diagnosis,
            focus: anterior.focus,
            items: anterior.items,
            storiesRoutine: anterior.storiesRoutine,
          }
        : undefined,
    );

    // Rede contra repeticao. O prompt ja manda conferir o que existe, e isso
    // resolve a maioria dos casos — mas regra de prompt e pedido, e uma vez que
    // o modelo escorrega o card duplicado so sai do Pipeline na mao. Ja saiu:
    // tres titulos identicos conviveram la.
    const existentes = ctx.contentHistory.map((c) => c.title);
    const { novos, repetidos } = separarRepetidos(plan.items, (i) => i.title, existentes);

    await saveMonthlyPlan(db, period, { ...plan, items: novos }, momentIds);

    if (repetidos.length > 0) {
      revalidatePath("/planejamento");
      return {
        ok: true,
        // Dito, nao escondido: ela precisa saber que o plano veio menor, e por
        // que. Um plano que encolhe em silencio parece um plano com falha.
        aviso:
          repetidos.length === 1
            ? `Descartei 1 proposta que repetia "${repetidos[0].jaExiste}", que ja esta no Pipeline.`
            : `Descartei ${repetidos.length} propostas que repetiam conteudos que ja estao no Pipeline.`,
      };
    }
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

// Virada de mes: o que sobrou do mes anterior vem para ca, ou se aposenta.
// Nada acontece sozinho — a tela pergunta e estas actions executam a escolha.
export async function carryOverAction(
  ids: string[],
  destino: { year: number; month: number },
): Promise<PlanActionResult> {
  try {
    const n = await carryOverContents(createClient(), ids, destino);
    revalidarVirada();
    return { ok: true, created: n };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui trazer." };
  }
}

export async function retireAction(ids: string[]): Promise<PlanActionResult> {
  try {
    const n = await retireContents(createClient(), ids);
    revalidarVirada();
    return { ok: true, created: n };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui aposentar." };
  }
}

function revalidarVirada(): void {
  revalidatePath("/planejamento");
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  revalidatePath("/");
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
