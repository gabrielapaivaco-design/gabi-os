import type { ContentStatus } from "@/types/db";

// Workspace unico do MVP (multi-tenant preparado, mas so um por ora).
export const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export const STATUS_ORDER: ContentStatus[] = [
  "ideia", "roteiro", "gravar", "editar", "agendar", "publicado", "analisar",
];

export const STATUS_LABEL: Record<ContentStatus, string> = {
  ideia: "Ideia", roteiro: "Roteiro", gravar: "Gravar", editar: "Editar",
  agendar: "Agendar", publicado: "Publicado", analisar: "Analisar",
};

export const STATUS_COLOR: Record<ContentStatus, string> = {
  ideia: "#888780", roteiro: "#378ADD", gravar: "#BA7517", editar: "#7F77DD",
  agendar: "#1D9E75", publicado: "#639922", analisar: "#D4537E",
};

// Nomes de cor usados em pillars.color (seed e a UI de criacao de pilar).
// Nem todo nome e uma keyword CSS valida (ex.: "rose", "amber" nao sao), entao
// mapeamos para hex — reaproveitando a paleta ja usada em STATUS_COLOR onde faz
// sentido, para manter consistencia visual.
// Mesma familia dos status (ver tailwind.config.ts): OKLCH com luminosidade
// 0,55 e saturacao 0,10, girando so o matiz. Nove nomes, nove matizes.
//
// Os nomes ficaram como estavam de proposito — o banco guarda "amber" e "rose"
// nas linhas de `pillars`, e renomear exigiria migration para nada. O que mudou
// e so o hex de cada um.
//
// O teal ficou de fora da familia: no matiz dele essa combinacao de luz e
// saturacao cai fora do que o sRGB alcanca, e forcar produziria uma cor mais
// apagada que as vizinhas. Virou um verde-azulado dentro do gamut.
const PILLAR_COLOR_NAMES: Record<string, string> = {
  gray: "#7A6E60",
  blue: "#3179A6",
  amber: "#8C6C1F",
  purple: "#7F62A0",
  teal: "#2A8079",
  green: "#428252",
  pink: "#9A587F",
  rose: "#A45953",
  coral: "#9E6033",
};

// As cores que a tela de pilares oferece. Derivada do mapa acima em vez de
// repetida: uma cor nova entra em um lugar so.
export const PILLAR_COLORS = Object.keys(PILLAR_COLOR_NAMES);

// Aceita tanto nomes conhecidos quanto hex ja pronto (#RRGGBB); cai para um
// cinza neutro se o nome nao for reconhecido, em vez de quebrar o estilo.
export function resolvePillarColor(color: string): string {
  if (color.startsWith("#")) return color;
  return PILLAR_COLOR_NAMES[color] ?? PILLAR_COLOR_NAMES.gray;
}

// A mesma cor, transparente, para tingir o fundo de um cartao.
//
// Derivada da cor de tinta em vez de ser uma segunda paleta: um tom de fundo
// escolhido a parte inevitavelmente desafina do tom da frente com o tempo,
// porque os dois passam a ser mantidos separados.
export function tintColor(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return "transparent";
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// A dose de cor dos cartoes. Comecou em 11%, que era o valor "medio" da tela de
// direcoes — e na tela real 11% sobre bege nao le como cor, le como um bege
// levemente diferente. Subiu para 20% no fundo e 45% na borda: a borda e o que
// realmente marca o cartao, porque e cor cheia contra o papel em vez de cor
// diluida nele.
export const TINT_FUNDO = 0.2;
export const TINT_BORDA = 0.45;
