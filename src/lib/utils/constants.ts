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
const PILLAR_COLOR_NAMES: Record<string, string> = {
  gray: "#888780",
  blue: "#378ADD",
  amber: "#BA7517",
  purple: "#7F77DD",
  teal: "#1D9E75",
  green: "#639922",
  pink: "#D4537E",
  rose: "#B76E79",
  coral: "#C97B63",
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
