"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importExternalPosts, linkPostToContent, unlinkPost } from "@/lib/metrics/service";
import { fromWindsorRows, type WindsorRow } from "@/lib/metrics/sources/windsor";

export type ReconcileResult = { ok: true; mensagem?: string } | { ok: false; error: string };

function revalidarTudo(): void {
  revalidatePath("/conciliacao");
  revalidatePath("/pipeline");
  revalidatePath("/planejamento");
  revalidatePath("/");
}

export async function linkPostAction(postId: string, contentId: string): Promise<ReconcileResult> {
  try {
    await linkPostToContent(createClient(), postId, contentId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui vincular." };
  }
  revalidarTudo();
  return { ok: true };
}

export async function unlinkPostAction(postId: string): Promise<ReconcileResult> {
  try {
    await unlinkPost(createClient(), postId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui desfazer." };
  }
  revalidarTudo();
  return { ok: true };
}

// Importacao manual. O texto colado e a resposta crua da origem — hoje as linhas
// do conector `instagram` do Windsor, obtidas por quem tem a conexao.
//
// Quando existir integracao por API, esta action deixa de ser a unica porta: a
// origem passa a implementar `MetricsSource` e chama o mesmo
// `importExternalPosts`. Nada em conciliacao ou aprendizado muda.
export async function importPostsAction(json: string, platform: string): Promise<ReconcileResult> {
  const texto = json.trim();
  if (!texto) return { ok: false, error: "Cole o JSON com as linhas da origem." };

  let rows: WindsorRow[];
  try {
    const parsed = JSON.parse(texto);
    // Aceita tanto o array puro quanto o envelope {"result": [...]} que o
    // Windsor devolve, para nao obrigar ninguem a editar o texto colado.
    const bruto = Array.isArray(parsed) ? parsed : (parsed?.result ?? parsed?.data);
    if (!Array.isArray(bruto)) {
      return { ok: false, error: "Nao encontrei uma lista de linhas nesse JSON." };
    }
    rows = bruto as WindsorRow[];
  } catch {
    return { ok: false, error: "Esse texto nao e um JSON valido." };
  }

  const posts = fromWindsorRows(rows, platform);
  if (posts.length === 0) {
    return { ok: false, error: "Nenhuma linha tinha identificador de midia (media_id)." };
  }

  try {
    const r = await importExternalPosts(createClient(), posts, "windsor-manual");
    revalidarTudo();
    return {
      ok: true,
      mensagem: `${r.posts} ${r.posts === 1 ? "post" : "posts"} importados, ${r.metrics} com metrica.`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nao consegui importar." };
  }
}
