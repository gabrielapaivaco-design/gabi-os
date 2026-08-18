import {
  emptyMetrics,
  numeroOuNulo,
  type ExternalPost,
  type MetricsSource,
} from "../types";

// Mapeador de linhas do Windsor.ai para a forma do sistema.
//
// IMPORTANTE: aqui NAO ha chamada de API. Este arquivo e uma funcao pura que
// traduz linhas ja obtidas. Hoje elas chegam por script (o assistente busca
// pela conexao dele e alimenta o sistema); amanha um cliente HTTP pode buscar
// as mesmas linhas e passar por aqui.
//
// Essa separacao e o ponto do desenho: quando a API entrar, o que muda e QUEM
// traz as linhas. A traducao, o armazenamento, a conciliacao e o aprendizado
// continuam iguais.
//
// Nomes de campo conforme o conector `instagram` do Windsor:
//   media_id, media_permalink, media_caption, media_type, media_product_type,
//   media_reach, media_views, media_like_count, media_comments_count,
//   media_shares, media_saved, timestamp, date

export interface WindsorRow {
  [campo: string]: unknown;
}

export function fromWindsorRows(rows: WindsorRow[], platform = "instagram"): ExternalPost[] {
  const posts: ExternalPost[] = [];

  for (const row of rows) {
    const externalId = String(row.media_id ?? row.story_id ?? "").trim();
    // Sem identificador nao ha como conciliar nem deduplicar: a linha e inutil.
    if (!externalId) continue;

    // `media_product_type` (REELS, FEED, STORY) e mais especifico que
    // `media_type` (IMAGE, VIDEO, CAROUSEL_ALBUM) para decidir formato, mas nem
    // toda linha traz os dois.
    const mediaType =
      String(row.media_product_type ?? row.media_type ?? "").trim() || null;

    const publishedAt = normalizarData(row.timestamp ?? row.story_timestamp ?? row.date);

    posts.push({
      platform,
      externalId,
      url: textoOuNulo(row.media_permalink ?? row.story_permalink),
      caption: textoOuNulo(row.media_caption),
      mediaType,
      publishedAt,
      metrics: {
        ...emptyMetrics(),
        reach: numeroOuNulo(row.media_reach ?? row.story_reach),
        impressions: numeroOuNulo(row.media_impressions ?? row.story_impressions),
        views: numeroOuNulo(row.media_views ?? row.story_views),
        likes: numeroOuNulo(row.media_like_count),
        comments: numeroOuNulo(row.media_comments_count),
        shares: numeroOuNulo(row.media_shares ?? row.story_shares),
        saves: numeroOuNulo(row.media_saved),
        // Seguidores ganhos e metrica de conta, nao de post. Fica nulo aqui.
        followersGained: null,
      },
      raw: row as Record<string, unknown>,
    });
  }

  // A mesma midia pode voltar em varias linhas (uma por dia). Mantem a que tem
  // mais dado preenchido, porque o Windsor as vezes devolve a linha antiga com
  // campos vazios.
  return deduplicar(posts);
}

// Origem manual: as linhas ja estao em maos, nao ha o que buscar.
//
// Existe para que o codigo que consome metricas dependa de `MetricsSource` desde
// hoje. Quando a origem por API chegar, o consumidor nao muda.
export function manualWindsorSource(rows: WindsorRow[], platform = "instagram"): MetricsSource {
  const posts = fromWindsorRows(rows, platform);
  return {
    name: "windsor-manual",
    async fetchPosts(range) {
      return posts.filter((p) => {
        if (!p.publishedAt) return true;
        const d = p.publishedAt.slice(0, 10);
        return d >= range.from && d <= range.to;
      });
    },
  };
}

function textoOuNulo(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function normalizarData(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function preenchidos(p: ExternalPost): number {
  return Object.values(p.metrics).filter((v) => v !== null).length;
}

function deduplicar(posts: ExternalPost[]): ExternalPost[] {
  const porId = new Map<string, ExternalPost>();
  for (const p of posts) {
    const atual = porId.get(p.externalId);
    if (!atual || preenchidos(p) > preenchidos(atual)) porId.set(p.externalId, p);
  }
  return Array.from(porId.values());
}
