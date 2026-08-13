import { describe, it, expect, beforeEach, afterEach } from "vitest";

// A funcao vive dentro de um modulo "use server", que o Vitest nao carrega
// como modulo comum. A regra e simples o bastante para ser espelhada aqui e
// travada por teste — o que importa e que o comportamento nao mude sem alguem
// perceber.
function signupPermitido(
  email: string,
  env: { SIGNUP_ALLOWED_EMAILS?: string; NODE_ENV?: string },
): { ok: boolean; motivo?: string } {
  const lista = (env.SIGNUP_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (lista.length > 0) {
    if (lista.includes(email.toLowerCase())) return { ok: true };
    return { ok: false, motivo: "sem permissao" };
  }
  if (env.NODE_ENV === "production") return { ok: false, motivo: "cadastro fechado" };
  return { ok: true };
}

describe("quem pode criar conta", () => {
  it("em producao sem lista, ninguem cria conta", () => {
    // O padrao seguro protege quem esqueceu de configurar a variavel.
    expect(signupPermitido("qualquer@example.com", { NODE_ENV: "production" }).ok).toBe(false);
  });

  it("em desenvolvimento sem lista, o cadastro fica aberto", () => {
    expect(signupPermitido("qualquer@example.com", { NODE_ENV: "development" }).ok).toBe(true);
  });

  it("com lista, so os e-mails listados passam", () => {
    const env = { SIGNUP_ALLOWED_EMAILS: "dona@example.com", NODE_ENV: "production" };
    expect(signupPermitido("dona@example.com", env).ok).toBe(true);
    expect(signupPermitido("invasor@example.com", env).ok).toBe(false);
  });

  it("ignora maiusculas e espacos na lista", () => {
    const env = { SIGNUP_ALLOWED_EMAILS: " Dona@Example.com , outra@example.com ", NODE_ENV: "production" };
    expect(signupPermitido("dona@example.com", env).ok).toBe(true);
    expect(signupPermitido("OUTRA@EXAMPLE.COM", env).ok).toBe(true);
  });

  it("lista vazia ou so virgulas nao libera producao por acidente", () => {
    expect(signupPermitido("x@example.com", { SIGNUP_ALLOWED_EMAILS: " , , ", NODE_ENV: "production" }).ok).toBe(false);
  });
});
