import { describe, it, expect } from "vitest";
import { WEEKDAYS, montarSemana } from "@/lib/ai/director/planner";

// A rotina de Stories vem do modelo e nem sempre respeita "sete dias". Ja veio
// com oito, repetindo domingo — o que na tela virava duas tarefas para o mesmo
// dia. `montarSemana` reconstroi a semana em vez de confiar na lista recebida.

describe("WEEKDAYS", () => {
  it("cobre os sete dias, de segunda a domingo", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe("segunda");
    expect(WEEKDAYS[6]).toBe("domingo");
  });
});

describe("montarSemana", () => {
  it("ordena de segunda a domingo, nao pela ordem recebida", () => {
    const r = montarSemana([
      { weekday: "quinta", theme: "d" },
      { weekday: "segunda", theme: "a" },
      { weekday: "domingo", theme: "g" },
      { weekday: "terca", theme: "b" },
    ]);
    expect(r.map((d) => d.weekday)).toEqual(["segunda", "terca", "quinta", "domingo"]);
  });

  it("dia repetido fica com a primeira entrada, e so uma vez", () => {
    // O caso real: o modelo devolveu oito entradas, com domingo duas vezes.
    const r = montarSemana([
      { weekday: "domingo", theme: "repostar o melhor da semana" },
      { weekday: "domingo", theme: "enquete sobre o proximo projeto" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].theme).toBe("repostar o melhor da semana");
  });

  it("nunca devolve mais de sete dias", () => {
    const bruto = [...WEEKDAYS, ...WEEKDAYS].map((w) => ({ weekday: w, theme: "x" }));
    expect(montarSemana(bruto)).toHaveLength(7);
  });

  it("descarta dia sem tema", () => {
    const r = montarSemana([
      { weekday: "segunda", theme: "bastidor da obra" },
      { weekday: "terca", theme: "   " },
    ]);
    expect(r.map((d) => d.weekday)).toEqual(["segunda"]);
  });

  it("descarta dia que nao existe na semana", () => {
    // "feriado" nao e dia da semana; deixar passar quebraria a ordenacao.
    const r = montarSemana([
      { weekday: "feriado", theme: "x" },
      { weekday: "segunda", theme: "a" },
    ]);
    expect(r.map((d) => d.weekday)).toEqual(["segunda"]);
  });

  it("aceita maiuscula e espaco em volta do nome do dia", () => {
    const r = montarSemana([{ weekday: " Segunda ", theme: "a" }]);
    expect(r).toHaveLength(1);
    expect(r[0].weekday).toBe("segunda");
  });

  it("nao inventa dia que o modelo nao preencheu", () => {
    // Semana incompleta e melhor que semana inventada: o vazio e visivel.
    expect(montarSemana([{ weekday: "sexta", theme: "a" }])).toHaveLength(1);
  });

  it("entrada invalida devolve lista vazia em vez de quebrar", () => {
    expect(montarSemana(null)).toEqual([]);
    expect(montarSemana("nao e lista")).toEqual([]);
    expect(montarSemana([{}, { weekday: 5 }])).toEqual([]);
  });
});
