import { describe, it, expect } from "vitest";
import {
  archiveContent,
  createContent,
  reorderColumn,
  truncateTitle,
  updateContent,
} from "@/lib/contents/service";

// Fake minimo do cliente Supabase, no mesmo espirito de tests/moments-service.test.ts.
// select(...).eq(...) para a contagem da coluna Ideia e "thenable" (como o
// PostgrestFilterBuilder real), entao `await` funciona sem precisar de `.then()` explicito.
// update(...).eq(...) tambem e thenable (usado por reorderColumn/archiveContent) e
// alem disso expoe .select().single() (usado por updateContent).
function fakeDb(opts: { existingIdeiaCount?: number; updateError?: { message: string } } = {}) {
  const contentInserts: Record<string, unknown>[] = [];
  const contentUpdates: Record<string, unknown>[] = [];
  const eventInserts: unknown[] = [];
  let nextId = 1;

  return {
    contentInserts,
    contentUpdates,
    eventInserts,
    from(table: string) {
      if (table === "contents") {
        return {
          select() {
            const builder: any = {
              eq: () => builder,
              then: (resolve: (v: { count: number; error: null }) => void) =>
                resolve({ count: opts.existingIdeiaCount ?? 0, error: null }),
            };
            return builder;
          },
          insert: (row: Record<string, unknown>) => {
            contentInserts.push(row);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: `c${nextId++}`,
                    status: "ideia",
                    created_at: "2026-08-05T10:00:00.000Z",
                    updated_at: "2026-08-05T10:00:00.000Z",
                    ...row,
                  },
                  error: null,
                }),
              }),
            };
          },
          update: (row: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              contentUpdates.push({ id, ...row });
              const result = { error: opts.updateError ?? null };
              return {
                then: (resolve: (v: typeof result) => void) => resolve(result),
                select: () => ({
                  single: async () =>
                    opts.updateError
                      ? { data: null, error: opts.updateError }
                      : {
                          data: {
                            id,
                            status: "ideia",
                            created_at: "2026-08-05T10:00:00.000Z",
                            ...row,
                          },
                          error: null,
                        },
                }),
              };
            },
          }),
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

describe("truncateTitle", () => {
  it("mantem textos curtos intactos", () => {
    expect(truncateTitle("Gravei um video hoje")).toBe("Gravei um video hoje");
  });

  it("trunca textos longos com reticencias", () => {
    const long = "a".repeat(80);
    const result = truncateTitle(long, 60);
    expect(result).toHaveLength(61);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("createContent", () => {
  it("cria o card em Ideia, no fim da coluna, e emite conteudo.criado", async () => {
    const db = fakeDb({ existingIdeiaCount: 3 });
    const content = await createContent(db, { title: "Ideia nova" });

    expect(db.contentInserts[0]).toMatchObject({ title: "Ideia nova", moment_id: null, sort: 3 });
    expect(db.eventInserts[0]).toMatchObject({ type: "conteudo.criado" });
    expect(content.title).toBe("Ideia nova");
  });

  it("liga o card a um momento quando informado", async () => {
    const db = fakeDb();
    await createContent(db, { title: "Do momento", momentId: "m1" });
    expect(db.contentInserts[0]).toMatchObject({ moment_id: "m1", sort: 0 });
  });
});

describe("reorderColumn", () => {
  it("persiste status e sort (indice) de cada card na nova ordem", async () => {
    const db = fakeDb();
    await reorderColumn(db, { status: "roteiro", orderedIds: ["c1", "c2", "c3"] });

    expect(db.contentUpdates).toHaveLength(3);
    expect(db.contentUpdates).toContainEqual({ id: "c1", status: "roteiro", sort: 0 });
    expect(db.contentUpdates).toContainEqual({ id: "c2", status: "roteiro", sort: 1 });
    expect(db.contentUpdates).toContainEqual({ id: "c3", status: "roteiro", sort: 2 });
  });

  it("emite conteudo.movido quando o status de origem muda", async () => {
    const db = fakeDb();
    await reorderColumn(db, {
      status: "gravar",
      orderedIds: ["c1"],
      movedContentId: "c1",
      movedFromStatus: "roteiro",
    });
    expect(db.eventInserts[0]).toMatchObject({ type: "conteudo.movido" });
  });

  it("nao emite evento quando e so reordenacao dentro da mesma coluna", async () => {
    const db = fakeDb();
    await reorderColumn(db, {
      status: "gravar",
      orderedIds: ["c1", "c2"],
      movedContentId: "c1",
      movedFromStatus: "gravar",
    });
    expect(db.eventInserts).toHaveLength(0);
  });
});

describe("updateContent", () => {
  it("atualiza os campos informados e emite conteudo.editado", async () => {
    const db = fakeDb();
    const content = await updateContent(db, "c1", { title: "Novo titulo", format: "Reels" });

    expect(db.contentUpdates[0]).toMatchObject({ id: "c1", title: "Novo titulo", format: "Reels" });
    expect(db.eventInserts[0]).toMatchObject({
      type: "conteudo.editado",
      payload: { id: "c1", fields: ["title", "format"] },
    });
    expect(content.title).toBe("Novo titulo");
  });

  it("rejeita titulo vazio sem tocar no banco", async () => {
    const db = fakeDb();
    await expect(updateContent(db, "c1", { title: "   " })).rejects.toThrow(
      "O titulo nao pode ficar vazio.",
    );
    expect(db.contentUpdates).toHaveLength(0);
  });

  it("propaga erro do Supabase", async () => {
    const db = fakeDb({ updateError: { message: "linha nao encontrada" } });
    await expect(updateContent(db, "c1", { format: "Stories" })).rejects.toThrow(
      "linha nao encontrada",
    );
  });
});

describe("archiveContent", () => {
  it("marca archived=true e emite conteudo.arquivado", async () => {
    const db = fakeDb();
    await archiveContent(db, "c1");

    expect(db.contentUpdates[0]).toMatchObject({ id: "c1", archived: true });
    expect(db.eventInserts[0]).toMatchObject({ type: "conteudo.arquivado", payload: { id: "c1" } });
  });

  it("propaga erro do Supabase sem emitir evento", async () => {
    const db = fakeDb({ updateError: { message: "sem permissao" } });
    await expect(archiveContent(db, "c1")).rejects.toThrow("sem permissao");
    expect(db.eventInserts).toHaveLength(0);
  });
});
