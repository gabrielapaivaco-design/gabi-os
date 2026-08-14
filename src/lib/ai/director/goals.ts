import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiProvider, AiProviderError } from "@/lib/ai";
import { getWorkspaceId } from "@/lib/workspace/current";
import { buildPlanningContext } from "@/lib/planning/context";
import { renderPlanningContext } from "./planner";
import { DIRECTOR_SYSTEM } from "./prompts";

// Metas do trimestre sugeridas pelo Diretor.
//
// Meta boa nasce de onde a marca esta, nao de numero redondo. Por isso a
// sugestao le o mesmo cenario do planejamento mensal: os tres Cerebros, o
// desempenho real e o historico de conteudo. Se o mes fechou com -162
// seguidores, "ganhar 5.000" nao e ambicao, e fantasia — e o prompt diz isso.

export interface SuggestedGoal {
  title: string;
  target: number | null;
  rationale: string;
}

export interface GoalSuggestions {
  reading: string;
  goals: SuggestedGoal[];
}

const GOALS_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["reading", "goals"],
  properties: {
    reading: {
      type: "string",
      description:
        "Duas ou tres frases sobre onde a marca esta hoje, a partir dos dados reais. E a base das metas.",
    },
    goals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "target", "rationale"],
        properties: {
          title: {
            type: "string",
            description:
              "A meta em uma frase, comecando por verbo. Concreta e verificavel.",
          },
          target: {
            type: ["integer", "null"],
            description:
              "Numero a atingir no trimestre. Use null quando a meta nao for contavel.",
          },
          rationale: {
            type: "string",
            description:
              "Uma frase ligando a meta a um dado do contexto. Sem dado, diga em que suposicao ela se apoia.",
          },
        },
      },
    },
  },
};

function quarterOf(date: Date): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

export async function suggestQuarterGoals(
  db: SupabaseClient,
  existingTitles: string[] = [],
): Promise<GoalSuggestions> {
  const provider = getAiProvider();
  const hoje = new Date();
  const context = await buildPlanningContext(db, {
    year: hoje.getFullYear(),
    month: hoje.getMonth(),
  });

  const jaExistem = existingTitles.length
    ? `\n\nJa existem estas metas neste trimestre — nao repita nem reformule:\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : "";

  // Sem a data de hoje o modelo inventa prazos ja vencidos ("ate 10 de agosto"
   // proposto no dia 13). Mesmo furo que o planejamento mensal tinha.
  const MESES = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const fimTrimestre = new Date(hoje.getFullYear(), (Math.floor(hoje.getMonth() / 3) + 1) * 3, 0);
  const diasRestantes = Math.ceil((fimTrimestre.getTime() - hoje.getTime()) / 86400000);

  const prompt = `# Tarefa

Sugira de 3 a 5 metas para o trimestre ${quarterOf(hoje)}.

HOJE E ${hoje.getDate()} DE ${MESES[hoje.getMonth()].toUpperCase()} DE ${hoje.getFullYear()}. O trimestre termina em ${fimTrimestre.getDate()} de ${MESES[fimTrimestre.getMonth()]}, ou seja, restam ${diasRestantes} dias.
Todo prazo que voce citar tem que ser futuro. Nao proponha "ate dia X" se o dia X ja passou, e dimensione o volume pelo tempo que sobra, nao pelo trimestre inteiro.

Comece por uma leitura curta de onde a marca esta hoje, a partir dos dados acima. Sem elogio e sem catastrofe.

Depois as metas. Regras:
- Cada meta parte de onde os numeros estao, nao de um numero redondo. Se o ultimo mes fechou negativo, a meta de crescimento reconhece isso: recuperar vem antes de multiplicar.
- Prefira o que depende do trabalho dela (publicar, gravar, documentar) ao que depende de terceiros (viralizar, ser convidada). Meta que ela nao controla vira frustracao.
- Misture: producao, alcance e negocio. Um trimestre so de numero de seguidor ignora o resto.
- Se algo no contexto contradiz uma meta obvia, diga na justificativa.
- Nao invente metricas, clientes ou fatos que nao estejam no contexto. Quando faltar dado, apoie a meta no que existe e admita a suposicao.${jaExistem}`;

  const result = await provider.generate({
    system: DIRECTOR_SYSTEM,
    messages: [{ role: "user", content: `${renderPlanningContext(context)}\n\n---\n\n${prompt}` }],
    jsonSchema: GOALS_SCHEMA,
    effort: "high",
    maxTokens: 8000,
  });

  const parsed = result.parsed as Record<string, unknown> | null;
  if (!parsed || !Array.isArray(parsed.goals)) {
    throw new AiProviderError("A IA nao devolveu a lista de metas.");
  }

  try {
    await db.from("ai_generations").insert({
      workspace_id: getWorkspaceId(),
      kind: "metas",
      provider: result.provider,
      model: result.model,
      input_tokens: result.usage?.inputTokens ?? null,
      output_tokens: result.usage?.outputTokens ?? null,
      result: { reading: String(parsed.reading ?? ""), quantidade: parsed.goals.length },
    });
  } catch {
    // Auditoria best-effort.
  }

  return {
    reading: String(parsed.reading ?? ""),
    goals: (parsed.goals as Record<string, unknown>[]).map((g) => ({
      title: String(g.title ?? ""),
      target: typeof g.target === "number" ? g.target : null,
      rationale: String(g.rationale ?? ""),
    })),
  };
}

export { quarterOf };
