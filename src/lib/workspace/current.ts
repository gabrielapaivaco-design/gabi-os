import { cookies } from "next/headers";
import { WORKSPACE_ID } from "@/lib/utils/constants";

// Unico ponto de resolucao do workspace atual — a fronteira entre "quem esta
// usando o sistema" e "quais dados ele enxerga". Todo service e toda rota
// passam por aqui; nenhum lugar do codigo importa WORKSPACE_ID diretamente.
//
// A resolucao le um cookie, escrito pelo seletor da sidebar e corrigido pelo
// middleware quando aponta para um workspace do qual a pessoa nao e membro.
//
// IMPORTANTE: este cookie NAO e a fronteira de seguranca. Ele vem do cliente e
// pode ser adulterado. Quem impede o vazamento entre workspaces e o RLS no
// banco (migration 0005): um cookie apontando para workspace alheio nao mostra
// dado nenhum, so telas vazias. Aqui e preferencia de navegacao, nao permissao.
//
// Alternativas futuras — subdominio ou segmento de rota — trocam apenas o
// corpo desta funcao: a assinatura (sincrona, sem argumentos) ja e a que
// `cookies()`/`headers()` do Next permitem em Server Components e Server
// Actions, entao nenhum call site precisa mudar.
//
// Nao chamar do lado do cliente (browser) — so em Server Components, Server
// Actions e nas funcoes de lib/*/service.ts invocadas a partir deles.

export const WORKSPACE_COOKIE = "gabios_workspace";

export function getWorkspaceId(): string {
  try {
    const fromCookie = cookies().get(WORKSPACE_COOKIE)?.value;
    if (fromCookie && isUuid(fromCookie)) return fromCookie;
  } catch {
    // `cookies()` lanca fora de um escopo de request (ex.: durante o build
    // estatico). Nesses casos o workspace padrao e a resposta correta.
  }
  return WORKSPACE_ID;
}

// Validado antes de virar filtro de query: o valor vem de um cookie, ou seja,
// do cliente. Um workspace_id malformado nunca chega ao banco.
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
