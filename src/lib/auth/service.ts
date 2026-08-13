import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string;
}

// Sempre `getUser()`, nunca `getSession()`: o primeiro valida o token contra o
// servidor de auth, o segundo apenas le um cookie que o cliente controla.
export async function getCurrentUser(db: SupabaseClient): Promise<AuthUser | null> {
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

// Mensagens da API de auth vem em ingles e em tom de API. Aqui viram frases
// que dizem o que fazer.
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (m.includes("email not confirmed")) {
    return (
      "Esta conta ainda nao foi confirmada por e-mail. Para uso local, desative " +
      "a confirmacao em Authentication > Sign In / Providers > Email no painel do Supabase."
    );
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Ja existe uma conta com este e-mail. Use Entrar.";
  }
  if (m.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (m.includes("unable to validate email") || m.includes("invalid email")) {
    return "E-mail invalido.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  return message;
}
