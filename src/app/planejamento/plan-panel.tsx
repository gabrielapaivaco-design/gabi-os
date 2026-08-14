"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import type { StoredPlan } from "@/lib/planning/service";
import { DirectorChat, type Turn } from "@/app/pipeline/director-chat";
import { approvePlanAction, chatAboutPlanAction, generatePlanAction } from "./actions";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function OBJ_COR(objetivo: string): string {
  switch (objetivo) {
    case "autoridade": return "text-status-roteiro";
    case "venda": return "text-status-publicado";
    case "conexao": return "text-status-analisar";
    case "crescimento": return "text-status-agendar";
    default: return "text-faint";
  }
}

export function PlanPanel({
  period,
  plan,
  aiConfigured,
}: {
  period: { year: number; month: number };
  plan: StoredPlan | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [conversando, setConversando] = useState(false);
  const [criados, setCriados] = useState<number | null>(null);

  // Um plano pode ser gerado no dia 1 e aprovado no dia 20. Marcar o que ja
  // passou evita criar card nascendo atrasado sem ninguem perceber.
  const hoje = new Date();
  const diaDeHoje =
    hoje.getFullYear() === period.year && hoje.getMonth() === period.month ? hoje.getDate() : 0;
  const vencidos = plan?.items.filter((i) => i.day < diaDeHoje).length ?? 0;

  function gerar(conversa?: Turn[]) {
    setErro(null);
    setGerando(true);
    setConversando(false);
    startTransition(async () => {
      const r = await generatePlanAction(period, conversa);
      setGerando(false);
      if (!r.ok) return setErro(r.error);
      router.refresh();
    });
  }

  function aprovar() {
    setErro(null);
    startTransition(async () => {
      const r = await approvePlanAction(period);
      if (!r.ok) return setErro(r.error);
      setCriados(r.created ?? 0);
      router.refresh();
    });
  }

  if (!aiConfigured) {
    return (
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-medium text-ink">Geracao automatica indisponivel</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Defina <code>ANTHROPIC_API_KEY</code> em <code>.env.local</code> e reinicie o servidor
          para o Diretor montar o cronograma.
        </p>
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-medium text-ink">Ainda nao ha plano para este mes</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          O Diretor le o cenario abaixo — metricas reais, Cerebros, Momentos que ainda nao viraram
          conteudo, objetivos e melhores horarios — e propoe o cronograma. Nada vira card antes de
          voce aprovar.
        </p>
        {erro && (
          <p className="mb-3 rounded-control border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] leading-relaxed text-destructive">
            {erro}
          </p>
        )}
        <button
          onClick={() => gerar()}
          disabled={isPending}
          className="flex items-center gap-2 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-50"
        >
          <Sparkles size={13} />
          {gerando ? "Montando o mes..." : "Gerar cronograma"}
        </button>
        {gerando && (
          <p className="mt-2 text-[12px] text-muted">
            Isso leva de 20 a 60 segundos — ele esta lendo o mes inteiro.
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card border border-line bg-surface p-5">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-faint">
            Leitura do Diretor
          </h2>
          {plan.approved ? (
            <span className="flex items-center gap-1 text-[12px] text-status-agendar">
              <Check size={12} /> aprovado
            </span>
          ) : (
            <span className="text-[12px] text-faint">proposta</span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-ink">{plan.diagnosis}</p>
        {plan.focus && (
          <p className="mt-4 border-l-2 border-rose pl-3 text-[15px] leading-[1.7] text-ink">
            {plan.focus}
          </p>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-faint">
            {plan.items.length} conteudos propostos
          </h2>
        </div>

        <ol className="flex flex-col gap-4">
          {plan.items.map((item, i) => {
            const data = new Date(period.year, period.month, item.day);
            const passou = item.day < diaDeHoje;
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.02 }}
                className={`flex gap-4 border-b border-line pb-4 last:border-0 last:pb-0 ${
                  passou ? "opacity-50" : ""
                }`}
              >
                <div className="w-12 shrink-0 text-center">
                  <div className="text-[15px] font-medium tabular-nums text-ink">{item.day}</div>
                  <div className="text-[11px] text-faint">{DIAS[data.getDay()]}</div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-faint">{item.hour}h</div>
                  {passou && (
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-destructive">
                      passou
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium leading-snug text-ink">{item.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] uppercase tracking-wide">
                    {item.format && <span className="text-rose-ink">{item.format}</span>}
                    {item.objective && (
                      <>
                        <span className="text-line">·</span>
                        <span className={OBJ_COR(item.objective)}>{item.objective}</span>
                      </>
                    )}
                    {item.pillar && (
                      <>
                        <span className="text-line">·</span>
                        <span className="text-faint">{item.pillar}</span>
                      </>
                    )}
                    {item.momentId && (
                      <>
                        <span className="text-line">·</span>
                        <span className="text-faint">de um Momento seu</span>
                      </>
                    )}
                  </div>
                  {item.hook && (
                    <p className="mt-2 text-[14px] leading-[1.6] text-ink">{item.hook}</p>
                  )}
                  {item.why && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.why}</p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </section>

      {erro && (
        <p className="rounded-control border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] leading-relaxed text-destructive">
          {erro}
        </p>
      )}

      {criados !== null && (
        <p className="rounded-control border border-line bg-canvas px-3 py-2 text-[13px] text-ink">
          {criados} conteudos criados no Pipeline, ja agendados no Calendario.
        </p>
      )}

      {/* Antes esta barra sumia quando o plano era aprovado, e nao havia como
          refazer o mes — que e exatamente o que se quer quando o plano saiu com
          dados incompletos. Aprovado, o que muda e o texto e a ausencia do
          botao de aprovar de novo; conversar e regerar continuam disponiveis. */}
      <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-5">
          <p className="text-[12px] leading-relaxed text-muted">
            {plan.approved ? (
              <>
                Este plano ja virou {plan.items.length} cards no Pipeline.{" "}
                <span className="text-ink">
                  Gerar de novo cria uma proposta nova e nao mexe nesses cards
                </span>{" "}
                — os antigos continuam la, e voce apaga os que nao quiser no Pipeline.
              </>
            ) : (
              <>
                {vencidos > 0 ? (
                  <>
                    <span className="text-destructive">
                      {vencidos} {vencidos === 1 ? "conteudo esta" : "conteudos estao"} com data que
                      ja passou
                    </span>{" "}
                    — gere de novo para o Diretor redistribuir no que resta do mes.{" "}
                  </>
                ) : null}
                Aprovar cria {plan.items.length} cards em &quot;Ideia&quot;, cada um com data e
                hora. Gerar de novo descarta esta proposta.
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => setConversando(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-control border border-rose/40 bg-rose-tint px-2.5 py-1.5 text-[12px] font-medium text-rose-ink transition-colors hover:border-rose disabled:opacity-40"
            >
              <MessageCircle size={12} /> Conversar
            </button>
            <button
              onClick={() => gerar()}
              disabled={isPending}
              className="text-[13px] text-faint transition-colors hover:text-ink disabled:opacity-40"
            >
              {gerando ? "Gerando..." : "Gerar de novo"}
            </button>
            {!plan.approved && (
              <button
                onClick={aprovar}
                disabled={isPending}
                className="rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-50"
              >
                {isPending && !gerando ? "Criando..." : "Aprovar e criar"}
              </button>
            )}
          </div>
        </div>

      {conversando && (
        <DirectorChat
          titulo="Conversa sobre o mes"
          intro={
            <>
              Conversando sobre o cronograma de {plan.items.length} conteudos. Ele tem o plano
              inteiro na frente, com as metricas e os Momentos que usou para monta-lo. Discordar
              aqui nao altera nada — a reescrita so acontece no botao abaixo.
            </>
          }
          atalhos={[
            "Nao vou dar conta desse volume. O que corto primeiro?",
            "Por que tanto Reel? Me convence com numero.",
            "Ficou tudo parecido. Onde falta variedade?",
          ]}
          onEnviar={(history) => chatAboutPlanAction(period, history)}
          acaoFinal={{
            label: "Refazer o plano",
            hint: "Refaz o cronograma com o que voces combinaram, preservando o que voce nao questionou.",
            onClick: (history) => gerar(history),
          }}
          onClose={() => setConversando(false)}
        />
      )}
    </div>
  );
}
