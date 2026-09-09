import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiProvider, AiProviderError } from "@/lib/ai";
import { getWorkspaceId } from "@/lib/workspace/current";
import { DIRECTOR_SYSTEM } from "./prompts";

// Classificar por pilar o que ficou sem.
//
// O sistema aprende POR PILAR: sem ele o Diretor chega em "Reel funciona" e
// nunca em "Reel de bastidor funciona, Reel de venda nao". Mas classificar 30
// cards na mao, um por um num seletor, e o tipo de tarefa que ninguem faz — e
// por isso 10 dos 12 conteudos da Eisen Haus estavam sem pilar mesmo depois de
// os pilares existirem.
//
// Aqui o Diretor propoe todos de uma vez e ela confirma. Como no plano do mes e
// nas metas: a IA prepara, a pessoa decide.

export interface ParaClassificar {
  id: string;
  title: string;
  hook: string | null;
  format: string | null;
}

export interface PilarDisponivel {
  id: string;
  name: string;
}

export interface PilarSugerido {
  contentId: string;
  // Nulo quando nenhum pilar existente serve. Vale mais admitir do que forcar:
  // um pilar errado envenena a analise que ele deveria alimentar.
  pillarId: string | null;
  porque: string;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["atribuicoes"],
  properties: {
    atribuicoes: {
      type: "array",
      description: "Uma entrada por conteudo, na ordem em que foram listados.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["conteudoIndex", "pilarIndex", "porque"],
        properties: {
          conteudoIndex: { type: "integer" },
          pilarIndex: {
            type: "integer",
            description: "Indice do pilar na lista, ou -1 quando nenhum serve.",
          },
          porque: {
            type: "string",
            description: "Ate oito palavras dizendo o que no conteudo levou a esse pilar.",
          },
        },
      },
    },
  },
};

export async function suggestPillars(
  db: SupabaseClient,
  itens: ParaClassificar[],
  pilares: PilarDisponivel[],
): Promise<PilarSugerido[]> {
  if (itens.length === 0) return [];
  if (pilares.length === 0) {
    throw new AiProviderError(
      "Este workspace ainda nao tem pilares. Crie os pilares em Cerebros antes de classificar.",
    );
  }

  const provider = getAiProvider();

  const listaPilares = pilares.map((p, i) => `${i}. ${p.name}`).join("\n");
  const listaConteudos = itens
    .map((c, i) => {
      const partes = [`${i}. ${c.title}`];
      if (c.format) partes.push(`   formato: ${c.format}`);
      if (c.hook) partes.push(`   hook: ${c.hook}`);
      return partes.join("\n");
    })
    .join("\n\n");

  const prompt = `# Tarefa

Classifique cada conteudo abaixo em um dos pilares da marca.

## Pilares
${listaPilares}

## Conteudos
${listaConteudos}

## Regras
- Uma entrada para CADA conteudo, usando o indice dele.
- Escolha pelo ASSUNTO e pela FUNCAO do conteudo, nao por palavra solta que coincida com o nome do pilar.
- Quando dois pilares couberem, escolha o que descreve por que a pessoa pararia para ver — nao o que descreve o objeto que aparece.
- Quando nenhum pilar servir de verdade, devolva -1. Nao force: um pilar errado estraga a analise que ele deveria alimentar, e sai mais caro que um conteudo sem classificacao.
- O "porque" tem no maximo oito palavras e cita o que no conteudo levou ali. Nada de justificativa generica.`;

  const result = await provider.generate({
    system: DIRECTOR_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    jsonSchema: SCHEMA,
    effort: "medium",
    // Classificar e reconhecer assunto, nao escrever: o modelo economico da
    // conta, e ela revisa cada linha antes de aplicar.
    tier: "efficient",
    maxTokens: 8000,
  });

  const parsed = result.parsed as Record<string, unknown> | null;
  if (!parsed || !Array.isArray(parsed.atribuicoes)) {
    throw new AiProviderError("A IA nao devolveu a lista de pilares.");
  }

  // Traduz indice em id aqui, e nao no prompt: pedir uuid ao modelo convida a
  // inventar um. Indice fora da lista e descartado em silencio.
  const vistos = new Set<string>();
  const sugestoes: PilarSugerido[] = [];

  for (const bruto of parsed.atribuicoes as Record<string, unknown>[]) {
    const ci = Number(bruto?.conteudoIndex);
    if (!Number.isInteger(ci) || ci < 0 || ci >= itens.length) continue;

    const conteudo = itens[ci];
    if (vistos.has(conteudo.id)) continue;
    vistos.add(conteudo.id);

    const pi = Number(bruto?.pilarIndex);
    const pilar = Number.isInteger(pi) && pi >= 0 && pi < pilares.length ? pilares[pi] : null;

    sugestoes.push({
      contentId: conteudo.id,
      pillarId: pilar?.id ?? null,
      porque: String(bruto?.porque ?? "").trim(),
    });
  }

  try {
    await db.from("ai_generations").insert({
      workspace_id: getWorkspaceId(),
      kind: "pilares",
      provider: result.provider,
      model: result.model,
      input_tokens: result.usage?.inputTokens ?? null,
      output_tokens: result.usage?.outputTokens ?? null,
      result: {
        propostos: sugestoes.length,
        semPilar: sugestoes.filter((s) => !s.pillarId).length,
      },
    });
  } catch {
    // Auditoria best-effort.
  }

  return sugestoes;
}

// Grava as atribuicoes que ela confirmou. So mexe em conteudo que ainda esta
// sem pilar: se ela classificou um a mao enquanto revisava, a escolha dela
// ganha da proposta.
export async function applyPillars(
  db: SupabaseClient,
  pares: { contentId: string; pillarId: string }[],
): Promise<number> {
  if (pares.length === 0) return 0;
  const workspaceId = getWorkspaceId();

  let gravados = 0;
  for (const par of pares) {
    const { data, error } = await db
      .from("contents")
      .update({ pillar_id: par.pillarId })
      .eq("id", par.contentId)
      .eq("workspace_id", workspaceId)
      .is("pillar_id", null)
      .select("id");

    if (error) throw new Error(error.message);
    gravados += (data ?? []).length;
  }

  return gravados;
}
