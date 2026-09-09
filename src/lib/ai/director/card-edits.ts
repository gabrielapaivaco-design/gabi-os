// Os campos do card que o Diretor pode reescrever numa conversa.
//
// Vive separado de ./chat.ts porque a tela do chat e um componente cliente e
// precisa destes VALORES para listar o que mudou. O chat.ts alcanca
// `next/headers` pela cadeia do getWorkspaceId: importar um valor de la dentro
// do cliente compila, passa no lint e quebra em execucao. Ja aconteceu uma vez,
// no /historico.

export interface CardEdits {
  title: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
}

export const CAMPOS_EDITAVEIS = ["title", "hook", "script", "caption", "cta"] as const;

export const CAMPO_LABEL: Record<keyof CardEdits, string> = {
  title: "Titulo",
  hook: "Hook",
  script: "Roteiro",
  caption: "Legenda",
  cta: "CTA",
};

// Limpa o que o modelo devolveu. Campo vazio ou so espaco vira null: uma
// proposta de apagar o roteiro nao pode nascer de um descuido de formatacao.
export function lerEdits(bruto: unknown): CardEdits | null {
  if (!bruto || typeof bruto !== "object") return null;
  const v = bruto as Record<string, unknown>;

  const edits = {} as CardEdits;
  let algum = false;
  for (const campo of CAMPOS_EDITAVEIS) {
    const texto = typeof v[campo] === "string" ? (v[campo] as string).trim() : "";
    edits[campo] = texto || null;
    if (texto) algum = true;
  }

  return algum ? edits : null;
}

// Quais campos esta proposta realmente altera.
export function camposAlterados(edits: CardEdits): (keyof CardEdits)[] {
  return CAMPOS_EDITAVEIS.filter((c) => Boolean(edits[c]));
}
