import { describe, it, expect } from "vitest";
import { avisoDeRitmo, medirRitmo, semanasDoMes } from "@/lib/planning/ritmo";

// Outubro de 2026 tem 31 dias. O plano real que motivou isto caiu nos dias
// 3, 6, 8, 12, 14, 16, 19, 20, 21, 24, 27, 29 — doze itens em 2, 3, 4, 2, 1.
//
// A semana 3 ficou com o dobro da densidade da 1 e da 4. A ultima, que parecia
// o buraco do mes com um item so, tem tres dias: proporcionalmente e mais
// densa que a primeira.
const OUTUBRO_REAL = [3, 6, 8, 12, 14, 16, 19, 20, 21, 24, 27, 29];

describe("semanasDoMes", () => {
  it("quebra o mes em blocos de sete, com a ultima parcial", () => {
    const s = semanasDoMes(2026, 9);
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ primeiroDia: 1, ultimoDia: 7, dias: 7 });
    expect(s[4]).toMatchObject({ primeiroDia: 29, ultimoDia: 31, dias: 3 });
  });

  it("fevereiro de 28 fecha exato em quatro semanas", () => {
    const s = semanasDoMes(2026, 1);
    expect(s).toHaveLength(4);
    expect(s[3]).toMatchObject({ ultimoDia: 28, dias: 7 });
  });
});

describe("medirRitmo", () => {
  it("reconhece o desequilibrio do plano real de outubro", () => {
    const r = medirRitmo(OUTUBRO_REAL, 2026, 9);
    expect(r.total).toBe(12);
    expect(r.semanas.map((s) => s.itens)).toEqual([2, 3, 4, 2, 1]);
    expect(r.desequilibrado).toBe(true);
  });

  it("mede o maior buraco entre dois conteudos", () => {
    // Entre o dia 8 e o 12 ha tres dias vazios; entre 24 e 27, dois.
    expect(medirRitmo(OUTUBRO_REAL, 2026, 9).maiorBuraco).toBe(3);
    expect(medirRitmo([1, 10, 20], 2026, 9).maiorBuraco).toBe(9);
  });

  it("nao conta como buraco o vazio antes do primeiro nem depois do ultimo", () => {
    // Come�a no 10 e termina no 12: o mes vazio em volta nao e buraco, e
    // comeco e fim.
    expect(medirRitmo([10, 11, 12], 2026, 9).maiorBuraco).toBe(0);
  });

  it("a semana curta do fim nao e acusada de fraca por ter menos itens", () => {
    const r = medirRitmo(OUTUBRO_REAL, 2026, 9);
    const ultima = r.semanas[r.semanas.length - 1];
    const primeira = r.semanas[0];
    expect(ultima.itens).toBeLessThan(primeira.itens);
    expect(ultima.itens / ultima.dias).toBeGreaterThan(primeira.itens / primeira.dias);
  });

  it("um mes bem distribuido nao e marcado como desequilibrado", () => {
    const bem = [2, 5, 9, 12, 16, 19, 23, 26, 30];
    expect(medirRitmo(bem, 2026, 9).desequilibrado).toBe(false);
  });

  it("compara por densidade, entao a semana parcial nao parece fraca a toa", () => {
    // Semanas de 7 dias com 3 itens, e a ultima de 3 dias com 1: proporcional,
    // nao desequilibrado.
    const proporcional = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 30];
    expect(medirRitmo(proporcional, 2026, 9).desequilibrado).toBe(false);
  });

  it("respeita o primeiro dia valido no mes corrente", () => {
    // Plano feito no dia 20: as semanas anteriores nem entram na conta.
    const r = medirRitmo([21, 23, 26, 29], 2026, 9, 20);
    expect(r.semanas.every((s) => s.ultimoDia >= 20)).toBe(true);
    expect(r.total).toBe(4);
  });

  it("plano vazio nao quebra", () => {
    const r = medirRitmo([], 2026, 9);
    expect(r.total).toBe(0);
    expect(r.maiorBuraco).toBe(0);
  });
});

describe("avisoDeRitmo", () => {
  it("avisa sobre o plano real de outubro", () => {
    const aviso = avisoDeRitmo(medirRitmo(OUTUBRO_REAL, 2026, 9));
    expect(aviso).toContain("irregular");
    expect(aviso).toContain("s5=1");
  });

  it("cala a boca quando o ritmo esta bom", () => {
    // Um aviso que aparece sempre deixa de ser aviso.
    expect(avisoDeRitmo(medirRitmo([2, 5, 9, 12, 16, 19, 23, 26, 30], 2026, 9))).toBeNull();
  });

  it("avisa de buraco longo mesmo com as semanas equilibradas", () => {
    const aviso = avisoDeRitmo(medirRitmo([1, 2, 3, 4, 13, 14, 15, 16, 25, 26, 27, 28], 2026, 9));
    expect(aviso).toContain("dias seguidos sem nada");
  });

  it("plano vazio nao gera aviso", () => {
    expect(avisoDeRitmo(medirRitmo([], 2026, 9))).toBeNull();
  });
});
