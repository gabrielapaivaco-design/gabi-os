import { createClient } from "@/lib/supabase/server";
import { buildPlanningContext, summarizeContext } from "@/lib/planning/context";
import { loadMonthlyPlan, listUntouchedFromMonth, type StoredPlan } from "@/lib/planning/service";
import { monthLabel } from "@/lib/calendar/month";
import { isAiConfigured } from "@/lib/ai";
import { PlanPanel } from "./plan-panel";

export default async function PlanejamentoPage() {
  const now = new Date();
  const period = { year: now.getFullYear(), month: now.getMonth() };

  let summary: ReturnType<typeof summarizeContext> = [];
  let plan: StoredPlan | null = null;
  let aArquivar: { id: string; title: string }[] = [];
  let unavailable = false;

  try {
    const db = createClient();
    const ctx = await buildPlanningContext(db, period);
    summary = summarizeContext(ctx);
    plan = await loadMonthlyPlan(db, period);
    // Cards do plano anterior que aprovar vai aposentar. Mostrados antes, para
    // que arquivar nunca seja surpresa.
    if (plan && !plan.approved) aArquivar = await listUntouchedFromMonth(db, period);
  } catch {
    unavailable = true;
  }

  const ready = summary.filter((s) => s.ready).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Planejamento do mes</h1>
        <p className="mt-0.5 text-[13px] capitalize text-muted">
          {monthLabel(period.year, period.month)}
        </p>
      </header>

      {unavailable ? (
        <p className="text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <PlanPanel
            period={period}
            plan={plan}
            aiConfigured={isAiConfigured()}
            aArquivar={aArquivar}
          />

          <section className="rounded-card border border-line bg-surface p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[12px] font-medium uppercase tracking-wide text-faint">
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
                        item.ready ? "bg-status-agendar" : "bg-line"
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
