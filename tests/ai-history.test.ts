import { describe, it, expect } from "vitest";
import { summarize, KIND_LABEL, type Generation } from "@/lib/ai/history-view";

function ger(over: Partial<Generation>): Generation {
  return {
    id: "g1",
    kind: "roteiro",
    provider: "anthropic",
    model: "claude-opus-5",
    inputTokens: 100,
    outputTokens: 50,
    result: null,
    error: null,
    createdAt: "2026-08-07T10:00:00.000Z",
    contentTitle: null,
    ...over,
  };
}

describe("summarize", () => {
  it("mostra o hook do roteiro", () => {
    expect(summarize(ger({ kind: "roteiro", result: { hook: "Hoje eu comprei" } }))).toBe(
      "Hoje eu comprei",
    );
  });

  it("mostra a legenda", () => {
    expect(summarize(ger({ kind: "legenda", result: { caption: "texto da legenda" } }))).toBe(
      "texto da legenda",
    );
  });

  it("mostra a resposta da conversa", () => {
    expect(summarize(ger({ kind: "conversa", result: { reply: "acho que sim" } }))).toBe(
      "acho que sim",
    );
  });

  it("junta os titulos dos angulos sugeridos", () => {
    const g = ger({ kind: "ideias", result: { ideas: [{ title: "A" }, { title: "B" }] } });
    expect(summarize(g)).toBe("A · B");
  });

  it("conta os itens da analise em vez de despejar o texto", () => {
    const g = ger({
      kind: "analise",
      result: { strengths: ["a", "b"], risks: ["c"], suggestions: [] },
    });
    expect(summarize(g)).toBe("2 pontos fortes, 1 riscos, 0 sugestoes");
  });

  it("o erro tem prioridade sobre o resultado", () => {
    const g = ger({ error: "rate limit", result: { hook: "nao deveria aparecer" } });
    expect(summarize(g)).toBe("rate limit");
  });

  it("nao quebra quando nao ha resultado gravado", () => {
    expect(summarize(ger({ result: null }))).toBe("sem resultado gravado");
  });

  it("nao quebra com formato inesperado dentro do resultado", () => {
    expect(summarize(ger({ kind: "ideias", result: { ideas: "nao e lista" } }))).toBe("");
  });
});

describe("KIND_LABEL", () => {
  it("cobre os cinco tipos que o sistema grava", () => {
    for (const k of ["roteiro", "legenda", "ideias", "analise", "conversa"]) {
      expect(KIND_LABEL[k]).toBeTruthy();
    }
  });
});
