import { describe, it, expect } from "vitest";
import {
  sugerirVinculos,
  type CandidatoConteudo,
  type CandidatoPost,
} from "@/lib/metrics/matching";

function conteudo(id: string, extra: Partial<CandidatoConteudo> = {}): CandidatoConteudo {
  return {
    id,
    title: "48 horas antes: o que acontece na fabrica antes de uma cabana ir para a estrada",
    hook: null,
    plannedAt: "2026-08-12T19:00:00Z",
    publishedAt: null,
    ...extra,
  };
}

function post(id: string, extra: Partial<CandidatoPost> = {}): CandidatoPost {
  return {
    id,
    caption: "Dois modulos saindo pro mesmo terreno em Vera Cruz",
    publishedAt: "2026-08-12T20:48:07Z",
    contentId: null,
    ...extra,
  };
}

describe("sugerirVinculos", () => {
  it("propoe o par publicado no mesmo dia", () => {
    const s = sugerirVinculos([conteudo("c1")], [post("p1")]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ contentId: "c1", postId: "p1" });
    expect(s[0].motivo).toContain("mesmo dia");
  });

  it("nao propoe nada quando as datas estao longe e o texto nao combina", () => {
    const s = sugerirVinculos(
      [conteudo("c1", { plannedAt: "2026-01-05T10:00:00Z" })],
      [post("p1", { caption: "promocao de inverno" })],
    );
    expect(s).toEqual([]);
  });

  it("um post ja vinculado sai da rodada", () => {
    // Senao ele seria proposto de novo para outro conteudo, desfazendo na
    // pratica um vinculo que ela ja confirmou.
    const s = sugerirVinculos([conteudo("c1")], [post("p1", { contentId: "outro" })]);
    expect(s).toEqual([]);
  });

  it("o mesmo post nao e proposto para dois conteudos", () => {
    const s = sugerirVinculos([conteudo("c1"), conteudo("c2")], [post("p1")]);
    expect(s).toHaveLength(1);
  });

  it("o mesmo conteudo nao recebe dois posts", () => {
    const s = sugerirVinculos(
      [conteudo("c1")],
      [post("p1"), post("p2", { publishedAt: "2026-08-12T22:00:00Z" })],
    );
    expect(s).toHaveLength(1);
  });

  it("com dois pares possiveis, cada um fica com o seu", () => {
    const s = sugerirVinculos(
      [
        conteudo("c1", { title: "cabana na estrada", plannedAt: "2026-08-12T19:00:00Z" }),
        conteudo("c2", { title: "espaco comercial dos sonhos", plannedAt: "2026-08-26T19:00:00Z" }),
      ],
      [
        post("p1", { caption: "cabana saindo para a estrada", publishedAt: "2026-08-12T20:00:00Z" }),
        post("p2", { caption: "seu proprio espaco comercial", publishedAt: "2026-08-26T19:14:00Z" }),
      ],
    );
    expect(s).toHaveLength(2);
    const porConteudo = new Map(s.map((x) => [x.contentId, x.postId]));
    expect(porConteudo.get("c1")).toBe("p1");
    expect(porConteudo.get("c2")).toBe("p2");
  });

  it("resolve o conflito pelo par mais forte, nao pela ordem da lista", () => {
    // c1 esta a um dia do post; c2 esta no mesmo dia. O post tem de ficar com c2
    // mesmo aparecendo c1 primeiro.
    const s = sugerirVinculos(
      [
        conteudo("c1", { plannedAt: "2026-08-11T19:00:00Z" }),
        conteudo("c2", { plannedAt: "2026-08-12T19:00:00Z" }),
      ],
      [post("p1", { publishedAt: "2026-08-12T20:00:00Z" })],
    );
    expect(s).toHaveLength(1);
    expect(s[0].contentId).toBe("c2");
  });

  it("usa publishedAt do conteudo na frente de plannedAt", () => {
    // Planejado num dia e publicado noutro: vale quando saiu de verdade.
    const s = sugerirVinculos(
      [conteudo("c1", { plannedAt: "2026-08-01T19:00:00Z", publishedAt: "2026-08-12T21:00:00Z" })],
      [post("p1")],
    );
    expect(s[0]?.motivo).toContain("mesmo dia");
  });

  it("data ausente nao inventa proximidade", () => {
    const s = sugerirVinculos(
      [conteudo("c1", { plannedAt: null, publishedAt: null, title: "xxxx yyyy zzzz" })],
      [post("p1", { caption: "aaaa bbbb cccc" })],
    );
    expect(s).toEqual([]);
  });

  it("texto sozinho basta quando a semelhanca e forte", () => {
    // Sem data em nenhum dos dois, mas o assunto e praticamente o mesmo.
    const s = sugerirVinculos(
      [conteudo("c1", { plannedAt: null, title: "cabana modulo terreno investimento" })],
      [post("p1", { publishedAt: null, caption: "cabana modulo terreno investimento" })],
    );
    expect(s).toHaveLength(1);
  });

  it("hashtags nao contam como assunto", () => {
    // "#fyp" nao diz do que o post trata; se contasse, todo post com hashtag
    // pareceria combinar com todo conteudo que citasse a mesma palavra.
    const s = sugerirVinculos(
      [conteudo("c1", { plannedAt: null, title: "sextafeira viralpost" })],
      [post("p1", { publishedAt: null, caption: "#sextafeira #viralpost #fyp" })],
    );
    expect(s).toEqual([]);
  });

  it("acento nao atrapalha a comparacao", () => {
    const s = sugerirVinculos(
      [conteudo("c1", { plannedAt: null, title: "módulo prónto construção rápida" })],
      [post("p1", { publishedAt: null, caption: "modulo pronto construcao rapida" })],
    );
    expect(s).toHaveLength(1);
  });

  it("listas vazias devolvem lista vazia", () => {
    expect(sugerirVinculos([], [])).toEqual([]);
    expect(sugerirVinculos([conteudo("c1")], [])).toEqual([]);
    expect(sugerirVinculos([], [post("p1")])).toEqual([]);
  });

  it("legenda vazia nao quebra", () => {
    const s = sugerirVinculos([conteudo("c1")], [post("p1", { caption: null })]);
    expect(s).toHaveLength(1);
    expect(s[0].motivo).toBe("mesmo dia");
  });
});
