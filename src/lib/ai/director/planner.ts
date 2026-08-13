import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiProvider, AiProviderError } from "@/lib/ai";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import { buildPlanningContext, type PlanningContext } from "@/lib/planning/context";
import { DIRECTOR_SYSTEM } from "./prompts";

// Planejamento do mes: o Diretor le o cenario inteiro (metricas reais,
// Cerebros, Momentos ainda nao aproveitados, objetivos do trimestre, datas
// comemorativas e melhores horarios) e propoe o cronograma.
//
// A proposta NAO vira card sozinha. Ela e gravada em `monthly_plans` com
// `approved = false` e so materializa conteudos quando a pessoa aprovar — e a
// mesma regra do resto do sistema: a IA escreve, quem decide e voce.

export interface PlannedItem {
  day: number;
  hour: number;
  title: string;
  format: string;
  objective: string;
  pillar: string;
  hook: string;
  why: string;
  momentIndex: number;
}

export interface MonthlyPlan {
  diagnosis: string;
  focus: string;
  items: PlannedItem[];
}

// Tipado como Record e nao com `as const`: o literal aninhado faz o TypeScript
// inferir um tipo enorme e estourar a memoria do compilador.
const PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["diagnosis", "focus", "items"],
  properties: {
    diagnosis: {
      type: "string",
      description:
        "Duas a quatro frases lendo o momento atual a partir das metricas e do historico reais. Sem elogio vazio e sem catastrofe.",
    },
    focus: {
      type: "string",
      description: "Uma frase: a aposta central do mes e por que ela decorre do diagnostico.",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "hour", "title", "format", "objective", "pillar", "hook", "why", "momentIndex"],
        properties: {
          day: { type: "integer", description: "Dia do mes (1-31)." },
          hour: { type: "integer", description: "Hora sugerida (0-23), vinda dos melhores horarios." },
          title: { type: "string", description: "Titulo concreto do conteudo, nao um tema generico." },
          format: { type: "string", description: "Reel, Carrossel, Stories, Foto unica." },
          objective: {
            type: "string",
            enum: ["autoridade", "venda", "conexao", "crescimento"],
          },
          pillar: {
            type: "string",
            description: "Nome exato de um dos pilares listados no contexto, ou string vazia.",
          },
          hook: { type: "string", description: "A primeira frase do conteudo." },
          why: {
            type: "string",
            description: "Uma frase ligando este item ao diagnostico, a uma metrica ou a um Momento real.",
          },
          momentIndex: {
            type: "integer",
            description:
              "Indice do Momento que originou este item na lista de Momentos do contexto, ou -1 se nasceu do planejamento.",
          },
        },
      },
    },
  },
};

export async function generateMonthlyPlan(
  db: SupabaseClient,
  period: { year: number; month: number },
  // Conversa previa sobre o plano. Quando existe, o Diretor refaz o cronograma
  // incorporando o que foi combinado em vez de comecar do zero.
  conversa?: { role: "user" | "assistant"; content: string }[],
  planoAtual?: MonthlyPlan,
): Promise<MonthlyPlan> {
  const provider = getAiProvider();
  const context = await buildPlanningContext(db, period);

  const instrucao =
    conversa && conversa.length > 0
      ? `${buildPlanPrompt(context)}\n\n${renderRevision(planoAtual, conversa)}`
      : buildPlanPrompt(context);

  const result = await provider.generate({
    system: DIRECTOR_SYSTEM,
    messages: [{ role: "user", content: `${renderPlanningContext(context)}\n\n---\n\n${instrucao}` }],
    jsonSchema: PLAN_SCHEMA,
    effort: "high",
    maxTokens: 16000,
  });

  const plan = parsePlan(result.parsed);

  await emit(db, {
    type: "ia.gerou",
    workspaceId: getWorkspaceId(),
    payload: { task: "planejamento", year: period.year, month: period.month },
  });

  try {
    await db.from("ai_generations").insert({
      workspace_id: getWorkspaceId(),
      kind: "planejamento",
      provider: result.provider,
      model: result.model,
      input_tokens: result.usage?.inputTokens ?? null,
      output_tokens: result.usage?.outputTokens ?? null,
      result: { diagnosis: plan.diagnosis, items: plan.items.length },
    });
  } catch {
    // Auditoria e best-effort: nunca derruba a geracao.
  }

  return plan;
}

// Reescrita do plano a partir de uma conversa. O cronograma atual entra inteiro
// para que o Diretor saiba o que preservar — sem isso ele reinventa tudo e a
// pessoa perde os itens que ja tinha aprovado mentalmente.
function renderRevision(
  plano: MonthlyPlan | undefined,
  conversa: { role: "user" | "assistant"; content: string }[],
): string {
  const atual = plano
    ? plano.items
        .map((i) => `- dia ${i.day}, ${i.hour}h — ${i.title} (${i.format}${i.pillar ? `, ${i.pillar}` : ""})`)
        .join("\n")
    : "";

  const dialogo = conversa
    .map((t) => `${t.role === "user" ? "ELA" : "VOCE"}: ${t.content}`)
    .join("\n\n");

  return `# Revisao

Voce ja tinha proposto este cronograma:

${atual || "(nenhum)"}

Depois voces conversaram sobre ele:

${dialogo}

Refaca o cronograma incorporando o que foi combinado. Preserve os itens que ela nao questionou — mudar o que estava bom desperdicia a decisao que ela ja tomou. Altere, remova ou acrescente apenas o que a conversa pediu.`;
}

const MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function buildPlanPrompt(ctx: PlanningContext): string {
  const nome = MESES[ctx.period.month];
  const dias = new Date(ctx.period.year, ctx.period.month + 1, 0).getDate();

  // Sem a data de hoje o modelo planeja o mes inteiro a partir do dia 1 — e no
  // dia 10 metade do cronograma ja nasce no passado.
  const hoje = new Date();
  const mesCorrente =
    hoje.getFullYear() === ctx.period.year && hoje.getMonth() === ctx.period.month;
  const primeiroDia = mesCorrente ? hoje.getDate() : 1;
  const restantes = dias - primeiroDia + 1;

  const janela = mesCorrente
    ? `HOJE E DIA ${hoje.getDate()} DE ${nome.toUpperCase()}. Restam ${restantes} dias no mes.
Nao proponha nada antes do dia ${primeiroDia} — esses dias ja passaram e um conteudo com data no passado nasce atrasado.
Distribua os conteudos entre o dia ${primeiroDia} e o dia ${dias}.`
    : `Planeje o mes inteiro, do dia 1 ao dia ${dias}.`;

  return `# Tarefa

Monte o cronograma de conteudo de ${nome} de ${ctx.period.year} (${dias} dias).

${janela}

Comece por um diagnostico honesto do cenario acima — leia as metricas reais, nao suponha. Se o desempenho caiu, diga o que os numeros mostram e o que provavelmente causou. Se algo funcionou muito acima da media, aponte e proponha repetir a mecanica, nao o assunto.

Depois defina o foco do mes: uma aposta central que decorra do diagnostico.

Entao proponha os conteudos. Regras:
- Volume realista para o tempo que resta, nao para um mes cheio. Prefira poucos conteudos que saem a muitos que ficam no papel.
- No campo why, so cite dia da semana se ele corresponder a data que voce escolheu. Conferir isso e sua responsabilidade.
- Aproveite primeiro os Momentos que ainda nao viraram conteudo — eles ja aconteceram na vida dela e por isso rendem material especifico. Use o indice da lista em momentIndex.
- Use os melhores horarios informados para escolher a hora. Se nao houver dado para o dia, escolha o horario mais proximo entre os que existem.
- Distribua ao longo do mes; nao empilhe tudo na primeira semana.
- Respeite as datas comemorativas relevantes, considerando o lead_days de cada uma.
- Nao repita conteudo que ja esta planejado no mes (lista "Ja planejado").
- Em pillar, use exatamente um dos nomes de pilar listados. Se nenhum servir, deixe vazio.
- Cada item precisa de um why que amarre a um numero, a um Momento ou ao diagnostico. "Boa ideia" nao e justificativa.

Nao invente metricas, clientes ou fatos da vida dela que nao estejam no contexto.`;
}

// Render enxuto: o contexto bruto tem muito ruido e o que nao ajuda a decidir
// atrapalha. Secoes vazias sao omitidas em vez de aparecerem como "(nenhum)",
// para nao sugerir ao modelo que ele precisa preencher o vazio.
export function renderPlanningContext(ctx: PlanningContext): string {
  const partes: string[] = [];
  const add = (titulo: string, corpo: string) => {
    if (corpo.trim()) partes.push(`## ${titulo}\n${corpo.trim()}`);
  };

  for (const [kind, rotulo] of [
    ["brand", "Brand Brain"],
    ["business", "Business Brain"],
    ["learned", "Learned Brain"],
  ] as const) {
    const secoes = Object.entries(ctx.brains[kind] ?? {})
      .filter(([, v]) => String(v ?? "").trim())
      .map(([k, v]) => `### ${k}\n${v}`)
      .join("\n\n");
    add(rotulo, secoes);
  }

  add("Pilares", ctx.pillars.map((p) => `- ${p.name}`).join("\n"));

  add(
    "Objetivos do trimestre",
    ctx.objectives
      .map((o) => `- ${o.title}${o.target ? ` (meta ${o.target}, hoje ${o.progress})` : ""}`)
      .join("\n"),
  );

  // Metricas de conta (content_id nulo) sao o resumo do periodo; as demais sao
  // por conteudo. O modelo precisa saber a diferenca.
  const conta = ctx.metrics.filter((m) => !m.content_id);
  add(
    "Desempenho recente (dados reais)",
    conta
      .map((m) => {
        const campos = [
          m.reach != null ? `alcance ${m.reach}` : null,
          m.followers_gained != null ? `saldo de seguidores ${m.followers_gained}` : null,
          m.saves != null ? `salvamentos ${m.saves}` : null,
          m.shares != null ? `compartilhamentos ${m.shares}` : null,
          m.comments != null ? `comentarios ${m.comments}` : null,
        ].filter(Boolean);
        return `- ate ${m.collected_at.slice(0, 10)}: ${campos.join(", ")}`;
      })
      .join("\n"),
  );

  const naoUsados = ctx.recentMoments.filter((m) => !m.converted);
  add(
    "Momentos ainda nao aproveitados (use o indice em momentIndex)",
    naoUsados.map((m, i) => `[${i}] ${m.created_at.slice(0, 10)} — ${m.body}`).join("\n"),
  );

  add(
    "Conteudos recentes",
    ctx.contentHistory
      .slice(0, 25)
      .map((c) => `- ${c.title} (${c.status}${c.format ? `, ${c.format}` : ""})`)
      .join("\n"),
  );

  add(
    "Ja planejado neste mes",
    ctx.alreadyPlanned.map((c) => `- dia ${c.planned_at.slice(8, 10)}: ${c.title}`).join("\n"),
  );

  if (ctx.bestTimes) {
    add(
      "Melhores horarios por dia da semana",
      Object.entries(ctx.bestTimes)
        .map(([dia, horas]) => `- ${dia}: ${horas.map((h) => `${h}h`).join(", ")}`)
        .join("\n"),
    );
  }

  add(
    "Datas comemorativas",
    ctx.commemorativeDates
      .filter((d) => d.month === ctx.period.month + 1)
      .map((d) => `- dia ${d.day}: ${d.name} (comecar ${d.lead_days} dias antes)`)
      .join("\n"),
  );

  if (ctx.missing.length > 0) {
    add(
      "Indisponivel",
      `Nao consegui ler: ${ctx.missing.join(", ")}. Trate como desconhecido, nao como vazio.`,
    );
  }

  return partes.join("\n\n");
}

function parsePlan(parsed: unknown): MonthlyPlan {
  if (!parsed || typeof parsed !== "object") {
    throw new AiProviderError("A IA devolveu um plano que nao consegui interpretar.");
  }
  const v = parsed as Record<string, unknown>;
  if (!Array.isArray(v.items)) {
    throw new AiProviderError("A IA nao devolveu a lista de conteudos do mes.");
  }

  return {
    diagnosis: String(v.diagnosis ?? ""),
    focus: String(v.focus ?? ""),
    items: (v.items as Record<string, unknown>[]).map((i) => ({
      day: Number(i.day ?? 1),
      hour: Number(i.hour ?? 12),
      title: String(i.title ?? ""),
      format: String(i.format ?? ""),
      objective: String(i.objective ?? ""),
      pillar: String(i.pillar ?? ""),
      hook: String(i.hook ?? ""),
      why: String(i.why ?? ""),
      momentIndex: Number(i.momentIndex ?? -1),
    })),
  };
}
