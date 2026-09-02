// Dias da semana da rotina de Stories. Modulo puro e sem dependencia nenhuma,
// para poder ser lido tanto pelo planejador (servidor) quanto por qualquer tela.

export const WEEKDAYS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

// Como cada dia aparece escrito na tela.
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  segunda: "segunda-feira",
  terca: "terca-feira",
  quarta: "quarta-feira",
  quinta: "quinta-feira",
  sexta: "sexta-feira",
  sabado: "sabado",
  domingo: "domingo",
};

// O `getDay()` do JavaScript comeca no domingo (0); a nossa semana comeca na
// segunda, como a de quem trabalha. O deslocamento de 6 traduz uma na outra sem
// depender de tabela.
export function weekdayDe(data: Date): Weekday {
  return WEEKDAYS[(data.getDay() + 6) % 7];
}
