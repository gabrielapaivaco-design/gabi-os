import { describe, it, expect } from "vitest";
import { semelhancaDeTitulo, separarRepetidos } from "@/lib/planning/dedupe";

// Os titulos abaixo sao os que de fato apareceram duplicados no Pipeline da
// Eisen Haus. Sao o criterio de calibragem: se a rede nao pega estes, ela nao
// serve para nada.
const REAIS = {
  cabanaA: "Cabana como ativo de renda: o que muda quando o módulo é para alugar",
  cabanaB: "Cabana como ativo de renda: o que muda no projeto quando o módulo é para alugar",
  precoA: "Quanto custa e como se paga um módulo sob medida: respondendo a pergunta da caixinha",
  precoB:
    "Quanto custa e como se paga um módulo sob medida: respondendo a pergunta que mais chegou na caixinha",
  // Este chegou truncado ao banco, com reticencias no fim. Fica como esta: um
  // titulo cortado e exatamente o tipo de coisa que a rede precisa aguentar.
  mapaA: "Fiz um mapa no escritório e coloquei todas as cidades que já…",
  mapaB: "O mapa da parede do escritório: todas as cidades onde já existe um módulo nosso",
};

describe("semelhancaDeTitulo", () => {
  it("reconhece os titulos que duplicaram de verdade", () => {
    expect(semelhancaDeTitulo(REAIS.cabanaA, REAIS.cabanaB)).toBeGreaterThanOrEqual(0.67);
    expect(semelhancaDeTitulo(REAIS.precoA, REAIS.precoB)).toBeGreaterThanOrEqual(0.67);
    expect(semelhancaDeTitulo(REAIS.mapaA, REAIS.mapaB)).toBeGreaterThanOrEqual(0.67);
  });

  it("nao confunde conteudos diferentes sobre o mesmo assunto", () => {
    // Os dois falam de instalacao, mas sao gravacoes distintas: uma mostra o
    // caminhao chegando, a outra explica a parte eletrica.
    const a = "Instalacao acontecendo: do caminhao ao modulo no lugar";
    const b = "Como e a ligacao eletrica e hidraulica depois que o modulo chega";
    expect(semelhancaDeTitulo(a, b)).toBeLessThan(0.67);
  });

  it("ignora acento e caixa", () => {
    expect(semelhancaDeTitulo("Instalação acontecendo no terreno", "INSTALACAO ACONTECENDO NO TERRENO")).toBe(1);
  });

  it("titulo vazio nao casa com nada", () => {
    expect(semelhancaDeTitulo("", REAIS.mapaA)).toBe(0);
    expect(semelhancaDeTitulo("de um a", REAIS.mapaA)).toBe(0);
  });

  it("titulo longo nao dilui a semelhanca", () => {
    // Medir sobre o menor conjunto e o que faz este par ser pego.
    const curto = "O mapa do escritorio";
    const longo = "O mapa da parede do escritorio com todas as cidades onde ja entregamos um modulo ate hoje";
    expect(semelhancaDeTitulo(curto, longo)).toBeGreaterThanOrEqual(0.67);
  });
});

describe("separarRepetidos", () => {
  const titulo = (s: string) => s;

  it("separa o que repete do que e novo", () => {
    const r = separarRepetidos(
      [REAIS.cabanaB, "Sete da manha, chapa no chao: esse vira modulo ate o fim do mes"],
      titulo,
      [REAIS.cabanaA],
    );
    expect(r.novos).toHaveLength(1);
    expect(r.repetidos).toHaveLength(1);
    expect(r.repetidos[0].jaExiste).toBe(REAIS.cabanaA);
  });

  it("pega repeticao DENTRO do proprio plano", () => {
    // Sem comparar os aceitos entre si, o plano poderia propor a mesma ideia
    // duas vezes e as duas passariam, porque nenhuma existia antes.
    const r = separarRepetidos([REAIS.mapaA, REAIS.mapaB], titulo, []);
    expect(r.novos).toEqual([REAIS.mapaA]);
    expect(r.repetidos).toHaveLength(1);
  });

  it("sem nada existente, tudo passa", () => {
    const itens = ["Primeiro conteudo do mes", "Segundo conteudo bem diferente"];
    expect(separarRepetidos(itens, titulo, []).novos).toEqual(itens);
  });

  it("guarda o par mais parecido quando ha varios candidatos", () => {
    const r = separarRepetidos([REAIS.precoB], titulo, ["Assunto completamente outro", REAIS.precoA]);
    expect(r.repetidos[0].jaExiste).toBe(REAIS.precoA);
  });

  it("funciona com objetos, nao so com texto", () => {
    const itens = [{ title: REAIS.cabanaB, day: 4 }];
    const r = separarRepetidos(itens, (i) => i.title, [REAIS.cabanaA]);
    expect(r.novos).toEqual([]);
    expect(r.repetidos[0].item.day).toBe(4);
  });

  it("lista vazia nao quebra", () => {
    expect(separarRepetidos([], titulo, ["algo"])).toEqual({ novos: [], repetidos: [] });
  });
});
