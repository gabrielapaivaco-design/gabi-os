import { describe, it, expect } from "vitest";
import { renderContextForPrompt, type ContentContext } from "@/lib/ai/director/context";

function context(overrides: Partial<ContentContext> = {}): ContentContext {
  return {
    workspaceId: "w1",
    workspaceName: "Gabriela",
    content: {
      id: "c1",
      title: "Resenha da base nova",
      format: null,
      status: "ideia",
      objective: null,
      hook: null,
      script: null,
      caption: null,
      cta: null,
    },
    pillar: null,
    originMoment: null,
    brains: { brand: {}, business: {}, learned: {} },
    publishedExamples: [],
    contentDna: [],
    ...overrides,
  };
}

describe("renderContextForPrompt", () => {
  it("sempre inclui o workspace e o conteudo em questao", () => {
    const text = renderContextForPrompt(context());
    expect(text).toContain("## Workspace");
    expect(text).toContain("Gabriela");
    expect(text).toContain("Resenha da base nova");
  });

  it("omite cerebros vazios em vez de mandar secoes em branco", () => {
    const text = renderContextForPrompt(context());
    expect(text).not.toContain("Brand Brain");
    expect(text).not.toContain("Business Brain");
    expect(text).not.toContain("Learned Brain");
  });

  it("inclui apenas os cerebros preenchidos", () => {
    const text = renderContextForPrompt(
      context({
        brains: {
          brand: { "Voz e tom": "Direta e calorosa." },
          business: {},
          learned: {},
        },
      }),
    );
    expect(text).toContain("Brand Brain");
    expect(text).toContain("Voz e tom");
    expect(text).toContain("Direta e calorosa.");
    expect(text).not.toContain("Business Brain");
  });

  it("ignora secoes cujo texto esta vazio", () => {
    const text = renderContextForPrompt(
      context({ brains: { brand: { Valores: "   " }, business: {}, learned: {} } }),
    );
    expect(text).not.toContain("Brand Brain");
  });

  it("inclui o Momento de origem quando existe", () => {
    const text = renderContextForPrompt(context({ originMoment: "Comprei uma base nova hoje" }));
    expect(text).toContain("Momento que originou");
    expect(text).toContain("Comprei uma base nova hoje");
  });

  it("omite campos nulos do conteudo", () => {
    const text = renderContextForPrompt(context());
    expect(text).not.toContain("Hook atual");
    expect(text).not.toContain("Formato:");
  });

  it("inclui os campos do conteudo que ja estao preenchidos", () => {
    const text = renderContextForPrompt(
      context({
        content: { ...context().content, format: "Reels", hook: "Voce ja testou essa base?" },
        pillar: { name: "Looks" },
      }),
    );
    expect(text).toContain("Formato: Reels");
    expect(text).toContain("Pilar: Looks");
    expect(text).toContain("Hook atual: Voce ja testou essa base?");
  });

  it("lista conteudos publicados como referencia de voz", () => {
    const text = renderContextForPrompt(
      context({
        publishedExamples: [{ title: "Rotina da manha", format: "Reels", hook: "Acordei as 5h" }],
      }),
    );
    expect(text).toContain("ja publicados");
    expect(text).toContain("Rotina da manha");
    expect(text).toContain("Acordei as 5h");
  });
});
