"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AiNotConfiguredError } from "@/lib/ai";
import { runDirector, type DirectorOutput, type DirectorTask } from "@/lib/ai/director";
import { chatWithDirector, type DirectorChatTurn } from "@/lib/ai/director/chat";

// Como nas demais Server Actions do app, o erro volta como dado em vez de ser
// lancado: o Next.js redige mensagens de excecoes nao tratadas, e o painel
// precisa mostrar o motivo real.
export type DirectorActionResult =
  | { ok: true; output: DirectorOutput }
  | { ok: false; error: string; notConfigured: boolean };

export async function runDirectorAction(
  contentId: string,
  task: DirectorTask,
): Promise<DirectorActionResult> {
  try {
    const output = await runDirector(createClient(), contentId, task);
    // A geracao fica registrada em ai_generations; revalidar mantem qualquer
    // leitura desse historico em dia.
    revalidatePath("/pipeline");
    return { ok: true, output };
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return { ok: false, error: err.message, notConfigured: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido ao chamar a IA.",
      notConfigured: false,
    };
  }
}

export type DirectorChatResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; notConfigured: boolean };

export async function chatWithDirectorAction(
  contentId: string,
  history: DirectorChatTurn[],
): Promise<DirectorChatResult> {
  try {
    const { text } = await chatWithDirector(createClient(), contentId, history);
    revalidatePath("/historico");
    return { ok: true, reply: text };
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return { ok: false, error: err.message, notConfigured: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido ao chamar a IA.",
      notConfigured: false,
    };
  }
}
