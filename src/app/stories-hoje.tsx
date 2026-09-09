import Link from "next/link";
import { CalendarRange } from "lucide-react";
import type { StoriesDay } from "@/lib/ai/director/planner";
import { WEEKDAY_LABEL, type Weekday } from "@/lib/planning/weekday";
import { Tile } from "./tile";

// O tema de Story de hoje, no maior modulo da Bancada.
//
// Stories saem todo dia e por isso nao viram card — mas ate pouco tempo o tema
// so existia dentro de Planejamento, no mes certo, na secao certa, na linha do
// dia certo. Achar isso todo santo dia era o gasto mais frequente do sistema.
//
// Ocupa duas colunas porque e a unica coisa desta tela com hora marcada: tudo
// mais pode esperar ate amanha.

export function StoriesHoje({ dia, hoje }: { dia: StoriesDay | null; hoje: Weekday }) {
  if (!dia) return null;

  return (
    // Invertido: e o unico bloco escuro do conteudo, e por isso e o primeiro
    // lugar onde o olho pousa. Antes ele era um creme levemente rosado entre
    // outros cremes, e nao ganhava do resto por nada.
    <section className="rounded-card bg-hero p-6 sm:col-span-2">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-hero-rose">
          Story de hoje · {WEEKDAY_LABEL[hoje]}
        </h2>
        <Link
          href="/planejamento"
          className="flex shrink-0 items-center gap-1 text-[11px] text-hero-muted/70 transition-colors hover:text-hero-ink"
        >
          <CalendarRange size={11} /> a semana toda
        </Link>
      </div>

      <p className="max-w-[44ch] font-serif font-light text-[30px] leading-[1.24] text-hero-ink">
        {dia.theme}
      </p>

      {dia.why && (
        <p className="mt-3 max-w-prose text-[12.5px] leading-relaxed text-hero-muted">{dia.why}</p>
      )}
    </section>
  );
}
