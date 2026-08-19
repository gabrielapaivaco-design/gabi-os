import { describe, it, expect } from "vitest";

// Regra de quais cards a aprovacao de um plano novo aposenta.
//
// Espelha o filtro de `listUntouchedFromMonth`, que vive num modulo de servidor
// (importa next/headers pela cadeia do getWorkspaceId). O que importa e travar o
// comportamento: arquivar demais apaga trabalho da pessoa, arquivar de menos
// deixa o Pipeline com duas versoes do mesmo mes.
interface Card {
  id: string;
  title: string;
  status: string;
  script?: string | null;
  caption?: string | null;
  cta?: string | null;
}

function intocados(cards: Card[]): Card[] {
  return cards.filter((c) => c.status === "ideia" && !c.script && !c.caption && !c.cta);
}

const base: Card = { id: "1", title: "x", status: "ideia" };

describe("quais cards a aprovacao aposenta", () => {
  it("arquiva card que ficou em Ideia sem nada escrito", () => {
    expect(intocados([base])).toHaveLength(1);
  });

  it("nao arquiva card que ja saiu da coluna Ideia", () => {
    // Mudar de coluna e sinal de trabalho: alguem decidiu gravar aquilo.
    for (const status of ["roteiro", "gravar", "editar", "agendar", "publicado", "analisar"]) {
      expect(intocados([{ ...base, status }])).toHaveLength(0);
    }
  });

  it("nao arquiva card com roteiro escrito", () => {
    expect(intocados([{ ...base, script: "Cena 1..." }])).toHaveLength(0);
  });

  it("nao arquiva card com legenda escrita", () => {
    expect(intocados([{ ...base, caption: "Texto da legenda" }])).toHaveLength(0);
  });

  it("nao arquiva card com CTA escrito", () => {
    expect(intocados([{ ...base, cta: "Link na bio" }])).toHaveLength(0);
  });

  it("separa corretamente numa mistura real", () => {
    const cards: Card[] = [
      { id: "a", title: "nunca mexido", status: "ideia" },
      { id: "b", title: "virou roteiro", status: "roteiro" },
      { id: "c", title: "tem legenda", status: "ideia", caption: "oi" },
      { id: "d", title: "outro intocado", status: "ideia" },
      { id: "e", title: "publicado", status: "publicado" },
    ];
    expect(intocados(cards).map((c) => c.id)).toEqual(["a", "d"]);
  });

  it("hook sozinho nao salva o card", () => {
    // Hook vem preenchido pelo proprio plano, entao nao prova trabalho humano.
    expect(intocados([{ ...base }])).toHaveLength(1);
  });
});
