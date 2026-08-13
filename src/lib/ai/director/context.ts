import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkspaceId } from "@/lib/workspace/current";
import type { BrainKind, ContentStatus, Objective } from "@/types/db";

// Motor de Contexto no nivel de UM conteudo — o irmao menor de
// lib/planning/context.ts, que monta o cenario de um mes inteiro.
//
// Sempre que o Diretor for gerar algo para um card, ele precisa saber quem e a
// marca (Brand), como o negocio ganha dinheiro (Business), o que ja se provou
// funcionar (Learned + DNA), de que Momento real aquilo nasceu, e o que ja
// existe no proprio card. Esta funcao junta tudo isso em uma leitura so.
//
// Nenhuma chamada de IA acontece aqui: esta camada apenas LE e AGREGA, e todo
// filtro passa por workspace_id.

export interface ContentContext {
  workspaceId: string;
  workspaceName: string;
  content: {
    id: string;
    title: string;
    format: string | null;
    status: ContentStatus;
    objective: Objective | null;
    hook: string | null;
    script: string | null;
    caption: string | null;
    cta: string | null;
  };
  pillar: { name: string } | null;
  originMoment: string | null;
  brains: Record<BrainKind, Record<string, unknown>>;
  // Conteudos ja publicados servem de referencia de voz e de formato: o que
  // esta marca de fato ja colocou no mundo.
  publishedExamples: { title: string; format: string | null; hook: string | null }[];
  contentDna: Record<string, unknown>[];
}

const PUBLISHED_LIMIT = 8;
const DNA_LIMIT = 20;

export async function buildContentContext(
  db: SupabaseClient,
  contentId: string,
): Promise<ContentContext> {
  const workspaceId = getWorkspaceId();

  const { data: content, error: contentError } = await db
    .from("contents")
    .select(
      "id, title, format, status, objective, hook, script, caption, cta, pillar_id, moment_id",
    )
    .eq("id", contentId)
    .eq("workspace_id", workspaceId)
    .single();

  // O filtro por workspace_id nao e cosmetico: impede que um id de outro
  // workspace seja usado para ler conteudo alheio.
  if (contentError || !content) {
    throw new Error("Conteudo nao encontrado neste workspace.");
  }

  const [workspaceRes, brainsRes, pillarRes, momentRes, publishedRes, dnaRes] = await Promise.all([
    db.from("workspaces").select("name").eq("id", workspaceId).single(),
    db.from("brains").select("kind, content").eq("workspace_id", workspaceId),
    content.pillar_id
      ? db.from("pillars").select("name").eq("id", content.pillar_id).single()
      : Promise.resolve({ data: null, error: null }),
    content.moment_id
      ? db.from("moments").select("body").eq("id", content.moment_id).single()
      : Promise.resolve({ data: null, error: null }),
    db
      .from("contents")
      .select("title, format, hook")
      .eq("workspace_id", workspaceId)
      .eq("status", "publicado")
      .eq("archived", false)
      .order("published_at", { ascending: false })
      .limit(PUBLISHED_LIMIT),
    db.from("content_dna").select("*").eq("workspace_id", workspaceId).limit(DNA_LIMIT),
  ]);

  const brains = { brand: {}, business: {}, learned: {} } as ContentContext["brains"];
  for (const row of (brainsRes.data ?? []) as { kind: BrainKind; content: Record<string, unknown> }[]) {
    brains[row.kind] = row.content ?? {};
  }

  return {
    workspaceId,
    workspaceName: (workspaceRes.data as { name?: string } | null)?.name ?? "este workspace",
    content: {
      id: content.id,
      title: content.title,
      format: content.format,
      status: content.status,
      objective: content.objective,
      hook: content.hook,
      script: content.script,
      caption: content.caption,
      cta: content.cta,
    },
    pillar: (pillarRes.data as { name: string } | null) ?? null,
    originMoment: (momentRes.data as { body: string } | null)?.body ?? null,
    brains,
    publishedExamples: (publishedRes.data ?? []) as ContentContext["publishedExamples"],
    contentDna: (dnaRes.data ?? []) as Record<string, unknown>[],
  };
}

// Serializa o cenario em texto para o prompt. Secoes vazias sao OMITIDAS em
// vez de virarem "(vazio)": um Cerebro em branco nao deve ocupar espaco no
// prompt nem induzir o modelo a inventar o que falta.
export function renderContextForPrompt(ctx: ContentContext): string {
  const parts: string[] = [];

  parts.push(`## Workspace\n${ctx.workspaceName}`);

  const brandText = renderBrain(ctx.brains.brand);
  if (brandText) parts.push(`## Brand Brain (identidade e voz da marca)\n${brandText}`);

  const businessText = renderBrain(ctx.brains.business);
  if (businessText) parts.push(`## Business Brain (como o negocio ganha dinheiro)\n${businessText}`);

  const learnedText = renderBrain(ctx.brains.learned);
  if (learnedText) parts.push(`## Learned Brain (o que ja se provou funcionar)\n${learnedText}`);

  if (ctx.contentDna.length > 0) {
    parts.push(
      `## DNA do Conteudo (padroes extraidos de conteudos anteriores)\n${JSON.stringify(ctx.contentDna).slice(0, 4000)}`,
    );
  }

  if (ctx.publishedExamples.length > 0) {
    const examples = ctx.publishedExamples
      .map((c) => `- ${c.title}${c.format ? ` (${c.format})` : ""}${c.hook ? ` — hook: "${c.hook}"` : ""}`)
      .join("\n");
    parts.push(`## Conteudos ja publicados (referencia de voz)\n${examples}`);
  }

  const c = ctx.content;
  const fields = [
    `Titulo: ${c.title}`,
    c.format ? `Formato: ${c.format}` : null,
    ctx.pillar ? `Pilar: ${ctx.pillar.name}` : null,
    c.objective ? `Objetivo: ${c.objective}` : null,
    c.hook ? `Hook atual: ${c.hook}` : null,
    c.script ? `Roteiro atual: ${c.script}` : null,
    c.caption ? `Legenda atual: ${c.caption}` : null,
    c.cta ? `CTA atual: ${c.cta}` : null,
  ].filter(Boolean);
  parts.push(`## Conteudo em questao\n${fields.join("\n")}`);

  if (ctx.originMoment) {
    parts.push(`## Momento que originou este conteudo (o acontecimento real)\n${ctx.originMoment}`);
  }

  return parts.join("\n\n");
}

function renderBrain(brain: Record<string, unknown>): string | null {
  const entries = Object.entries(brain).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  );
  if (entries.length === 0) return null;
  return entries.map(([key, value]) => `### ${key}\n${String(value).trim()}`).join("\n\n");
}
