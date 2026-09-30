import type { Moment } from "@/types/db";
import { diaNoFuso } from "@/lib/utils/hoje";

export interface MomentDayGroup {
  key: string;
  label: string;
  moments: Moment[];
}

// O dia em que o Momento caiu PARA ELA. Lido pelo relogio do servidor, um
// Momento registrado as 22h cairia no dia seguinte, porque em UTC ja e.
const localDayKey = diaNoFuso;

const UM_DIA = 24 * 60 * 60 * 1000;

function dayLabel(iso: string): string {
  // Comparadas como chave, e nao como Date. Converter a data de hoje para ISO
  // e le-la de volta no fuso a empurra tres horas para tras e devolve ontem —
  // o Brasil nao tem horario de verao desde 2019, entao 24 horas antes de agora
  // e sempre o dia anterior no calendario.
  const agora = Date.now();
  const key = localDayKey(iso);
  if (key === localDayKey(new Date(agora))) return "Hoje";
  if (key === localDayKey(new Date(agora - UM_DIA))) return "Ontem";

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
