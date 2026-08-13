// Helpers puros do calendario mensal. Trabalham com chaves de dia locais
// ("YYYY-MM-DD") em vez de Date para evitar deslocamento de fuso: um conteudo
// planejado para 05/08 deve aparecer no dia 5 independentemente do fuso.

export interface MonthCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Converte um timestamptz do Postgres para a chave do dia local.
export function dayKeyFromIso(iso: string): string {
  return dayKey(new Date(iso));
}

// Meio-dia local evita que a conversao para UTC jogue a data para o dia
// anterior/seguinte em fusos negativos como o do Brasil.
export function isoFromDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// Grade completa de 6 semanas (42 celulas), comecando no domingo — sempre o
// mesmo tamanho, para o layout nao "pular" ao trocar de mes.
export function buildMonthGrid(year: number, month: number, today = new Date()): MonthCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const todayKey = dayKey(today);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(date);
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: key === todayKey,
    };
  });
}
