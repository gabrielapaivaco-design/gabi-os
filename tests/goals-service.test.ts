import { describe, it, expect } from "vitest";
import { createGoal, deleteGoal, updateGoal, updateGoalProgress } from "@/lib/goals/service";

function fakeDb(opts: { updateError?: { message: string }; deleteError?: { message: string } } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  let nextId = 1;

  return {
    inserts,
    updates,
    deletes,
    from(table: string) {
      if (table !== "goals") throw new Error(`tabela inesperada: ${table}`);
      return {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return {
            select: () => ({
              single: async () => ({
                data: { id: `g${nextId++}`, progress: 0, metric_key: null, ...row },
                error: null,
              }),
            }),
          };
        },
        update: (row: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updates.push({ id, ...row });
            return { error: opts.updateError ?? null };
          },
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => {
            deletes.push(id);
            return { error: opts.deleteError ?? null };
          },
        }),
      };
    },
  } as any;
}

describe("createGoal", () => {
  it("cria a meta com os campos informados", async () => {
    const db = fakeDb();
    const goal = await createGoal(db, { title: "Publicar 20 vezes", target: 20, quarter: "2026-Q3" });
    expect(db.inserts[0]).toMatchObject({ title: "Publicar 20 vezes", target: 20, quarter: "2026-Q3" });
    expect(goal.progress).toBe(0);
  });
});

describe("updateGoalProgress", () => {
  it("atualiza o progresso", async () => {
    const db = fakeDb();
    await updateGoalProgress(db, "g1", 5);
    expect(db.updates[0]).toMatchObject({ id: "g1", progress: 5 });
  });

  it("nunca deixa o progresso negativo", async () => {
    const db = fakeDb();
    await updateGoalProgress(db, "g1", -3);
    expect(db.updates[0]).toMatchObject({ id: "g1", progress: 0 });
  });
});

describe("updateGoal", () => {
  it("rejeita titulo vazio sem tocar no banco", async () => {
    const db = fakeDb();
    await expect(updateGoal(db, "g1", { title: "   " })).rejects.toThrow(
      "O titulo da meta nao pode ficar vazio.",
    );
    expect(db.updates).toHaveLength(0);
  });

  it("propaga erro do Supabase", async () => {
    const db = fakeDb({ updateError: { message: "falha" } });
    await expect(updateGoal(db, "g1", { title: "Nova" })).rejects.toThrow("falha");
  });
});

describe("deleteGoal", () => {
  it("exclui pelo id", async () => {
    const db = fakeDb();
    await deleteGoal(db, "g1");
    expect(db.deletes).toEqual(["g1"]);
  });

  it("propaga erro do Supabase", async () => {
    const db = fakeDb({ deleteError: { message: "sem permissao" } });
    await expect(deleteGoal(db, "g1")).rejects.toThrow("sem permissao");
  });
});
