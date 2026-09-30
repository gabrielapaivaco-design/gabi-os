import { describe, it, expect } from "vitest";
import { diasRestantesNoMes } from "@/app/planejamento/fim-do-mes";

// O dia 30 de setembro foi o caso real: gerar o cronograma ali devolveu dois
// itens, os dois no dia 30, e pareceu que o sistema tinha quebrado. Nao tinha —
// o Diretor recebe "restam 1 dias" e propoe o que cabe em um dia.
describe("diasRestantesNoMes", () => {
  it("conta o proprio dia de hoje", () => {
    // 30 de setembro: sobra o dia 30. Um dia, nao zero.
    expect(diasRestantesNoMes(new Date(2026, 8, 30))).toBe(1);
  });

  it("no primeiro dia sobra o mes inteiro", () => {
    expect(diasRestantesNoMes(new Date(2026, 8, 1))).toBe(30);
    expect(diasRestantesNoMes(new Date(2026, 9, 1))).toBe(31);
  });

  it("acerta meses de tamanhos diferentes", () => {
    expect(diasRestantesNoMes(new Date(2026, 1, 20))).toBe(9); // fevereiro de 28
    expect(diasRestantesNoMes(new Date(2024, 1, 20))).toBe(10); // fevereiro bissexto
    expect(diasRestantesNoMes(new Date(2026, 11, 25))).toBe(7); // dezembro
  });

  it("a hora do dia nao muda a contagem", () => {
    expect(diasRestantesNoMes(new Date(2026, 8, 28, 23, 59))).toBe(
      diasRestantesNoMes(new Date(2026, 8, 28, 0, 1)),
    );
  });

  it("nunca devolve zero nem negativo", () => {
    for (let mes = 0; mes < 12; mes++) {
      const ultimo = new Date(2026, mes + 1, 0).getDate();
      expect(diasRestantesNoMes(new Date(2026, mes, ultimo))).toBe(1);
    }
  });
});
