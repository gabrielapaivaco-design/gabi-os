import { describe, it, expect } from "vitest";
import {
  estatistica,
  formatoLabel,
  lerPosts,
  mediana,
  taxaEngajamento,
} from "@/lib/metrics/analysis";
import type { StoredExternalPost, StoredMetric } from "@/lib/metrics/service";

function metrica(m: Partial<StoredMetric>): StoredMetric {
  return {
    reach: null,
    impressions: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    collectedAt: "2026-08-19T14:00:00Z",
    ...m,
  };
}

function post(id: string, m: Partial<StoredMetric> | null, extra: Partial<StoredExternalPost> = {}): StoredExternalPost {
  return {
    id,
    platform: "instagram",
    externalId: id,
    url: null,
    caption: null,
    mediaType: "FEED",
    publishedAt: "2026-05-04T22:00:00Z",
    contentId: null,
    source: "windsor-manual",
    metrics: m ? metrica(m) : null,
    ...extra,
  };
}

describe("mediana", () => {
  it("com quantidade impar, e o valor do meio", () => {
    expect(mediana([1, 100, 3])).toBe(3);
  });

  it("com quantidade par, e a media dos dois do meio", () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });

  it("nao depende da ordem de entrada", () => {
    expect(mediana([40, 10, 30, 20])).toBe(25);
  });

  it("lista vazia devolve zero em vez de NaN", () => {
    expect(mediana([])).toBe(0);
  });
});

describe("estatistica", () => {
  it("resiste a outliers na mediana, mas nao na media", () => {
    // Este e o caso real da conta: 18 posts perto de 700 e dois estouros.
    // A media diz 1.400; a mediana diz 700. So a segunda descreve o tipico.
    const valores = [...Array(18).fill(700), 7672, 4460];
    const e = estatistica(valores)!;
    expect(e.mediana).toBe(700);
    expect(e.media).toBeGreaterThan(1200);
    expect(e.melhor).toBe(7672);
    expect(e.pior).toBe(700);
    expect(e.amostra).toBe(20);
  });

  it("sem amostra devolve null, nao zeros", () => {
    // Zeros seriam lidos como "a conta teve alcance zero", que e falso.
    expect(estatistica([])).toBeNull();
  });
});

describe("taxaEngajamento", () => {
  it("soma as interacoes sobre o alcance", () => {
    expect(taxaEngajamento(metrica({ reach: 100, likes: 8, comments: 1, shares: 1 }))).toBeCloseTo(0.1);
  });

  it("ignora as interacoes que nao foram coletadas", () => {
    // Salvamento ausente nao pode ser tratado como zero salvamentos: a taxa
    // cairia por causa do provedor, nao do post.
    expect(taxaEngajamento(metrica({ reach: 100, likes: 10, saves: null }))).toBeCloseTo(0.1);
  });

  it("e null quando nao ha alcance", () => {
    expect(taxaEngajamento(metrica({ reach: null, likes: 10 }))).toBeNull();
    expect(taxaEngajamento(metrica({ reach: 0, likes: 10 }))).toBeNull();
  });

  it("e null quando nenhuma interacao e conhecida", () => {
    expect(taxaEngajamento(metrica({ reach: 500 }))).toBeNull();
  });

  it("e null sem metrica nenhuma", () => {
    expect(taxaEngajamento(null)).toBeNull();
  });
});

describe("formatoLabel", () => {
  it("traduz o que a API devolve para o nome que ela usa", () => {
    expect(formatoLabel("REELS")).toBe("Reel");
    expect(formatoLabel("CAROUSEL_ALBUM")).toBe("Carrossel");
    expect(formatoLabel("FEED")).toBe("Foto unica");
  });

  it("nao depende de caixa", () => {
    expect(formatoLabel("reels")).toBe("Reel");
  });

  it("passa adiante um formato que nao conhece, em vez de esconder", () => {
    expect(formatoLabel("AO_VIVO")).toBe("AO_VIVO");
    expect(formatoLabel(null)).toBe("Sem formato");
  });
});

describe("lerPosts", () => {
  it("conta posts, metricas e conciliados separadamente", () => {
    const l = lerPosts([
      post("a", { reach: 700 }),
      post("b", null),
      post("c", { reach: 900 }, { contentId: "conteudo-1" }),
    ]);
    expect(l.posts).toBe(3);
    expect(l.comMetrica).toBe(2);
    expect(l.conciliados).toBe(1);
  });

  it("mede cada post contra a mediana", () => {
    const l = lerPosts([post("a", { reach: 500 }), post("b", { reach: 1500 }), post("c", { reach: 1000 })]);
    const porId = new Map(l.todos.map((p) => [p.id, p]));
    expect(porId.get("c")!.vezesAMediana).toBe(1);
    expect(porId.get("b")!.vezesAMediana).toBe(1.5);
    expect(porId.get("a")!.vezesAMediana).toBe(0.5);
  });

  it("post sem alcance nao recebe comparacao inventada", () => {
    const l = lerPosts([post("a", { reach: 700 }), post("sem", null)]);
    expect(l.todos.find((p) => p.id === "sem")!.vezesAMediana).toBeNull();
  });

  it("posts sem metrica ficam fora do ranking, nao no fim dele", () => {
    // Sem isso, um post que nunca teve numero coletado apareceria como o pior
    // da conta — uma acusacao que o dado nao sustenta.
    const posts = [post("sem", null), ...Array.from({ length: 6 }, (_, i) => post(`p${i}`, { reach: (i + 1) * 100 }))];
    const l = lerPosts(posts);
    expect(l.piores.map((p) => p.id)).not.toContain("sem");
    expect(l.melhores.map((p) => p.id)).not.toContain("sem");
    // mas continua listado
    expect(l.todos.map((p) => p.id)).toContain("sem");
  });

  it("nao recorta melhores e piores quando a amostra e pequena demais", () => {
    // Com 5 posts, "os 3 melhores" e "os 3 piores" se sobrepoem: o recorte
    // afirmaria que o mesmo post e os dois.
    const l = lerPosts(Array.from({ length: 5 }, (_, i) => post(`p${i}`, { reach: (i + 1) * 100 })));
    expect(l.melhores).toEqual([]);
    expect(l.piores).toEqual([]);
  });

  it("ordena os melhores por alcance, do maior para o menor", () => {
    const l = lerPosts(Array.from({ length: 6 }, (_, i) => post(`p${i}`, { reach: (i + 1) * 100 })));
    expect(l.melhores.map((p) => p.metrics!.reach)).toEqual([600, 500, 400]);
    expect(l.piores.map((p) => p.metrics!.reach)).toEqual([100, 200, 300]);
  });

  it("agrupa por formato e ordena pelo que alcanca mais", () => {
    const l = lerPosts([
      post("r1", { reach: 3000 }, { mediaType: "REELS" }),
      post("r2", { reach: 1000 }, { mediaType: "REELS" }),
      post("f1", { reach: 700 }, { mediaType: "FEED" }),
      post("f2", { reach: 500 }, { mediaType: "FEED" }),
    ]);
    expect(l.porFormato.map((f) => f.formato)).toEqual(["Reel", "Foto unica"]);
    expect(l.porFormato[0].medianaAlcance).toBe(2000);
    expect(l.porFormato[1].medianaAlcance).toBe(600);
    expect(l.porFormato[0].posts).toBe(2);
  });

  it("formato sem nenhuma metrica aparece com null, e vai para o fim", () => {
    const l = lerPosts([
      post("f", { reach: 700 }, { mediaType: "FEED" }),
      post("r", null, { mediaType: "REELS" }),
    ]);
    const reel = l.porFormato.find((f) => f.formato === "Reel")!;
    expect(reel.medianaAlcance).toBeNull();
    expect(reel.posts).toBe(1);
    expect(l.porFormato[l.porFormato.length - 1].formato).toBe("Reel");
  });

  it("lista vazia nao quebra e nao inventa numero", () => {
    const l = lerPosts([]);
    expect(l.posts).toBe(0);
    expect(l.alcance).toBeNull();
    expect(l.engajamento).toBeNull();
    expect(l.periodo).toBeNull();
    expect(l.porFormato).toEqual([]);
  });

  it("o periodo vai da publicacao mais antiga a mais recente", () => {
    const l = lerPosts([
      post("b", { reach: 1 }, { publishedAt: "2026-07-20T10:00:00Z" }),
      post("a", { reach: 1 }, { publishedAt: "2026-05-04T22:00:00Z" }),
      post("c", { reach: 1 }, { publishedAt: "2026-06-10T10:00:00Z" }),
    ]);
    expect(l.periodo).toEqual({ de: "2026-05-04T22:00:00Z", ate: "2026-07-20T10:00:00Z" });
  });

  it("posts sem data nao estragam o periodo", () => {
    const l = lerPosts([
      post("a", { reach: 1 }, { publishedAt: null }),
      post("b", { reach: 1 }, { publishedAt: "2026-06-10T10:00:00Z" }),
    ]);
    expect(l.periodo).toEqual({ de: "2026-06-10T10:00:00Z", ate: "2026-06-10T10:00:00Z" });
  });
});
