import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiProvider, type AiMessage } from "@/lib/ai";
import { getWorkspaceId } from "@/lib/workspace/current";
import { buildPlanningContext } from "@/lib/planning/context";
import { renderPlanningContext } from "./planner";
import type { StoredPlan } from "@/lib/planning/service";
import { DIRECTOR_SYSTEM } from "./prompts";

// Conversa sobre o cronograma do mes. Diferente da conversa de card, que fala
// de um conteudo, esta fala da estrategia: por que tanto Reel, por que o dia 14
// esta vazio, o que sai se ela so tiver tempo para metade.
//
// A conversa nao altera o plano por conta propria. Quando ela decidir, o botao
// "Refazer o plano" manda este dialogo para o gerador, que devolve o cronograma
// revisado — e ele volta a ser uma proposta, para ser revisada de novo.

const CHAT_SYSTEM = `${DIRECTOR_SYSTEM}

Agora voces estao CONVERSANDO sobre o cronograma do mes que voce propos.

Na conversa:
- Responda curto. Duas ou tres frases resolvem a maioria das trocas.
- Defenda uma escolha quando ela tiver base nos dados, mostrando o numero. Ceda quando o argumento dela for melhor — ela conhece a rotina e a capacidade de producao dela, voce nao.
- Quando ela disser que nao vai dar conta do volume, leve a serio: cronograma que nao sai nao vale nada. Proponha o que cortar primeiro e por que.
- Nao reescreva o cronograma inteiro na conversa. Fale do que mudaria; a reescrita acontece depois, por um botao.
- Nao invente metricas nem fatos que nao estejam no contexto.`;

export async function chatAboutPlan(
  db: SupabaseClient,
  period: { year: number; month: number },
  plan: StoredPlan,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<{ text: string }> {
  if (history.length === 0) throw new Error("A conversa precisa de pelo menos uma mensagem.");

  const provider = getAiProvider();
  const context = await buildPlanningContext(db, period);

  const cronograma = plan.items
    .map(
      (i, n) =>
        `${n + 1}. dia ${i.day}, ${i.hour}h — ${i.title}\n   ${i.format}${i.objective ? ` · ${i.objective}` : ""}${i.pillar ? ` · ${i.pillar}` : ""}\n   por que: ${i.why}`,
    )
    .join("\n\n");

  const rotina = plan.storiesRoutine.length
    ? `\n\n## Rotina de Stories (diaria, nao vira card)\n${plan.storiesRoutine
        .map((d) => `- ${d.weekday}: ${d.theme}`)
        .join("\n")}`
    : "";

  const cabecalho = [
    renderPlanningContext(context),
    "---",
    "# Cronograma que voce propos",
    `Diagnostico: ${plan.diagnosis}`,
    `Foco: ${plan.focus}${rotina}`,
    "",
    cronograma,
  ].join("\n\n");

  const messages: AiMessage[] = history.map((turn, i) =>
    i === 0 && turn.role === "user"
      ? { role: "user" as const, content: `${cabecalho}\n\n---\n\n${turn.content}` }
      : { role: turn.role, content: turn.content },
  );

  const result = await provider.generate({
    system: CHAT_SYSTEM,
    messages,
    effort: "medium",
    // Conversa sobre o plano. O plano em si continua no melhor modelo — aqui e
    // so a discussao que leva ate o pedido de refazer.
    tier: "efficient",
    maxTokens: 8000,
  });

  const text = result.text.trim();
  if (!text) throw new Error("O Diretor devolveu uma resposta vazia.");

  try {
    await db.from("ai_generations").insert({
      workspace_id: getWorkspaceId(),
      kind: "conversa",
      provider: result.provider,
      model: result.model,
      input_tokens: result.usage?.inputTokens ?? null,
      output_tokens: result.usage?.outputTokens ?? null,
      result: { sobre: "planejamento", turns: history.length, reply: text },
    });
  } catch {
    // Auditoria best-effort.
  }

  return { text };
}
