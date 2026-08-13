"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth/service";

// Erro devolvido, nunca lancado: o Next redige a mensagem de excecoes nao
// tratadas em Server Action, e numa tela de login isso viraria "algo deu
// errado" no lugar de "senha incorreta".
export type AuthActionResult = { ok: false; error: string };

function readCredentials(formData: FormData): { email: string; password: string } {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

// Quem pode criar conta.
//
// No localhost isso nao importava. Publicado, importa muito: os dados de cada
// conta ficam isolados pelo RLS, mas a chave da Anthropic e UMA SO, do dono do
// deploy. Cada geracao de qualquer pessoa sai do seu credito.
//
// Regra: `SIGNUP_ALLOWED_EMAILS` (separados por virgula) libera exatamente
// esses e-mails. Sem a variavel, o cadastro fica ABERTO em desenvolvimento e
// FECHADO em producao — o padrao seguro e o que protege quem esquecer de
// configurar. Entrar com conta ja existente nunca e afetado.
function signupPermitido(email: string): { ok: true } | { ok: false; motivo: string } {
  const lista = (process.env.SIGNUP_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (lista.length > 0) {
    if (lista.includes(email.toLowerCase())) return { ok: true };
    return { ok: false, motivo: "Este e-mail nao tem permissao para criar conta neste sistema." };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      motivo:
        "O cadastro esta fechado neste sistema. Se voce e a dona, defina SIGNUP_ALLOWED_EMAILS nas variaveis de ambiente.",
    };
  }

  return { ok: true };
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { ok: false, error: "Preencha e-mail e senha." };

  const db = createClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: translateAuthError(error.message) };

  await claimOrphanWorkspaces(db);

  // Fora de try/catch de proposito: redirect() sinaliza por excecao, e
  // captura-la aqui transformaria o sucesso num erro silencioso.
  redirect("/");
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { ok: false, error: "Preencha e-mail e senha." };

  // Checado no servidor, antes de qualquer chamada ao Supabase: esconder o
  // botao na tela nao impede ninguem de chamar a Server Action direto.
  const permissao = signupPermitido(email);
  if (!permissao.ok) return { ok: false, error: permissao.motivo };

  const db = createClient();
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) return { ok: false, error: translateAuthError(error.message) };

  // Sem sessao apos criar a conta significa que o projeto exige confirmacao por
  // e-mail. Dizer isso e melhor do que redirecionar para uma tela vazia.
  if (!data.session) {
    return {
      ok: false,
      error:
        "Conta criada, mas o Supabase esta exigindo confirmacao por e-mail. " +
        "Confirme pelo link enviado, ou desative a confirmacao em " +
        "Authentication > Sign In / Providers > Email e entre normalmente.",
    };
  }

  await claimOrphanWorkspaces(db);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const db = createClient();
  await db.auth.signOut();
  redirect("/login");
}

// A primeira conta do sistema adota os workspaces criados antes da
// autenticacao existir. A funcao no banco e quem decide se e a primeira — aqui
// so chamamos; falhar nao pode impedir o login.
//
// Recebe o cliente que acabou de autenticar em vez de criar um novo: o cliente
// recem-logado ja carrega a sessao em memoria, enquanto um cliente novo
// dependeria de reler cookies escritos nesta mesma requisicao. Sem sessao,
// `auth.uid()` chega nulo na funcao e ela devolve 0 sem adotar nada.
async function claimOrphanWorkspaces(db: SupabaseClient): Promise<void> {
  try {
    await db.rpc("claim_orphan_workspaces");
  } catch {
    // Migration 0005 pendente: a pagina seguinte explica o que falta.
  }
}
