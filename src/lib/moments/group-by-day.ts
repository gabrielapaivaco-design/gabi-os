import type { Moment } from "@/types/db";

export interface MomentDayGroup {
  key: string;
  label: string;
  moments: Moment[];
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(iso: string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const key = localDayKey(iso);
  if (key === localDayKey(today.toISOString())) return "Hoje";
  if (key === localDayKey(yesterday.toISOString())) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

// Feed estilo diario: dias do mais recente para o mais antigo,
// momentos dentro do dia em ordem cronologica (como foram vividos).
export function groupMomentsByDay(moments: Moment[]): MomentDayGroup[] {
  const byDay = new Map<string, Moment[]>();
  for (const m of moments) {
    const key = localDayKey(m.created_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(m);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, dayMoments]) => ({
      key,
      label: dayLabel(dayMoments[0].created_at),
      moments: [...dayMoments].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    }));
}
