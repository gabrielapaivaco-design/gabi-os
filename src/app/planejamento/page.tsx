import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buildPlanningContext, summarizeContext } from "@/lib/planning/context";
import {
  listLeftovers,
  listUntouchedFromMonth,
  loadMonthlyPlan,
  type Leftover,
  type StoredPlan,
} from "@/lib/planning/service";
import { monthLabel, shiftMonth } from "@/lib/calendar/month";
import { isAiConfigured } from "@/lib/ai";
import { PlanPanel } from "./plan-panel";
import { MonthRollover } from "./month-rollover";

// O mes vem da URL (`?mes=2026-09`) e cai no mes corrente quando ausente.
// Sem isso a tela ficaria presa em "hoje": nao daria para olhar o que foi
// planejado no mes passado nem adiantar o proximo.
function lerPeriodo(mes: string | undefined): { year: number; month: number } {
  const hoje = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "");
  if (!m) return { year: hoje.getFullYear(), month: hoje.getMonth() };

  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11 || year < 2020 || year > 2100) {
    return { year: hoje.getFullYear(), month: hoje.getMonth() };
  }
  return { year, month };
}

function paraUrl(p: { year: number; month: number }): string {
  return `/planejamento?mes=${p.year}-${String(p.month + 1).padStart(2, "0")}`;
}

export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const period = lerPeriodo(searchParams.mes);
  const anterior = shiftMonth(period.year, period.month, -1);
  const proximo = shiftMonth(period.year, period.month, 1);

  const hoje = new Date();
  const ehMesCorrente = hoje.getFullYear() === period.year && hoje.getMonth() === period.month;

  let summary: ReturnType<typeof summarizeContext> = [];
  let plan: StoredPlan | null = null;
  let aArquivar: { id: string; title: string }[] = [];
  let leftovers: Leftover[] = [];
  let unavailable = false;

  try {
    const db = createClient();
    const ctx = await buildPlanningContext(db, period);
    summary = summarizeContext(ctx);
    plan = await loadMonthlyPlan(db, period);
    if (plan && !plan.approved) aArquivar = await listUntouchedFromMonth(db, period);
    // A virada so interessa enquanto este mes ainda nao tem plano: depois disso
    // o que sobrou ja foi decidido, e repetir a pergunta vira ruido.
    if (!plan) leftovers = await listLeftovers(db, anterior);
  } catch {
    unavailable = true;
  }

  const ready = summary.filter((s) => s.ready).length;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[34px] font-light leading-tight tracking-tight">
            Planejamento do mes
          </h1>
          <p className="mt-0.5 text-[13px] capitalize text-muted">
            {monthLabel(period.year, period.month)}
            {!ehMesCorrente && <span className="normal-case text-faint"> · outro mes</span>}
          </p>
        </div>

        <nav className="flex shrink-0 items-center gap-1" aria-label="Trocar de mes">
          <Link
            href={paraUrl(anterior)}
            aria-label="Mes anterior"
            className="rounded-control p-2 text-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <ChevronLeft size={16} />
          </Link>
          {!ehMesCorrente && (
            <Link
              href="/planejamento"
              className="rounded-control px-2.5 py-1.5 text-[12px] text-faint transition-colors hover:bg-surface hover:text-ink"
            >
              hoje
            </Link>
          )}
          <Link
            href={paraUrl(proximo)}
            aria-label="Proximo mes"
            className="rounded-control p-2 text-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <ChevronRight size={16} />
          </Link>
        </nav>
      </header>

      {unavailable ? (
        <p className="text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <MonthRollover
            leftovers={leftovers}
            mesAnterior={monthLabel(anterior.year, anterior.month)}
            destino={period}
          />

          <PlanPanel
            period={period}
            plan={plan}
            aiConfigured={isAiConfigured()}
            aArquivar={aArquivar}
          />

          <section className="rounded-card bg-surface p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
                Cenario que o Diretor le
              </h2>
              <span className="text-[12px] text-faint">
                {ready} de {summary.length} fontes com dados
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {summary.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.ready ? "bg-rose" : "bg-line"
                      }`}
                    />
                    <span className={item.ready ? "text-ink" : "text-muted"}>{item.label}</span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] text-faint">{item.value}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
