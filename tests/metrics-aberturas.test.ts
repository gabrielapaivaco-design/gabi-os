import { describe, it, expect } from "vitest";
import {
  classificarAbertura,
  desempenhoPorAbertura,
  primeiraLinha,
} from "@/lib/metrics/aberturas";

// Todas as legendas abaixo sao posts reais da Eisen Haus, com o alcance que
// tiveram. Sao o criterio: o classificador existe para explicar ESTES numeros.
const REAIS = [
  { caption: "“É quente no verão?” ☀️\n\nNão é a estrutura metálica que define o conforto.", reach: 1011, esperado: "pergunta" },
  { caption: "Você já pensou em ter seu próprio espaço comercial?\nAqui na Eisen Haus nós realizamos seus sonhos 💚✨", reach: 769, esperado: "pergunta" },
  { caption: "16 cidades do Rio Grande do Sul. 16 módulos. Nenhum igual ao outro.", reach: 762, esperado: "numero" },
  { caption: "O mesmo módulo pode virar coisas completamente diferentes. 🏡☕✨", reach: 162, esperado: "descricao" },
  { caption: "Casas, Airbnb, Escritorios, Projetos personalizados.", reach: 103, esperado: "lista" },
  { caption: "Moradia. Investimento. Comercio. Modulos que se adaptam ao seu estilo de vida.", reach: 125, esperado: "descricao" },
  { caption: "Segunda-feira Eisen Haus a todo vapor 🚀", reach: 426, esperado: "descricao" },
] as const;

describe("classificarAbertura", () => {
  it.each(REAIS.map((r) => [r.esperado, r.reach, r.caption]))(
    "reconhece %s (post de %i de alcance)",
    (esperado, _reach, caption) => {
      expect(classificarAbertura(caption)).toBe(esperado);
    },
  );

  it("pergunta ganha de tudo, mesmo com numero ou marca na frase", () => {
    expect(classificarAbertura("3 motivos pra você investir num módulo?")).toBe("pergunta");
    expect(classificarAbertura("Eisen Haus faz o quê, afinal?")).toBe("pergunta");
  });

  it("reconhece saudacao e abertura pelo nome da marca", () => {
    expect(classificarAbertura("Bom dia! Hoje a fábrica amanheceu cheia.")).toBe("marca");
    expect(classificarAbertura("Você sabia que dá pra morar num módulo")).toBe("marca");
    expect(classificarAbertura("Vem comigo ver a entrega de hoje")).toBe("marca");
    expect(classificarAbertura("Eisen Haus entregou mais um módulo", "Eisen Haus")).toBe("marca");
  });

  it("reconhece contradicao", () => {
    expect(classificarAbertura("O dia da instalação não é o começo da obra, é o fim.")).toBe("contradicao");
    expect(classificarAbertura("Não é a estrutura metálica, mas o sistema inteiro.")).toBe("contradicao");
  });

  it("nao confunde frase longa com lista de servicos", () => {
    // Tres virgulas numa frase corrida nao e lista: os itens sao longos.
    const frase = "Ele chegou de caminhão, foi posicionado no terreno, e ligado no mesmo dia";
    expect(classificarAbertura(frase)).not.toBe("lista");
  });

  it("legenda vazia nao quebra", () => {
    expect(classificarAbertura(null)).toBe("descricao");
    expect(classificarAbertura("")).toBe("descricao");
    expect(classificarAbertura("   \n  ")).toBe("descricao");
  });
});

describe("primeiraLinha", () => {
  it("pula linha que e so hashtag ou so emoji", () => {
    expect(primeiraLinha("#fyp #viral\n\n🔥\n\nA solda que ninguém vê")).toBe("A solda que ninguém vê");
  });

  it("devolve vazio quando so ha hashtag", () => {
    expect(primeiraLinha("#sextafeira #viralpost #fyp")).toBe("");
  });
});

describe("desempenhoPorAbertura", () => {
  it("ordena do tipo que mais alcanca para o que menos", () => {
    const r = desempenhoPorAbertura(REAIS.map((x) => ({ caption: x.caption, reach: x.reach })));
    expect(r[0].abertura).toBe("pergunta");
    expect(r[r.length - 1].abertura).toBe("lista");
  });

  it("junta os posts do mesmo tipo e tira a mediana", () => {
    const r = desempenhoPorAbertura([
      { caption: "É caro?", reach: 1000 },
      { caption: "Vale a pena?", reach: 500 },
      { caption: "Um módulo pronto no terreno", reach: 200 },
    ]);
    const pergunta = r.find((x) => x.abertura === "pergunta")!;
    expect(pergunta.posts).toBe(2);
    expect(pergunta.medianaAlcance).toBe(750);
  });

  it("post sem alcance conta no exemplo mas nao na mediana", () => {
    const r = desempenhoPorAbertura([
      { caption: "É caro?", reach: null },
      { caption: "Vale a pena?", reach: 400 },
    ]);
    const p = r.find((x) => x.abertura === "pergunta")!;
    expect(p.posts).toBe(1);
    expect(p.medianaAlcance).toBe(400);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(desempenhoPorAbertura([])).toEqual([]);
  });
});
