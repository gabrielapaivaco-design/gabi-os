import type { ContentCardData } from "./pipeline-board";

// Busca por titulo/trecho do Momento + filtro por pilar. Pura, sem estado —
// usada tanto pra decidir o que fica "dimmed" no board quanto em testes.
export function cardMatchesFilter(
  card: ContentCardData,
  search: string,
  pillarId: string,
): boolean {
  const q = search.trim().toLowerCase();
  const matchesSearch =
    q === "" ||
    card.title.toLowerCase().includes(q) ||
    (card.momentExcerpt ?? "").toLowerCase().includes(q);
  const matchesPillar = pillarId === "" || card.pillarId === pillarId;
  return matchesSearch && matchesPillar;
}
