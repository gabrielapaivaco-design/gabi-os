import { describe, it, expect } from "vitest";
import { deleteMoment, insertMoment } from "@/lib/moments/service";

// Fake minimo do cliente Supabase: cobre moments (insert().select().single())
// e events (insert), no mesmo espirito do fake em tests/bus.test.ts.
function fakeDb(opts: { insertError?: { message: string } } = {}) {
  const inserted: unknown[] = [];
  const eventInserts: unknown[] = [];
  return {
    inserted,
    eventInserts,
    from(table: string) {
      if (table === "moments") {
        return {
          insert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return {
              select: () => ({
                single: async () =>
                  opts.insertError
                    ? { data: null, error: opts.insertError }
                    : {
                        data: {
                          id: "m1",
                          ...row,
                          processed: false,
                          created_at: "2026-08-05T10:00:00.000Z",
                        },
                        error: null,
                      },
              }),
            };
          },
        };
      }
      if (table === "events") {
        return {
          insert: async (row: unknown) => {
            eventInserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  } as any;
}

describe("insertMoment", () => {
  it("grava o momento e emite momento.criado", async () => {
    const db = fakeDb();
    const moment = await insertMoment(db, "Gravei um video hoje");

    expect(db.inserted[0]).toMatchObject({ body: "Gravei um video hoje" });
    expect(db.eventInserts[0]).toMatchObject({ type: "momento.criado" });
    expect(moment.id).toBe("m1");
  });

  it("propaga erro do Supabase sem emitir evento", async () => {
    const db = fakeDb({ insertError: { message: "conexao recusada" } });

    await expect(insertMoment(db, "x")).rejects.toThrow("conexao recusada");
    expect(db.eventInserts).toHaveLength(0);
  });
});

// Fake do delete: registra os .eq() aplicados para provar o escopo por
// workspace, e devolve as linhas afetadas como o Supabase faz com .select().
function fakeDeleteDb(
  opts: { rows?: { id: string; body: string }[]; deleteError?: { message: string } } = {},
) {
  const filters: Record<string, unknown> = {};
  const eventInserts: Record<string, unknown>[] = [];
  return {
    filters,
    eventInserts,
    from(table: string) {
      if (table === "moments") {
        const chain = {
          delete: () => chain,
          eq: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          },
          select: async () =>
            opts.deleteError
              ? { data: null, error: opts.deleteError }
              : { data: opts.rows ?? [], error: null },
        };
        return chain;
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

describe("deleteMoment", () => {
  it("exclui, devolve true e emite momento.excluido com o corpo", async () => {
    const db = fakeDeleteDb({ rows: [{ id: "m1", body: "comprei maquiagem" }] });

    await expect(deleteMoment(db, "m1")).resolves.toBe(true);
    expect(db.eventInserts[0]).toMatchObject({ type: "momento.excluido" });
    // O texto vai no evento porque a linha deixou de existir.
    expect(db.eventInserts[0].payload).toMatchObject({
      id: "m1",
      body: "comprei maquiagem",
    });
  });

  it("filtra por id e por workspace_id", async () => {
    const db = fakeDeleteDb({ rows: [{ id: "m1", body: "x" }] });
    await deleteMoment(db, "m1");

    expect(db.filters.id).toBe("m1");
    expect(db.filters.workspace_id).toBeTruthy();
  });

  it("devolve false e nao emite evento quando nada foi removido", async () => {
    const db = fakeDeleteDb({ rows: [] });

    await expect(deleteMoment(db, "inexistente")).resolves.toBe(false);
    expect(db.eventInserts).toHaveLength(0);
  });

  it("propaga erro do Supabase sem emitir evento", async () => {
    const db = fakeDeleteDb({ deleteError: { message: "permissao negada" } });

    await expect(deleteMoment(db, "m1")).rejects.toThrow("permissao negada");
    expect(db.eventInserts).toHaveLength(0);
  });
});
