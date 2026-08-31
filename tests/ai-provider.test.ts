import { describe, it, expect, afterEach } from "vitest";
import { getAiProvider, isAiConfigured, resolveProviderName, AiNotConfiguredError } from "@/lib/ai";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("resolveProviderName", () => {
  it("usa anthropic como padrao", () => {
    delete process.env.AI_PROVIDER;
    expect(resolveProviderName()).toBe("anthropic");
  });

  it("cai no padrao quando o provedor pedido nao existe no registro", () => {
    expect(resolveProviderName("provedor-inexistente")).toBe("anthropic");
  });

  it("respeita a preferencia explicita sobre a variavel de ambiente", () => {
    process.env.AI_PROVIDER = "anthropic";
    expect(resolveProviderName("anthropic")).toBe("anthropic");
  });
});

describe("isAiConfigured", () => {
  it("e falso sem chave", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(isAiConfigured()).toBe(false);
  });

  it("e verdadeiro com chave", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-teste";
    expect(isAiConfigured()).toBe(true);
  });
});

describe("getAiProvider", () => {
  it("lanca AiNotConfiguredError sem chave, citando a variavel que falta", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getAiProvider()).toThrow(AiNotConfiguredError);
    expect(() => getAiProvider()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("devolve um provedor com nome e modelo quando configurado", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-teste";
    const provider = getAiProvider();
    expect(provider.name).toBe("anthropic");
    expect(provider.modelFor("best")).toBe("claude-opus-5");
  });

  it("cada nivel resolve para um modelo diferente", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-teste";
    const provider = getAiProvider();
    expect(provider.modelFor("efficient")).not.toBe(provider.modelFor("best"));
  });

  it("sem nivel declarado, usa o melhor modelo", () => {
    // O padrao protege contra esquecimento: uma tarefa nova que nao declare
    // nivel nasce no modelo bom, em vez de ser barateada em silencio.
    process.env.ANTHROPIC_API_KEY = "sk-ant-teste";
    const provider = getAiProvider();
    expect(provider.modelFor()).toBe(provider.modelFor("best"));
  });
});
