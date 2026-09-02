import Link from "next/link";
import { CalendarRange } from "lucide-react";
import type { StoriesDay } from "@/lib/ai/director/planner";
import { WEEKDAY_LABEL, type Weekday } from "@/lib/planning/weekday";

// O tema de Story de hoje, na primeira tela.
//
// Stories saem todo dia e por isso nao viram card — mas ate agora o tema so
// existia dentro de Planejamento, no mes certo, na secao certa, na linha do dia
// certo. Achar isso todo santo dia e o gasto mais frequente do sistema: sete
// vezes por semana, para uma informacao de uma linha.
//
// Aqui ele aparece sem ser procurado. Amanha o texto muda sozinho.

export function StoriesHoje({ dia, hoje }: { dia: StoriesDay | null; hoje: Weekday }) {
  // Sem plano no mes, ou com um plano cujo dia de hoje ficou de fora, a secao
  // some inteira em vez de mostrar uma casca vazia. O convite para planejar ja
  // esta em outros lugares da tela.
  if (!dia) return null;

  return (
    <section className="mb-5 rounded-card border border-rose/25 bg-surface p-5">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rose-ink">
          Story de hoje
        </h2>
        <Link
          href="/planejamento"
          className="flex shrink-0 items-center gap-1 text-[11px] text-faint transition-colors hover:text-ink"
        >
          <CalendarRange size={11} /> a semana toda
        </Link>
      </div>

      <p className="max-w-[620px] font-serif text-[21px] font-light leading-[1.4] text-ink">
        {dia.theme}
      </p>

      {dia.why && (
        <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-muted">{dia.why}</p>
      )}

      <p className="mt-3 text-[11px] uppercase tracking-wide text-faint">
        {WEEKDAY_LABEL[hoje]}
      </p>
    </section>
  );
}
