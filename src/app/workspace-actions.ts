"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/workspace/current";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  renameWorkspace,
  slugify,
} from "@/lib/workspace/service";

export type WorkspaceActionResult = { ok: true } | { ok: false; error: string };

const COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

export async function switchWorkspaceAction(workspaceId: string): Promise<WorkspaceActionResult> {
  const db = createClient();

  // Conferir o vinculo antes de gravar o cookie. O RLS ja impediria o vazamento
  // de qualquer forma, mas sem esta checagem trocar para um workspace alheio
  // levaria a um app inteiro de telas vazias sem dizer por que.
  const { data, error } = await db
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Voce nao tem acesso a esse workspace." };

  cookies().set(WORKSPACE_COOKIE, workspaceId, COOKIE_OPTIONS);

  // Revalidar o layout inteiro: todas as telas leem dados do workspace ativo.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameWorkspaceAction(
  workspaceId: string,
  name: string,
): Promise<WorkspaceActionResult> {
  try {
    await renameWorkspace(createClient(), { id: workspaceId, name });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui renomear o workspace.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// A confirmacao por digitacao acontece na tela; aqui ela e reconferida, porque
// uma Server Action e alcancavel sem passar pela interface.
export async function deleteWorkspaceAction(
  workspaceId: string,
  confirmacao: string,
): Promise<WorkspaceActionResult> {
  const db = createClient();

  let restantes;
  try {
    const todos = await listWorkspaces(db);
    const alvo = todos.find((w) => w.id === workspaceId);
    if (!alvo) return { ok: false, error: "Workspace nao encontrado." };

    if (confirmacao.trim() !== alvo.name) {
      return { ok: false, error: `Digite exatamente "${alvo.name}" para confirmar.` };
    }

    await deleteWorkspace(db, workspaceId);
    restantes = todos.filter((w) => w.id !== workspaceId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui excluir o workspace.",
    };
  }

  // Sair do workspace que acabou de deixar de existir. Sem isso o cookie
  // apontaria para o vazio ate o seletor se autocorrigir.
  if (restantes.length > 0) {
    cookies().set(WORKSPACE_COOKIE, restantes[0].id, COOKIE_OPTIONS);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createWorkspaceAction(name: string): Promise<WorkspaceActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Da um nome para a marca." };

  const slug = slugify(trimmed);
  if (!slug) {
    return { ok: false, error: "Esse nome nao gera um identificador valido. Use letras ou numeros." };
  }

  try {
    const workspace = await createWorkspace(createClient(), { name: trimmed, slug });
    // Entrar direto no que acabou de criar — e o que a pessoa quer fazer a seguir.
    cookies().set(WORKSPACE_COOKIE, workspace.id, COOKIE_OPTIONS);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Nao consegui criar o workspace.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
