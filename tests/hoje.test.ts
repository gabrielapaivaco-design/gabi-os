import { describe, it, expect } from "vitest";
import { diaNoFuso, hojeNoFuso, horaNoFuso } from "@/lib/utils/hoje";

// Os instantes abaixo sao UTC. Sao Paulo e UTC-3, entao tudo a partir das 03:00
// UTC ja e o mesmo dia la, e tudo antes disso ainda e o dia anterior.
describe("hojeNoFuso", () => {
  it("as 22h de Brasilia ainda e o mesmo dia, mesmo ja sendo outro em UTC", () => {
    // 2026-10-01T01:00Z = 30/09 as 22h em Sao Paulo. Este e o bug: o servidor
    // dizia 1 de outubro enquanto ela estava no dia 30 publicando.
    const d = hojeNoFuso(new Date("2026-10-01T01:00:00Z"));
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(30);
  });

  it("a virada do dia acontece as 03:00 UTC", () => {
    expect(hojeNoFuso(new Date("2026-09-30T02:59:00Z")).getDate()).toBe(29);
    expect(hojeNoFuso(new Date("2026-09-30T03:00:00Z")).getDate()).toBe(30);
  });

  it("atravessa a virada de mes", () => {
    const d = hojeNoFuso(new Date("2026-10-01T02:00:00Z"));
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(30);
  });

  it("atravessa a virada de ano", () => {
    const d = hojeNoFuso(new Date("2027-01-01T02:00:00Z"));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  it("o dia da semana tambem acompanha o fuso", () => {
    // 2026-10-01T01:00Z e quinta em UTC e quarta em Sao Paulo.
    expect(new Date("2026-10-01T01:00:00Z").getUTCDay()).toBe(4);
    expect(hojeNoFuso(new Date("2026-10-01T01:00:00Z")).getDay()).toBe(3);
  });

  it("de dia, quando os dois fusos concordam, nao muda nada", () => {
    const d = hojeNoFuso(new Date("2026-09-30T14:41:00Z"));
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(30);
  });

  it("vem com a hora zerada: responde que DIA e, nao que horas sao", () => {
    const d = hojeNoFuso(new Date("2026-09-30T14:41:00Z"));
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe("horaNoFuso", () => {
  it("converte de UTC para a hora local", () => {
    expect(horaNoFuso(new Date("2026-09-30T14:00:00Z"))).toBe(11);
    expect(horaNoFuso(new Date("2026-10-01T01:00:00Z"))).toBe(22);
  });

  it("meia-noite volta zero, e nao 24", () => {
    expect(horaNoFuso(new Date("2026-10-01T03:00:00Z"))).toBe(0);
  });
});

describe("diaNoFuso", () => {
  it("um Momento das 22h e de hoje, nao de amanha", () => {
    // 2026-10-01T01:00Z sao 22h do dia 30 em Sao Paulo. Lido pelo relogio do
    // servidor, esse Momento apareceria agrupado em 1 de outubro.
    expect(diaNoFuso("2026-10-01T01:00:00Z")).toBe("2026-09-30");
  });

  it("formata na ordem que ordena certo", () => {
    expect(diaNoFuso("2026-03-05T15:00:00Z")).toBe("2026-03-05");
  });

  it("aceita Date alem de texto", () => {
    expect(diaNoFuso(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
  });

  it("data invalida devolve vazio em vez de NaN", () => {
    expect(diaNoFuso("nao e data")).toBe("");
  });
});
