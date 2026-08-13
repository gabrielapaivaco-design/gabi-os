import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace/current";
import { dayKeyFromIso } from "@/lib/calendar/month";
import type { ContentStatus } from "@/types/db";
import { CalendarBoard, type CalendarContent, type CommemorativeDate } from "./calendar-board";

interface CalendarData {
  contents: CalendarContent[];
  commemorativeDates: CommemorativeDate[];
  unavailable: boolean;
}

async function loadCalendar(): Promise<CalendarData> {
  try {
    const db = createClient();
    const workspaceId = getWorkspaceId();

    const contentsRes = await db
      .from("contents")
      .select("id, title, status, planned_at, pillar_id, pillar:pillars(name, color)")
      .eq("workspace_id", workspaceId)
      .eq("archived", false)
      .order("sort", { ascending: true });

    if (contentsRes.error) throw contentsRes.error;

    // Datas comemorativas vem da migration 0003; se ela ainda nao foi rodada,
    // o calendario funciona normalmente sem os marcadores.
    const datesRes = await db
      .from("commemorative_dates")
      .select("id, name, month, day")
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);

    const contents = ((contentsRes.data ?? []) as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status as ContentStatus,
      dayKey: row.planned_at ? dayKeyFromIso(row.planned_at) : null,
      pillarName: row.pillar?.name ?? null,
      pillarColor: row.pillar?.color ?? null,
    }));

    return {
      contents,
      commemorativeDates: datesRes.error ? [] : ((datesRes.data ?? []) as CommemorativeDate[]),
      unavailable: false,
    };
  } catch {
    return { contents: [], commemorativeDates: [], unavailable: true };
  }
}

export default async function CalendarioPage() {
  const { contents, commemorativeDates, unavailable } = await loadCalendar();
  const now = new Date();

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Arraste conteudos do Pipeline para os dias do mes.
          </p>
        </div>
        <Link
          href="/planejamento"
          className="shrink-0 rounded-control border border-line px-3 py-1.5 text-[13px] text-ink transition-colors hover:bg-canvas"
        >
          Planejamento do mes
        </Link>
      </header>

      {unavailable && (
        <p className="mb-4 text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas.
        </p>
      )}

      <CalendarBoard
        contents={contents}
        commemorativeDates={commemorativeDates}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth()}
      />
    </div>
  );
}
