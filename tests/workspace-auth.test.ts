import { describe, it, expect } from "vitest";
import {
  slugify,
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
} from "@/lib/workspace/service";
import { translateAuthError } from "@/lib/auth/service";

describe("slugify", () => {
  it("tira acentos e troca espacos por hifens", () => {
    expect(slugify("Mari Calçados")).toBe("mari-calcados");
    expect(slugify("Eisen Haus")).toBe("eisen-haus");
    expect(slugify("Gabriela")).toBe("gabriela");
  });

  it("nao deixa hifen sobrando nas pontas nem repetido", () => {
    expect(slugify("  Loja   da  Ana  ")).toBe("loja-da-ana");
    expect(slugify("!!! Marca !!!")).toBe("marca");
  });

  it("devolve string vazia quando nao sobra nada aproveitavel", () => {
    // O chamador usa isso para recusar o nome em vez de criar um slug invalido.
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

// Fake do cliente: registra a chamada de RPC para provar que a criacao passa
// pela funcao no banco (atomica) e nao por INSERT solto.
function fakeDb(opts: { error?: { message: string }; data?: unknown } = {}) {
  const calls: { fn: string; args: unknown }[] = [];
  return {
    calls,
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return {
        data: opts.error ? null : (opts.data ?? { id: "w1", name: "Eisen Haus", slug: "eisen-haus" }),
        error: opts.error ?? null,
      };
    },
  } as any;
}

describe("createWorkspace", () => {
  it("chama a funcao create_workspace do banco", async () => {
    const db = fakeDb();
    const ws = await createWorkspace(db, { name: "Eisen Haus", slug: "eisen-haus" });

    expect(db.calls[0].fn).toBe("create_workspace");
    expect(db.calls[0].args).toEqual({ p_name: "Eisen Haus", p_slug: "eisen-haus" });
    expect(ws.id).toBe("w1");
  });

  it("recusa slug invalido antes de chegar ao banco", async () => {
    const db = fakeDb();
    await expect(createWorkspace(db, { name: "X", slug: "Nao Vale" })).rejects.toThrow(
      /identificador/i,
    );
    expect(db.calls).toHaveLength(0);
  });

  it("recusa nome vazio antes de chegar ao banco", async () => {
    const db = fakeDb();
    await expect(createWorkspace(db, { name: "   ", slug: "x" })).rejects.toThrow(/obrigatorio/i);
    expect(db.calls).toHaveLength(0);
  });

  it("propaga o erro do banco (ex.: slug duplicado)", async () => {
    const db = fakeDb({ error: { message: 'Ja existe um workspace com o identificador "x".' } });
    await expect(createWorkspace(db, { name: "X", slug: "x" })).rejects.toThrow(/Ja existe/);
  });
});

describe("renameWorkspace", () => {
  it("gera o identificador novo a partir do nome", async () => {
    const db = fakeDb({ data: { id: "w1", name: "Mari Calçados", slug: "mari-calcados" } });
    await renameWorkspace(db, { id: "w1", name: "Mari Calçados" });

    expect(db.calls[0].fn).toBe("rename_workspace");
    expect(db.calls[0].args).toEqual({
      p_id: "w1",
      p_name: "Mari Calçados",
      p_slug: "mari-calcados",
    });
  });

  it("recusa nome vazio antes de chegar ao banco", async () => {
    const db = fakeDb();
    await expect(renameWorkspace(db, { id: "w1", name: "   " })).rejects.toThrow(/obrigatorio/i);
    expect(db.calls).toHaveLength(0);
  });

  it("recusa nome que nao gera identificador valido", async () => {
    const db = fakeDb();
    await expect(renameWorkspace(db, { id: "w1", name: "!!!" })).rejects.toThrow(/identificador/i);
    expect(db.calls).toHaveLength(0);
  });

  it("propaga colisao de identificador vinda do banco", async () => {
    const db = fakeDb({ error: { message: 'Ja existe outro workspace com o identificador "x".' } });
    await expect(renameWorkspace(db, { id: "w1", name: "X" })).rejects.toThrow(/Ja existe outro/);
  });
});

describe("deleteWorkspace", () => {
  it("chama a funcao delete_workspace do banco", async () => {
    const db = fakeDb({ data: null });
    await deleteWorkspace(db, "w1");
    expect(db.calls[0]).toEqual({ fn: "delete_workspace", args: { p_id: "w1" } });
  });

  it("propaga a recusa de apagar o ultimo workspace", async () => {
    const db = fakeDb({ error: { message: "Esse e o seu unico workspace." } });
    await expect(deleteWorkspace(db, "w1")).rejects.toThrow(/unico workspace/);
  });
});

describe("translateAuthError", () => {
  it("traduz credenciais invalidas", () => {
    expect(translateAuthError("Invalid login credentials")).toMatch(/incorretos/i);
  });

  it("explica o que fazer quando falta confirmar o e-mail", () => {
    const msg = translateAuthError("Email not confirmed");
    expect(msg).toMatch(/confirma/i);
    expect(msg).toMatch(/Supabase/);
  });

  it("manda usar Entrar quando a conta ja existe", () => {
    expect(translateAuthError("User already registered")).toMatch(/Entrar/);
  });

  it("devolve a mensagem original quando nao conhece o caso", () => {
    expect(translateAuthError("algo muito especifico")).toBe("algo muito especifico");
  });
});
