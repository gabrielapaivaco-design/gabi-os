"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Archive } from "lucide-react";
import type { Leftover } from "@/lib/planning/service";
import { carryOverAction, retireAction } from "./actions";

// Virada de mes. Aparece quando sobrou coisa do mes anterior sem publicar.
//
// Nada e decidido pelo sistema: trazer adiante arrasta por meses o que nunca
// vai ser gravado, aposentar joga fora ideia que so nao teve vez. Quem sabe a
// diferenca e ela, entao a tela pergunta.
export function MonthRollover({
  leftovers,
  mesAnterior,
  destino,
}: {
  leftovers: Leftover[];
  mesAnterior: string;
  destino: { year: number; month: number };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  // Comeca com os que ja tem trabalho dentro marcados: sao os que mais valem a
  // pena salvar, e desmarcar um e mais rapido que marcar cinco.
  const [escolhidos, setEscolhidos] = useState<Set<string>>(
    () => new Set(leftovers.filter((l) => l.trabalhado).map((l) => l.id)),
  );

  if (leftovers.length === 0) return null;

  function agir(acao: "trazer" | "aposentar") {
    const ids = Array.from(escolhidos);
    if (ids.length === 0) return;
    setErro(null);

    startTransition(async () => {
      const r = acao === "trazer" ? await carryOverAction(ids, destino) : await retireAction(ids);
      if (!r.ok) return setErro(r.error);
      setFeito(
        acao === "trazer"
          ? `${r.created} ${r.created === 1 ? "conteudo trazido" : "conteudos trazidos"} para este mes.`
          : `${r.created} ${r.created === 1 ? "conteudo arquivado" : "conteudos arquivados"}.`,
      );
      setEscolhidos(new Set());
      router.refresh();
    });
  }

  if (feito) {
    return (
      <section className="rounded-card bg-surface p-5">
        <p className="text-[13px] text-ink">{feito}</p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-rose/30 bg-surface p-5">
      <h2 className="font-serif text-[21px] font-light leading-tight text-ink">
        Sobrou coisa de {mesAnterior}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {leftovers.length} {leftovers.length === 1 ? "conteudo foi planejado" : "conteudos foram planejados"}{" "}
        e nao {leftovers.length === 1 ? "saiu" : "sairam"}. Traga para este mes o que ainda faz
        sentido; aposente o resto. Marquei os que ja tem roteiro ou legenda escritos.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {leftovers.map((l) => (
          <li key={l.id}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={escolhidos.has(l.id)}
                onChange={(e) => {
                  const s = new Set(escolhidos);
                  if (e.target.checked) s.add(l.id);
                  else s.delete(l.id);
                  setEscolhidos(s);
                }}
                disabled={isPending}
                className="mt-1 accent-rose"
              />
              <span className="min-w-0 flex-1">
                <span className="text-[14px] text-ink">{l.title}</span>
                <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-faint">
                  dia {new Date(l.plannedAt).getDate()}
                  {l.format ? ` · ${l.format}` : ""} · {l.status}
                  {l.trabalhado && <span className="text-rose-ink"> · ja tem texto</span>}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {erro && <p className="mt-3 text-[12px] text-destructive">{erro}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => agir("trazer")}
          disabled={isPending || escolhidos.size === 0}
          className="flex items-center gap-1.5 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
        >
          <ArrowRight size={13} />
          Trazer {escolhidos.size} para este mes
        </button>
        <button
          onClick={() => agir("aposentar")}
          disabled={isPending || escolhidos.size === 0}
          className="flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-destructive disabled:opacity-40"
        >
          <Archive size={13} />
          Aposentar {escolhidos.size}
        </button>
      </div>
    </section>
  );
}
