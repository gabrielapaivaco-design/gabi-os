import { describe, it, expect } from "vitest";
import { cardMatchesFilter } from "@/app/pipeline/filter";
import type { ContentCardData } from "@/app/pipeline/pipeline-board";

function card(overrides: Partial<ContentCardData> = {}): ContentCardData {
  return {
    id: "c1",
    title: "Resenha de maquiagem",
    format: null,
    objective: null,
    pillarId: null,
    hook: null,
    script: null,
    caption: null,
    cta: null,
    momentId: null,
    momentExcerpt: null,
    plannedDayKey: null,
    ...overrides,
  };
}

describe("cardMatchesFilter", () => {
  it("sem busca nem filtro, tudo bate", () => {
    expect(cardMatchesFilter(card(), "", "")).toBe(true);
  });

  it("busca por titulo (case-insensitive)", () => {
    expect(cardMatchesFilter(card(), "MAQUIAGEM", "")).toBe(true);
    expect(cardMatchesFilter(card(), "sapato", "")).toBe(false);
  });

  it("busca tambem olha o trecho do Momento", () => {
    const c = card({ title: "Sem relacao", momentExcerpt: "Comprei um batom novo" });
    expect(cardMatchesFilter(c, "batom", "")).toBe(true);
  });

  it("filtro por pilar", () => {
    const c = card({ pillarId: "p1" });
    expect(cardMatchesFilter(c, "", "p1")).toBe(true);
    expect(cardMatchesFilter(c, "", "p2")).toBe(false);
  });

  it("busca e filtro combinados exigem os dois", () => {
    const c = card({ title: "Resenha de maquiagem", pillarId: "p1" });
    expect(cardMatchesFilter(c, "maquiagem", "p1")).toBe(true);
    expect(cardMatchesFilter(c, "maquiagem", "p2")).toBe(false);
    expect(cardMatchesFilter(c, "sapato", "p1")).toBe(false);
  });
});
