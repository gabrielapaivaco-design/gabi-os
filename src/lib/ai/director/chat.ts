import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiProvider, type AiMessage } from "@/lib/ai";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import { buildContentContext, renderContextForPrompt } from "./context";
import { DIRECTOR_SYSTEM } from "./prompts";

// Conversa com o Diretor.
//
// As quatro tarefas (roteiro, legenda, angulos, analise) sao de mao unica: uma
// pergunta, uma resposta estruturada. Servem quando voce sabe o que quer. Nao
// servem quando a IA entendeu literal demais e voce precisa dizer "mais leve",
// "corta a parte do meio", "e se comecasse pelo fim?".
//
// Por isso aqui NAO ha jsonSchema: a resposta e texto livre, como uma pessoa
// responderia. O historico inteiro vai junto a cada turno, entao o Diretor
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
- Quando ela pedir um texto pronto (roteiro, legenda, hook), devolva so o texto, sem explicar o que voce fez antes ou depois.`;

export interface DirectorChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DirectorChatReply {
  text: string;
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
  try {
    const result = await provider.generate({
      system: CHAT_SYSTEM,
      messages,
      // Conversa pede resposta rapida; o esforco alto fica para as tarefas
      // estruturadas, onde a qualidade do texto final importa mais que o tempo.
      effort: "medium",
      maxTokens: 8000,
    });
    text = result.text.trim();

    await logChat(db, contentId, provider.name, result.model, {
      usage: result.usage,
      turns: history.length,
      reply: text,
    });
  } catch (err) {
    await logChat(db, contentId, provider.name, provider.model, {
      turns: history.length,
      error: err instanceof Error ? err.message : "Erro desconhecido.",
    });
    throw err;
  }

  if (!text) {
    throw new Error("O Diretor devolveu uma resposta vazia.");
  }

  await emit(db, {
    type: "ia.gerou",
    workspaceId: getWorkspaceId(),
    payload: { content_id: contentId, task: "conversa" },
  });

  return { text };
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
