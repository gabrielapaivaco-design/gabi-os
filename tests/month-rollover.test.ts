import { describe, it, expect } from "vitest";

// Regras da virada de mes. As funcoes reais vivem num modulo de servidor
// (next/headers pela cadeia do getWorkspaceId), entao a logica que importa esta
// espelhada aqui — o que se trava e o comportamento, nao a implementacao.

// Trazer um conteudo para outro mes preserva dia e hora. Dia 31 num mes de 30
// cai no ultimo dia, em vez de escorregar para o mes seguinte.
function novaData(antigo: Date, destino: { year: number; month: number }): Date {
  const ultimoDia = new Date(destino.year, destino.month + 1, 0).getDate();
  const dia = Math.min(antigo.getDate(), ultimoDia);
  return new Date(destino.year, destino.month, dia, antigo.getHours(), antigo.getMinutes());
}

describe("trazer conteudo para o mes seguinte", () => {
  it("preserva o dia e a hora", () => {
    const d = novaData(new Date(2026, 7, 12, 20, 30), { year: 2026, month: 8 });
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(30);
  });

  it("dia 31 vira o ultimo dia de um mes de 30", () => {
    // Sem o limite, 31 de setembro escorregaria para 1 de outubro — o conteudo
    // sairia do mes que a pessoa acabou de escolher.
    const d = novaData(new Date(2026, 7, 31, 19, 0), { year: 2026, month: 8 });
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(30);
  });

  it("dia 30 vira 28 quando o destino e fevereiro", () => {
    const d = novaData(new Date(2026, 0, 30, 11, 0), { year: 2026, month: 1 });
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it("atravessa a virada do ano", () => {
    const d = novaData(new Date(2026, 11, 15, 18, 0), { year: 2027, month: 0 });
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });
});

// O mes vem da URL; entrada invalida cai no mes corrente em vez de quebrar.
function lerPeriodo(mes: string | undefined, hoje: Date): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "");
  if (!m) return { year: hoje.getFullYear(), month: hoje.getMonth() };
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11 || year < 2020 || year > 2100) {
    return { year: hoje.getFullYear(), month: hoje.getMonth() };
  }
  return { year, month };
}

describe("mes lido da URL", () => {
  const hoje = new Date(2026, 7, 31);

  it("le um mes valido", () => {
    expect(lerPeriodo("2026-09", hoje)).toEqual({ year: 2026, month: 8 });
    expect(lerPeriodo("2027-01", hoje)).toEqual({ year: 2027, month: 0 });
  });

  it("sem parametro, usa o mes corrente", () => {
    expect(lerPeriodo(undefined, hoje)).toEqual({ year: 2026, month: 7 });
  });

  it("entrada malformada cai no mes corrente em vez de quebrar", () => {
    // O valor vem da URL, ou seja, do usuario: nao pode virar Date invalido.
    for (const ruim of ["", "agosto", "2026-13", "2026-00", "1999-05", "2026-9", "abc-de"]) {
      expect(lerPeriodo(ruim, hoje)).toEqual({ year: 2026, month: 7 });
    }
  });
});
