import { describe, it, expect } from "vitest";
import { fromWindsorRows, manualWindsorSource } from "@/lib/metrics/sources/windsor";
import { platformLabel, numeroOuNulo, emptyMetrics } from "@/lib/metrics/types";

// Este mapeador e a costura que sera trocada quando existir integracao por API.
// Se ele mudar de forma sem querer, a conciliacao e o aprendizado quebram em
// silencio — por isso os testes travam o formato de saida, nao so o caminho felizo.

const LINHA_REEL = {
  date: "2026-08-12",
  media_id: "18071452529442564",
  media_type: "REELS",
  media_product_type: "REELS",
  media_reach: 703,
  media_saved: 0,
  media_shares: 2,
  media_like_count: 40,
  media_comments_count: 4,
  media_caption: "Dois modulos saindo pro mesmo terreno",
  media_permalink: "https://instagram.com/reel/abc",
  timestamp: "2026-08-12T14:30:00+0000",
};

describe("fromWindsorRows", () => {
  it("traduz uma linha do conector para a forma do sistema", () => {
    const [p] = fromWindsorRows([LINHA_REEL]);

    expect(p.platform).toBe("instagram");
    expect(p.externalId).toBe("18071452529442564");
    expect(p.url).toBe("https://instagram.com/reel/abc");
    expect(p.mediaType).toBe("REELS");
    expect(p.caption).toBe("Dois modulos saindo pro mesmo terreno");
    expect(p.publishedAt?.slice(0, 10)).toBe("2026-08-12");
    expect(p.metrics.reach).toBe(703);
    expect(p.metrics.shares).toBe(2);
    expect(p.metrics.likes).toBe(40);
    expect(p.metrics.comments).toBe(4);
    // Zero e resultado; nao pode virar null.
    expect(p.metrics.saves).toBe(0);
  });

  it("guarda a linha crua para nao perder campo que hoje nao usamos", () => {
    const [p] = fromWindsorRows([LINHA_REEL]);
    expect(p.raw.media_product_type).toBe("REELS");
  });

  it("descarta linha sem identificador de midia", () => {
    // Sem media_id nao ha como conciliar nem deduplicar: a linha e inutil.
    expect(fromWindsorRows([{ media_reach: 100 }])).toHaveLength(0);
  });

  it("campo ausente vira null, nao zero", () => {
    const [p] = fromWindsorRows([{ media_id: "1", media_reach: 50 }]);
    expect(p.metrics.reach).toBe(50);
    // "Nao sei" e diferente de "foi zero" — o aprendizado depende disso.
    expect(p.metrics.saves).toBeNull();
    expect(p.metrics.likes).toBeNull();
  });

  it("seguidores ganhos fica nulo: e metrica de conta, nao de post", () => {
    const [p] = fromWindsorRows([LINHA_REEL]);
    expect(p.metrics.followersGained).toBeNull();
  });

  it("prefere media_product_type a media_type quando os dois existem", () => {
    const [p] = fromWindsorRows([
      { media_id: "1", media_type: "VIDEO", media_product_type: "REELS" },
    ]);
    expect(p.mediaType).toBe("REELS");
  });

  it("deduplica a mesma midia mantendo a linha mais completa", () => {
    // O conector devolve uma linha por dia; as antigas costumam vir vazias.
    const posts = fromWindsorRows([
      { media_id: "1", media_reach: null, media_saved: null },
      { media_id: "1", media_reach: 703, media_saved: 2 },
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0].metrics.reach).toBe(703);
  });

  it("aceita outra plataforma sem mudanca de codigo", () => {
    const [p] = fromWindsorRows([{ media_id: "9" }], "tiktok");
    expect(p.platform).toBe("tiktok");
  });

  it("data invalida vira null em vez de quebrar", () => {
    const [p] = fromWindsorRows([{ media_id: "1", timestamp: "nao e data" }]);
    expect(p.publishedAt).toBeNull();
  });
});

describe("manualWindsorSource", () => {
  it("cumpre o contrato MetricsSource e filtra por periodo", async () => {
    const source = manualWindsorSource([
      { ...LINHA_REEL, media_id: "dentro", timestamp: "2026-08-12T00:00:00Z" },
      { ...LINHA_REEL, media_id: "fora", timestamp: "2026-06-01T00:00:00Z" },
    ]);

    expect(source.name).toBe("windsor-manual");
    const posts = await source.fetchPosts({ from: "2026-08-01", to: "2026-08-31" });
    expect(posts.map((p) => p.externalId)).toEqual(["dentro"]);
  });
});

describe("helpers de plataforma", () => {
  it("traduz slug conhecido e devolve o proprio quando nao conhece", () => {
    expect(platformLabel("instagram")).toBe("Instagram");
    expect(platformLabel("mastodon")).toBe("mastodon");
    expect(platformLabel(null)).toBe("—");
  });

  it("numeroOuNulo distingue ausencia de zero", () => {
    expect(numeroOuNulo(0)).toBe(0);
    expect(numeroOuNulo("42")).toBe(42);
    expect(numeroOuNulo(null)).toBeNull();
    expect(numeroOuNulo("")).toBeNull();
    expect(numeroOuNulo("abc")).toBeNull();
  });

  it("emptyMetrics comeca tudo desconhecido", () => {
    expect(Object.values(emptyMetrics()).every((v) => v === null)).toBe(true);
  });
});
