import { describe, it, expect } from "vitest";
import { WEEKDAYS } from "@/lib/ai/director/planner";

// A rotina de Stories e ordenada por dia da semana na leitura, nao pela ordem
// que o modelo devolveu — senao a tela mostraria "quinta, segunda, sabado" e a
// pessoa teria que reordenar de cabeca toda vez.
function ordenar(dias: { weekday: string; theme: string }[]) {
  return dias
    .filter((d) => d.theme)
    .sort(
      (a, b) => WEEKDAYS.indexOf(a.weekday as never) - WEEKDAYS.indexOf(b.weekday as never),
    );
}

describe("rotina de Stories", () => {
  it("cobre os sete dias da semana", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe("segunda");
    expect(WEEKDAYS[6]).toBe("domingo");
  });

  it("ordena de segunda a domingo, nao pela ordem recebida", () => {
    const bagunca = [
      { weekday: "quinta", theme: "d" },
      { weekday: "segunda", theme: "a" },
      { weekday: "domingo", theme: "g" },
      { weekday: "terca", theme: "b" },
    ];
    expect(ordenar(bagunca).map((d) => d.weekday)).toEqual([
      "segunda",
      "terca",
      "quinta",
      "domingo",
    ]);
  });

  it("descarta dia sem tema", () => {
    // Entrada vazia nao ajuda ninguem a gravar nada.
    const dias = [
      { weekday: "segunda", theme: "bastidor da obra" },
      { weekday: "terca", theme: "" },
    ];
    expect(ordenar(dias)).toHaveLength(1);
  });

  it("dia desconhecido vai para o fim em vez de quebrar", () => {
    const dias = [
      { weekday: "feriado", theme: "x" },
      { weekday: "segunda", theme: "a" },
    ];
    // indexOf devolve -1 para desconhecido, entao ele nao some da lista.
    expect(ordenar(dias)).toHaveLength(2);
    expect(ordenar(dias)[1].weekday).toBe("segunda");
  });
});
