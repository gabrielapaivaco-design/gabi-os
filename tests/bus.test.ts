import { describe, it, expect, vi, beforeEach } from "vitest";
import { emit, on } from "@/lib/events/bus";

// Fake minimo do cliente Supabase: registra o insert em events.
function fakeDb() {
  const inserts: unknown[] = [];
  return {
    inserts,
    from: () => ({ insert: async (row: unknown) => { inserts.push(row); return { error: null }; } }),
  } as any;
}

describe("barramento de eventos", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("persiste o evento emitido", async () => {
    const db = fakeDb();
    await emit(db, { type: "momento.criado", workspaceId: "w1", payload: { id: "m1" } });
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({ type: "momento.criado", workspace_id: "w1" });
  });

  it("dispara handlers assinados", async () => {
    const db = fakeDb();
    const spy = vi.fn();
    on("conteudo.criado", spy);
    await emit(db, { type: "conteudo.criado", workspaceId: "w1" });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("falha de handler nao derruba a emissao", async () => {
    const db = fakeDb();
    on("conteudo.movido", () => { throw new Error("boom"); });
    await expect(
      emit(db, { type: "conteudo.movido", workspaceId: "w1" }),
    ).resolves.toBeUndefined();
    expect(db.inserts).toHaveLength(1);
  });
});
