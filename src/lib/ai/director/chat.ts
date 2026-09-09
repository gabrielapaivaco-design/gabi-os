import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiProvider, type AiMessage } from "@/lib/ai";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import { buildContentContext, renderContextForPrompt } from "./context";
import { DIRECTOR_SYSTEM } from "./prompts";
import { CAMPOS_EDITAVEIS, lerEdits, type CardEdits } from "./card-edits";

// Reexportados para nao quebrar quem ja importava daqui.
export { CAMPO_LABEL, CAMPOS_EDITAVEIS, type CardEdits } from "./card-edits";

// Conversa com o Diretor.
//
// As quatro tarefas (roteiro, legenda, angulos, analise) sao de mao unica: uma
// pergunta, uma resposta estruturada. Servem quando voce sabe o que quer. Nao
// servem quando a IA entendeu literal demais e voce precisa dizer "mais leve",
// "corta a parte do meio", "e se comecasse pelo fim?".
//
// A resposta tem duas partes: o texto que ela le, escrito como uma pessoa
// responderia, e — quando ela pediu uma alteracao — os campos do card ja
// reescritos. O historico inteiro vai junto a cada turno, entao o Diretor
// lembra do que voce corrigiu tres mensagens atras.

// Instrucoes que valem so na conversa. O DIRECTOR_SYSTEM continua definindo a
// voz e as regras; isto ajusta o registro para dialogo em vez de entrega.
const CHAT_SYSTEM = `${DIRECTOR_SYSTEM}

Agora voce esta CONVERSANDO com essa pessoa sobre um conteudo especifico, nao entregando uma tarefa fechada.

Na conversa:
- Responda curto. Duas ou tres frases resolvem a maioria das trocas; texto longo so quando ela pedir um roteiro ou uma legenda inteira.
- Quando ela te corrigir, acate de verdade — nao repita a mesma ideia com outras palavras. Se ela disse "mais leve", fica mais leve mesmo.
- Interprete a intencao, nao so a letra do que foi dito. "Ficou meio quadrado" nao pede sinonimos, pede outro ritmo.
- Pode discordar quando tiver motivo, mas em uma frase, e proponha a alternativa em vez de so apontar o problema.

# Como voce altera o conteudo

Voce tem duas saidas: \`reply\`, que e o que ela le, e \`edits\`, que sao os campos do card.

Quando ela pedir uma MUDANCA em algum campo — "muda o hook", "deixa a legenda mais curta", "reescreve o roteiro comecando pelo fim", "troca o titulo" — escreva o texto novo em \`edits\`, no campo certo, JA PRONTO para entrar no card.

Nesse caso a \`reply\` fica curtissima: uma frase dizendo o que voce mudou e por que. NAO repita o texto novo dentro da reply — ela ja vai ver o texto na proposta, e ler duas vezes a mesma coisa e pior do que ler uma.

Preencha SOMENTE os campos que mudam. Todo campo que voce nao esta alterando fica null — inclusive os que ela nao mencionou.

Quando ela so pergunta, opina ou pede ideia sem pedir alteracao, todos os campos de \`edits\` ficam null e a conversa segue normal na \`reply\`.

Escreva no campo o texto FINAL, do jeito que vai para o Instagram: sem aspas em volta, sem "Hook:" na frente, sem comentario seu no meio.`;

const CHAT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "edits"],
  properties: {
    reply: {
      type: "string",
      description:
        "O que ela le. Curto. Quando houver edits, uma frase dizendo o que mudou — sem repetir o texto novo.",
    },
    edits: {
      type: "object",
      additionalProperties: false,
      required: ["title", "hook", "script", "caption", "cta"],
      description: "Campos do card. null em tudo que nao muda nesta resposta.",
      properties: {
        title: { type: ["string", "null"] },
        hook: { type: ["string", "null"] },
        script: { type: ["string", "null"] },
        caption: { type: ["string", "null"] },
        cta: { type: ["string", "null"] },
      },
    },
  },
};

export interface DirectorChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DirectorChatReply {
  text: string;
  // Nulo quando a resposta nao propoe nenhuma alteracao.
  edits: CardEdits | null;
}

export async function chatWithDirector(
  db: SupabaseClient,
  contentId: string,
  history: DirectorChatTurn[],
): Promise<DirectorChatReply> {
  if (history.length === 0) {
    throw new Error("A conversa precisa de pelo menos uma mensagem.");
  }

  const provider = getAiProvider();
  const context = await buildContentContext(db, contentId);

  // O contexto entra colado na primeira mensagem do usuario, e nao como turno
  // separado, porque um turno "aqui esta o contexto" convida o modelo a
  // responder ao contexto em vez de a pergunta.
  const messages: AiMessage[] = history.map((turn, i) =>
    i === 0 && turn.role === "user"
      ? {
          role: "user" as const,
          content: `${renderContextForPrompt(context)}\n\n---\n\n${turn.content}`,
        }
      : { role: turn.role, content: turn.content },
  );

  let text: string;
  let edits: CardEdits | null = null;
  try {
    const result = await provider.generate({
      system: CHAT_SYSTEM,
      messages,
      jsonSchema: CHAT_SCHEMA,
      // Esforco medio: numa conversa ela corrige na mensagem seguinte, e a
      // ida e volta rapida vale mais que a ultima gota de qualidade.
      effort: "medium",
      // Uma excecao ao "conversa e barata": quando a conversa passa a escrever
      // o roteiro que vai ao ar, ela deixou de ser conversa. O texto final
      // merece o modelo bom, como merece nas outras tarefas de produto.
      tier: "best",
      maxTokens: 8000,
    });

    const parsed = (result.parsed ?? {}) as Record<string, unknown>;
    text = String(parsed.reply ?? "").trim();
    edits = lerEdits(parsed.edits);

    await logChat(db, contentId, provider.name, result.model, {
      usage: result.usage,
      turns: history.length,
      reply: text,
      // Auditoria registra QUAIS campos foram propostos, nao o conteudo deles:
      // o texto ja vive no card, e duplicar aqui so incharia o historico.
      camposPropostos: edits ? CAMPOS_EDITAVEIS.filter((c) => edits?.[c]) : [],
    });
  } catch (err) {
    await logChat(db, contentId, provider.name, provider.modelFor("best"), {
      turns: history.length,
      error: err instanceof Error ? err.message : "Erro desconhecido.",
    });
    throw err;
  }

  // Resposta vazia so e falha quando nao veio proposta junto: se o Diretor
  // reescreveu o roteiro e economizou nas palavras, a entrega existe.
  if (!text && !edits) {
    throw new Error("O Diretor devolveu uma resposta vazia.");
  }

  await emit(db, {
    type: "ia.gerou",
    workspaceId: getWorkspaceId(),
    payload: { content_id: contentId, task: "conversa" },
  });

  return { text, edits };
}

// Mesma auditoria das tarefas estruturadas: custo e historico por workspace.
// Nunca derruba a conversa.
async function logChat(
  db: SupabaseClient,
  contentId: string,
  providerName: string,
  model: string,
  entry: {
    usage?: { inputTokens: number; outputTokens: number };
    turns: number;
    reply?: string;
    camposPropostos?: string[];
    error?: string;
  },
): Promise<void> {
  try {
    await db.from("ai_generations").insert({
      workspace_id: getWorkspaceId(),
      content_id: contentId,
      kind: "conversa",
      provider: providerName,
      model,
      input_tokens: entry.usage?.inputTokens ?? null,
      output_tokens: entry.usage?.outputTokens ?? null,
      result: entry.reply ? { turns: entry.turns, reply: entry.reply } : null,
      error: entry.error ?? null,
    });
  } catch {
    // Tabela ausente ou banco indisponivel.
  }
}
