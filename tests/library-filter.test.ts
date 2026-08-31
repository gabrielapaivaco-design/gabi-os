import { describe, it, expect } from "vitest";
import { combina, normalizar, temTexto } from "@/lib/library/filter";
import type { LibraryItem } from "@/lib/library/service";

function item(extra: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "1",
    title: "Modulo pronto em 30 dias",
    format: "Reel",
    status: "publicado",
    archived: false,
    pillarName: "Bastidor",
    hook: "Ninguem acredita ate ver",
    script: "Abre na obra, mostra a estrutura chegando de caminhao.",
    caption: "Menos obra, mais vida.",
    cta: "Chama no direct",
    plannedAt: null,
    publishedAt: null,
    createdAt: "2026-08-01T10:00:00Z",
    ...extra,
  };
}

describe("normalizar", () => {
  it("tira acento e caixa", () => {
    expect(normalizar("Módulo")).toBe("modulo");
    expect(normalizar("AÇÃO")).toBe("acao");
    expect(normalizar("Coração")).toBe("coracao");
  });

  it("nao mexe em texto ja simples", () => {
    expect(normalizar("reel")).toBe("reel");
  });
});

describe("combina", () => {
  it("acha por titulo", () => {
    expect(combina(item(), "modulo")).toBe(true);
  });

  it("acha mesmo com acento no termo ou no conteudo", () => {
    // Ela nao vai lembrar como digitou da primeira vez.
    expect(combina(item({ title: "Módulo pronto" }), "modulo")).toBe(true);
    expect(combina(item({ title: "Modulo pronto" }), "módulo")).toBe(true);
  });

  it("ignora caixa", () => {
    expect(combina(item(), "MODULO")).toBe(true);
  });

  it("acha por roteiro, legenda, hook, cta e pilar", () => {
    expect(combina(item(), "caminhao")).toBe(true);
    expect(combina(item(), "menos obra")).toBe(true);
    expect(combina(item(), "acredita")).toBe(true);
    expect(combina(item(), "direct")).toBe(true);
    expect(combina(item(), "bastidor")).toBe(true);
  });

  it("exige todas as palavras, mas nao no mesmo campo", () => {
    // "reel caminhao": formato num campo, palavra no roteiro.
    expect(combina(item(), "reel caminhao")).toBe(true);
    expect(combina(item(), "reel helicoptero")).toBe(false);
  });

  it("termo vazio ou so espaco devolve tudo", () => {
    expect(combina(item(), "")).toBe(true);
    expect(combina(item(), "   ")).toBe(true);
  });

  it("nao quebra em item com campos vazios", () => {
    const vazio = item({ hook: null, script: null, caption: null, cta: null, pillarName: null, format: null });
    expect(combina(vazio, "modulo")).toBe(true);
    expect(combina(vazio, "caminhao")).toBe(false);
  });
});

describe("temTexto", () => {
  it("e verdadeiro com roteiro, legenda ou cta", () => {
    expect(temTexto(item({ script: "algo", caption: null, cta: null }))).toBe(true);
    expect(temTexto(item({ script: null, caption: "algo", cta: null }))).toBe(true);
    expect(temTexto(item({ script: null, caption: null, cta: "algo" }))).toBe(true);
  });

  it("e falso quando nao ha nada escrito", () => {
    expect(temTexto(item({ script: null, caption: null, cta: null }))).toBe(false);
  });

  it("espaco em branco nao conta como texto", () => {
    expect(temTexto(item({ script: "   ", caption: "\n", cta: "" }))).toBe(false);
  });
});
