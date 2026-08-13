import { describe, it, expect } from "vitest";
import { buildMonthGrid, dayKey, isoFromDayKey, shiftMonth } from "@/lib/calendar/month";

describe("dayKey", () => {
  it("formata como YYYY-MM-DD com zero a esquerda", () => {
    expect(dayKey(new Date(2026, 7, 5))).toBe("2026-08-05");
    expect(dayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("isoFromDayKey", () => {
  it("volta para a mesma chave apos converter (sem deslocamento de fuso)", () => {
    const key = "2026-08-05";
    expect(dayKey(new Date(isoFromDayKey(key)))).toBe(key);
  });
});

describe("shiftMonth", () => {
  it("avanca e volta meses", () => {
    expect(shiftMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
});

describe("buildMonthGrid", () => {
  it("sempre devolve 42 celulas comecando no domingo", () => {
    const grid = buildMonthGrid(2026, 7);
    expect(grid).toHaveLength(42);
    expect(new Date(grid[0].key + "T12:00:00").getDay()).toBe(0);
  });

  it("marca corretamente os dias do mes e o dia de hoje", () => {
    const grid = buildMonthGrid(2026, 7, new Date(2026, 7, 4));
    const inMonth = grid.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(grid.filter((c) => c.isToday)).toHaveLength(1);
    expect(grid.find((c) => c.isToday)?.key).toBe("2026-08-04");
  });
});
