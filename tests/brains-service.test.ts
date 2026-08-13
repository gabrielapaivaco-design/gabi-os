import { describe, it, expect } from "vitest";
import { loadBrains, saveBrain } from "@/lib/brains/service";

// Fake minimo do cliente Supabase, no mesmo espirito dos demais testes de
// service. `upsert` e thenable; `select().eq()` resolve a lista de cerebros.
function fakeDb(rows: unknown[] = []) {
  const upserts: Record<string, unknown>[] = [];
  const eventInserts: Record<string, unknown>[] = [];

  return {
    upserts,
    eventInserts,
    from(table: string) {
      if (table === "brains") {
        return {
          select: () => ({
            eq: async () => ({ data: rows, error: null }),
          }),
          upsert: (row: Record<string, unknown>) => {
            upserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "events") {
        return {
          insert: async (row: Record<string, unknown>) => {
            eventInserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  } as any;
}

describe("loadBrains", () => {
  it("devolve os tres cerebros mesmo quando o banco nao tem nenhum", async () => {
    const brains = await loadBrains(fakeDb());
    expect(Object.keys(brains).sort()).toEqual(["brand", "business", "learned"]);
    expect(brains.brand).toEqual({});
  });

  it("carrega as secoes de cada cerebro", async () => {
    const brains = await loadBrains(
      fakeDb([{ kind: "brand", content: { "Voz e tom": "Direta." } }]),
    );
    expect(brains.brand).toEqual({ "Voz e tom": "Direta." });
    expect(brains.business).toEqual({});
  });

  it("descarta valores que nao sao texto em vez de quebrar", async () => {
    const brains = await loadBrains(
      fakeDb([{ kind: "brand", content: { Valores: "ok", Numeros: 42, Lista: ["a"] } }]),
    );
    expect(brains.brand).toEqual({ Valores: "ok" });
  });

  it("tolera content nulo ou em formato inesperado", async () => {
    const brains = await loadBrains(
      fakeDb([
        { kind: "brand", content: null },
        { kind: "business", content: ["nao e um objeto"] },
      ]),
    );
    expect(brains.brand).toEqual({});
    expect(brains.business).toEqual({});
  });
});

describe("saveBrain", () => {
  it("grava as secoes preenchidas e emite cerebro.atualizado", async () => {
    const db = fakeDb();
    await saveBrain(db, "brand", { "Voz e tom": "Direta e calorosa." });

    expect(db.upserts[0]).toMatchObject({
      kind: "brand",
      content: { "Voz e tom": "Direta e calorosa." },
    });
    expect(db.eventInserts[0]).toMatchObject({ type: "cerebro.atualizado" });
  });

  it("descarta secoes sem titulo ou sem texto", async () => {
    const db = fakeDb();
    await saveBrain(db, "brand", {
      "Voz e tom": "Direta.",
      "Secao vazia": "   ",
      "   ": "texto sem titulo",
    });

    expect(db.upserts[0].content).toEqual({ "Voz e tom": "Direta." });
  });

  it("remove espacos em volta de titulos e textos", async () => {
    const db = fakeDb();
    await saveBrain(db, "learned", { "  Padroes  ": "  Reels curtos funcionam.  " });

    expect(db.upserts[0].content).toEqual({ Padroes: "Reels curtos funcionam." });
  });
});
