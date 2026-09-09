import { describe, it, expect } from "vitest";
import { formatoLabel, normalizarFormato } from "@/lib/content/format";

describe("normalizarFormato", () => {
  it("junta as variacoes que existem no banco de verdade", () => {
    // Reel e Reels convivem em contents; Carrosel tem um esse so. Se a etiqueta
    // nao juntasse, a mesma coisa apareceria como duas no quadro.
    expect(normalizarFormato("Reel")).toBe("reel");
    expect(normalizarFormato("Reels")).toBe("reel");
    expect(normalizarFormato("Carrossel")).toBe("carrossel");
    expect(normalizarFormato("Carrosel")).toBe("carrossel");
    expect(normalizarFormato("Stories")).toBe("stories");
    expect(normalizarFormato("Foto unica")).toBe("foto");
  });

  it("ignora acento e caixa", () => {
    expect(normalizarFormato("FOTO ÚNICA")).toBe("foto");
    expect(normalizarFormato("carrossel")).toBe("carrossel");
    expect(normalizarFormato("STORY")).toBe("stories");
  });

  it("tolera espaco sobrando", () => {
    expect(normalizarFormato("  Reel  ")).toBe("reel");
    expect(normalizarFormato("foto    unica")).toBe("foto");
  });

  it("le texto composto pela primeira palavra conhecida", () => {
    expect(normalizarFormato("Reel de bastidor")).toBe("reel");
    expect(normalizarFormato("Carrossel 5 slides")).toBe("carrossel");
  });

  it("nao confunde palavra que so comeca igual", () => {
    // "storyboard" nao e Stories. Sem a checagem por palavra inteira, seria.
    expect(normalizarFormato("storyboard")).toBeNull();
    expect(normalizarFormato("videoclipe")).toBeNull();
  });

  it("vazio e desconhecido devolvem null", () => {
    expect(normalizarFormato(null)).toBeNull();
    expect(normalizarFormato(undefined)).toBeNull();
    expect(normalizarFormato("")).toBeNull();
    expect(normalizarFormato("   ")).toBeNull();
    expect(normalizarFormato("podcast")).toBeNull();
  });
});

describe("formatoLabel", () => {
  it("escreve sempre do mesmo jeito, venha como vier", () => {
    expect(formatoLabel("Reels")).toBe("Reel");
    expect(formatoLabel("reel")).toBe("Reel");
    expect(formatoLabel("Carrosel")).toBe("Carrossel");
    expect(formatoLabel("FOTO ÚNICA")).toBe("Foto");
  });

  it("sem formato nao inventa etiqueta", () => {
    expect(formatoLabel(null)).toBeNull();
    expect(formatoLabel("qualquer coisa")).toBeNull();
  });
});
