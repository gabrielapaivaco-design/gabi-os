import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@/lib/events/bus";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { ExternalPost } from "./types";

// Armazenamento de posts externos e metricas por conteudo.
//
// Esta camada nao sabe de onde os dados vieram. Recebe `ExternalPost[]` na forma
// normalizada e grava. Trocar Windsor por outra origem nao encosta neste arquivo.

export interface StoredExternalPost {
  id: string;
  platform: string;
  externalId: string;
  url: string | null;
  caption: string | null;
  mediaType: string | null;
  publishedAt: string | null;
  contentId: string | null;
  source: string;
  metrics: StoredMetric | null;
}

export interface StoredMetric {
  reach: number | null;
  impressions: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  collectedAt: string;
}

// Grava posts e as metricas deles. Idempotente: reimportar o mesmo periodo
// atualiza em vez de duplicar (os indices unicos da migration 0007 garantem).
export async function importExternalPosts(
  db: SupabaseClient,
  posts: ExternalPost[],
  source = "manual",
): Promise<{ posts: number; metrics: number }> {
  const workspaceId = getWorkspaceId();
  if (posts.length === 0) return { posts: 0, metrics: 0 };

  const { data: gravados, error } = await db
    .from("external_posts")
    .upsert(
      posts.map((p) => ({
        workspace_id: workspaceId,
        platform: p.platform,
        external_id: p.externalId,
        url: p.url,
        caption: p.caption,
        media_type: p.mediaType,
        published_at: p.publishedAt,
        source,
        raw: p.raw,
      })),
      { onConflict: "workspace_id,platform,external_id" },
    )
    .select("id, platform, external_id, content_id");

  if (error) throw new Error(error.message);

  // A metrica nasce ligada ao post. Se o post ja foi conciliado, ela tambem ja
  // nasce ligada ao Conteudo — o aprendizado nao precisa esperar.
  const porChave = new Map(
    (gravados ?? []).map((r: { platform: string; external_id: string; content_id: string | null }) => [
      `${r.platform}:${r.external_id}`,
      r.content_id,
    ]),
  );

  const linhas = posts
    .filter((p) => Object.values(p.metrics).some((v) => v !== null))
    .map((p) => ({
      workspace_id: workspaceId,
      content_id: porChave.get(`${p.platform}:${p.externalId}`) ?? null,
      platform: p.platform,
      external_media_id: p.externalId,
      reach: p.metrics.reach,
      impressions: p.metrics.impressions,
      views: p.metrics.views,
      likes: p.metrics.likes,
      comments: p.metrics.comments,
      shares: p.metrics.shares,
      saves: p.metrics.saves,
      followers_gained: p.metrics.followersGained,
      source,
      collected_at: new Date().toISOString(),
    }));

  if (linhas.length > 0) {
    // Idempotencia por dia, feita aqui e nao por indice unico: a expressao
    // `collected_at::date` nao e aceita em indice (depende do fuso da sessao).
    // Apagar as coletas de hoje destas midias antes de gravar faz reimportar
    // corrigir em vez de duplicar, e preserva o historico dos dias anteriores.
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const { error: errLimpeza } = await db
      .from("metrics")
      .delete()
      .eq("workspace_id", workspaceId)
      .in(
        "external_media_id",
        posts.map((p) => p.externalId),
      )
      .gte("collected_at", inicioDoDia.toISOString());
    if (errLimpeza) throw new Error(errLimpeza.message);

    const { error: errMetric } = await db.from("metrics").insert(linhas);
    if (errMetric) throw new Error(errMetric.message);
  }

  await emit(db, {
    type: "metrica.recebida",
    workspaceId,
    payload: { origem: source, posts: posts.length, metricas: linhas.length },
  });

  return { posts: (gravados ?? []).length, metrics: linhas.length };
}

export async function listExternalPosts(db: SupabaseClient): Promise<StoredExternalPost[]> {
  const workspaceId = getWorkspaceId();

  const [postsRes, metricsRes] = await Promise.all([
    db
      .from("external_posts")
      .select("id, platform, external_id, url, caption, media_type, published_at, content_id, source")
      .eq("workspace_id", workspaceId)
      .order("published_at", { ascending: false, nullsFirst: false }),
    db
      .from("metrics")
      .select(
        "platform, external_media_id, reach, impressions, views, likes, comments, shares, saves, collected_at",
      )
      .eq("workspace_id", workspaceId)
      .not("external_media_id", "is", null)
      .order("collected_at", { ascending: false }),
  ]);

  if (postsRes.error) throw new Error(postsRes.error.message);

  // A coleta mais recente de cada midia e a que vale.
  const maisRecente = new Map<string, StoredMetric>();
  for (const m of (metricsRes.data ?? []) as Record<string, unknown>[]) {
    const chave = `${m.platform}:${m.external_media_id}`;
    if (maisRecente.has(chave)) continue;
    maisRecente.set(chave, {
      reach: (m.reach as number | null) ?? null,
      impressions: (m.impressions as number | null) ?? null,
      views: (m.views as number | null) ?? null,
      likes: (m.likes as number | null) ?? null,
      comments: (m.comments as number | null) ?? null,
      shares: (m.shares as number | null) ?? null,
      saves: (m.saves as number | null) ?? null,
      collectedAt: String(m.collected_at),
    });
  }

  return ((postsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    platform: String(r.platform),
    externalId: String(r.external_id),
    url: (r.url as string | null) ?? null,
    caption: (r.caption as string | null) ?? null,
    mediaType: (r.media_type as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    contentId: (r.content_id as string | null) ?? null,
    source: String(r.source ?? "manual"),
    metrics: maisRecente.get(`${r.platform}:${r.external_id}`) ?? null,
  }));
}

export interface ReconcilableContent {
  id: string;
  title: string;
  status: string;
  format: string | null;
  hook: string | null;
  pillarName: string | null;
  plannedAt: string | null;
  publishedAt: string | null;
  platform: string | null;
  externalId: string | null;
}

// LADO A da conciliacao: conteudos que ja sairam ou estao na fila para sair.
//
// Inclui `agendar` porque na pratica voce publica e volta aqui depois — exigir
// que o card ja esteja em "publicado" obrigaria dois passos manuais para a
// mesma informacao.
export async function listReconcilableContents(
  db: SupabaseClient,
): Promise<ReconcilableContent[]> {
  const workspaceId = getWorkspaceId();

  const { data, error } = await db
    .from("contents")
    .select("id, title, status, format, hook, planned_at, published_at, platform, external_id, pillars(name)")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .in("status", ["agendar", "publicado"])
    .order("planned_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const p = r.pillars as { name?: string } | { name?: string }[] | null;
    const pilar = Array.isArray(p) ? p[0] : p;
    return {
      id: String(r.id),
      title: String(r.title),
      status: String(r.status),
      format: (r.format as string | null) ?? null,
      hook: (r.hook as string | null) ?? null,
      pillarName: pilar?.name ?? null,
      plannedAt: (r.planned_at as string | null) ?? null,
      publishedAt: (r.published_at as string | null) ?? null,
      platform: (r.platform as string | null) ?? null,
      externalId: (r.external_id as string | null) ?? null,
    };
  });
}

// Conciliacao: liga um post externo a um Conteudo do Gabi OS.
//
// Escreve nos tres lugares que precisam saber do vinculo:
//   - o post ganha content_id
//   - o Conteudo ganha a identidade externa (plataforma, id, URL) e, se ainda
//     nao tinha, a data de publicacao do post
//   - as metricas daquela midia passam a apontar para o Conteudo
//
// O terceiro passo e o que faz o aprendizado funcionar: sem ele a metrica
// existiria solta, sem saber de que formato, pilar ou hook ela resultou.
export async function linkPostToContent(
  db: SupabaseClient,
  postId: string,
  contentId: string,
): Promise<void> {
  const workspaceId = getWorkspaceId();

  const { data: post, error: errPost } = await db
    .from("external_posts")
    .select("platform, external_id, url, published_at")
    .eq("id", postId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (errPost) throw new Error(errPost.message);
  if (!post) throw new Error("Post nao encontrado neste workspace.");

  const { error: errLink } = await db
    .from("external_posts")
    .update({ content_id: contentId })
    .eq("id", postId)
    .eq("workspace_id", workspaceId);
  if (errLink) throw new Error(errLink.message);

  const { data: atual } = await db
    .from("contents")
    .select("published_at")
    .eq("id", contentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const { error: errContent } = await db
    .from("contents")
    .update({
      platform: post.platform,
      external_id: post.external_id,
      external_url: post.url,
      // Nao sobrescreve data que voce ja tinha informado.
      published_at: atual?.published_at ?? post.published_at ?? new Date().toISOString(),
      status: "publicado",
    })
    .eq("id", contentId)
    .eq("workspace_id", workspaceId);
  if (errContent) throw new Error(errContent.message);

  const { error: errMetric } = await db
    .from("metrics")
    .update({ content_id: contentId })
    .eq("workspace_id", workspaceId)
    .eq("platform", post.platform)
    .eq("external_media_id", post.external_id);
  if (errMetric) throw new Error(errMetric.message);

  await emit(db, {
    type: "conteudo.publicado",
    workspaceId,
    payload: { content_id: contentId, platform: post.platform, external_id: post.external_id },
  });
}

// Desfaz a conciliacao. O post e a metrica continuam existindo — o que se perde
// e a afirmacao de que aquele post veio daquele Conteudo.
export async function unlinkPost(db: SupabaseClient, postId: string): Promise<void> {
  const workspaceId = getWorkspaceId();

  const { data: post } = await db
    .from("external_posts")
    .select("platform, external_id, content_id")
    .eq("id", postId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!post) throw new Error("Post nao encontrado neste workspace.");

  await db.from("external_posts").update({ content_id: null }).eq("id", postId).eq("workspace_id", workspaceId);

  await db
    .from("metrics")
    .update({ content_id: null })
    .eq("workspace_id", workspaceId)
    .eq("platform", post.platform)
    .eq("external_media_id", post.external_id);

  if (post.content_id) {
    await db
      .from("contents")
      .update({ platform: null, external_id: null, external_url: null })
      .eq("id", post.content_id)
      .eq("workspace_id", workspaceId);
  }
}

// Marcar como publicado sem post externo em maos.
//
// Existe porque publicar e registrar o numero sao momentos diferentes: voce
// publica hoje e concilia na semana seguinte, quando importar as metricas.
export async function markPublished(
  db: SupabaseClient,
  contentId: string,
  input: { platform?: string | null; externalId?: string | null; url?: string | null } = {},
): Promise<void> {
  const workspaceId = getWorkspaceId();

  const patch: Record<string, unknown> = {
    status: "publicado",
    published_at: new Date().toISOString(),
  };
  if (input.platform) patch.platform = input.platform;
  if (input.externalId) patch.external_id = input.externalId;
  if (input.url) patch.external_url = input.url;

  const { error } = await db
    .from("contents")
    .update(patch)
    .eq("id", contentId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  await emit(db, {
    type: "conteudo.publicado",
    workspaceId,
    payload: { content_id: contentId, platform: input.platform ?? null },
  });
}
