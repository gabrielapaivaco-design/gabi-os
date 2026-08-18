import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/ai";
import { STATUS_ORDER } from "@/lib/utils/constants";
import { getWorkspaceId } from "@/lib/workspace/current";
import { dayKeyFromIso } from "@/lib/calendar/month";
import type { ContentStatus } from "@/types/db";
import { PipelineBoard, type ContentCardData, type PillarOption } from "./pipeline-board";

type Columns = Record<ContentStatus, ContentCardData[]>;

function emptyColumns(): Columns {
  const columns = {} as Columns;
  for (const status of STATUS_ORDER) columns[status] = [];
  return columns;
}

interface BoardData {
  columns: Columns;
  pillars: PillarOption[];
  unavailable: boolean;
}

async function loadBoard(): Promise<BoardData> {
  try {
    const db = createClient();
    const workspaceId = getWorkspaceId();
    const [contentsRes, pillarsRes] = await Promise.all([
      db
        .from("contents")
        .select(
          "id, title, status, format, objective, pillar_id, hook, script, caption, cta, planned_at, moment_id, published_at, platform, external_id, external_url, moment:moments(body)",
        )
        .eq("workspace_id", workspaceId)
        .eq("archived", false)
        .order("sort", { ascending: true }),
      db
        .from("pillars")
        .select("id, name, color")
        .eq("workspace_id", workspaceId)
        .order("sort", { ascending: true }),
    ]);

    if (contentsRes.error) throw contentsRes.error;
    if (pillarsRes.error) throw pillarsRes.error;

    const columns = emptyColumns();
    for (const row of (contentsRes.data ?? []) as any[]) {
      const status = row.status as ContentStatus;
      columns[status].push({
        id: row.id,
        title: row.title,
        format: row.format,
        objective: row.objective,
        pillarId: row.pillar_id,
        hook: row.hook,
        script: row.script,
        caption: row.caption,
        cta: row.cta,
        momentId: row.moment_id,
        momentExcerpt: row.moment?.body ?? null,
        plannedDayKey: row.planned_at ? dayKeyFromIso(row.planned_at) : null,
        publishedAt: row.published_at ?? null,
        platform: row.platform ?? null,
        externalId: row.external_id ?? null,
        externalUrl: row.external_url ?? null,
      });
    }
    return { columns, pillars: (pillarsRes.data ?? []) as PillarOption[], unavailable: false };
  } catch {
    return { columns: emptyColumns(), pillars: [], unavailable: true };
  }
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: { open?: string };
}) {
  const { columns, pillars, unavailable } = await loadBoard();

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Arraste os cards entre os status conforme o conteudo avanca.
        </p>
      </header>

      {unavailable && (
        <p className="mb-4 text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas — as colunas abaixo ainda nao tem dados.
        </p>
      )}

      <PipelineBoard
        initialColumns={columns}
        pillars={pillars}
        initialOpenCardId={searchParams.open ?? null}
        aiConfigured={isAiConfigured()}
      />
    </div>
  );
}
