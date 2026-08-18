// Contrato agnostico de origem de metricas.
//
// Este arquivo nao menciona Windsor, Metricool nem Instagram por nome de campo.
// E o mesmo padrao do provedor de IA (`lib/ai/types.ts`): a regra de negocio
// fala com a interface, nunca com o fornecedor. Trocar a origem dos dados e
// escrever um novo mapeador; nada em conciliacao, armazenamento ou aprendizado
// muda.

// Plataforma onde o conteudo foi publicado. Texto livre de proposito — TikTok,
// YouTube ou LinkedIn entram sem migration nem mudanca de tipo.
export type Platform = string;

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export function platformLabel(p: string | null): string {
  if (!p) return "—";
  return PLATFORM_LABEL[p] ?? p;
}

// Numeros que uma plataforma pode entregar. Todos nulaveis: cada origem entrega
// um subconjunto diferente, e `null` significa "nao sei", nao "zero". A
// diferenca importa no aprendizado — zero salvamentos e um resultado, ausencia
// de dado nao e.
export interface ExternalMetrics {
  reach: number | null;
  impressions: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followersGained: number | null;
}

export function emptyMetrics(): ExternalMetrics {
  return {
    reach: null,
    impressions: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    followersGained: null,
  };
}

// Um post que existe na plataforma, na forma normalizada do sistema.
export interface ExternalPost {
  platform: Platform;
  externalId: string;
  url: string | null;
  caption: string | null;
  // REELS, CAROUSEL_ALBUM, FEED, STORY... como a plataforma chama.
  mediaType: string | null;
  publishedAt: string | null;
  metrics: ExternalMetrics;
  // A linha crua da origem. Guardada para nao perder campo que hoje nao usamos
  // e para permitir reprocessar sem buscar de novo.
  raw: Record<string, unknown>;
}

// Uma origem de posts e metricas.
//
// Hoje existe apenas a origem manual (`fromWindsorRows` alimentada por script).
// Uma futura `WindsorApiSource` implementaria esta mesma interface chamando a
// API — e o resto do sistema nao saberia da diferenca.
export interface MetricsSource {
  readonly name: string;
  fetchPosts(range: { from: string; to: string }): Promise<ExternalPost[]>;
}

export function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
