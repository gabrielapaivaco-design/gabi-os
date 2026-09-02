import { describe, it, expect } from "vitest";
import { WEEKDAYS, WEEKDAY_LABEL, weekdayDe } from "@/lib/planning/weekday";

describe("weekdayDe", () => {
  it("traduz cada dia da semana", () => {
    // 2026-08-31 e uma segunda-feira; sete dias seguidos cobrem a semana toda.
    const esperado = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
    for (let i = 0; i < 7; i++) {
      expect(weekdayDe(new Date(2026, 7, 31 + i))).toBe(esperado[i]);
    }
  });

  it("domingo nao vira segunda", () => {
    // O getDay() do JS comeca no domingo com 0; nossa semana comeca na segunda.
    // Sem o deslocamento, todo domingo mostraria o tema de segunda.
    const domingo = new Date(2026, 8, 6);
    expect(domingo.getDay()).toBe(0);
    expect(weekdayDe(domingo)).toBe("domingo");
  });

  it("segunda e o primeiro da lista", () => {
    const segunda = new Date(2026, 8, 7);
    expect(segunda.getDay()).toBe(1);
    expect(weekdayDe(segunda)).toBe(WEEKDAYS[0]);
  });

  it("a hora do dia nao muda o resultado", () => {
    expect(weekdayDe(new Date(2026, 8, 1, 0, 0))).toBe(weekdayDe(new Date(2026, 8, 1, 23, 59)));
  });

  it("sempre devolve um dia conhecido, em qualquer data", () => {
    for (let i = 0; i < 400; i++) {
      const d = new Date(2026, 0, 1 + i);
      expect(WEEKDAYS).toContain(weekdayDe(d));
    }
  });
});

describe("WEEKDAY_LABEL", () => {
  it("todo dia tem rotulo", () => {
    for (const d of WEEKDAYS) {
      expect(WEEKDAY_LABEL[d]).toBeTruthy();
    }
  });
});
