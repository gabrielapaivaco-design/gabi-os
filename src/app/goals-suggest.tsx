"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { acceptGoalsAction, suggestGoalsAction } from "./goals-actions";
import type { GoalSuggestions } from "@/lib/ai/director/goals";

// Sugestao de metas pelo Diretor. Nada e gravado sozinho: ele propoe, voce
// marca o que serve e so entao vira meta. Mesma regra do resto do sistema.
export function GoalsSuggest({
  existingTitles,
  aiConfigured,
}: {
  existingTitles: string[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [sugestoes, setSugestoes] = useState<GoalSuggestions | null>(null);
  const [escolhidas, setEscolhidas] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  if (!aiConfigured) return null;

  function sugerir() {
    setErro(null);
    setGerando(true);
    setAberto(true);
    startTransition(async () => {
      const r = await suggestGoalsAction(existingTitles);
      setGerando(false);
      if (!r.ok) return setErro(r.error);
      setSugestoes(r.suggestions);
      // Tudo marcado por padrao: quem pediu sugestao normalmente quer o
      // conjunto, e desmarcar uma e mais rapido do que marcar quatro.
      setEscolhidas(new Set(r.suggestions.goals.map((_, i) => i)));
    });
  }

  function aceitar() {
    if (!sugestoes) return;
    const lista = sugestoes.goals.filter((_, i) => escolhidas.has(i));
    if (lista.length === 0) return;

    setErro(null);
    startTransition(async () => {
      const r = await acceptGoalsAction(lista.map((g) => ({ title: g.title, target: g.target })));
      if (!r.ok) return setErro(r.error);
      setAberto(false);
      setSugestoes(null);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <button
        onClick={sugerir}
        disabled={isPending}
        className="mt-3 flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-rose-ink disabled:opacity-40"
      >
        <Sparkles size={12} /> Sugerir metas com o Diretor
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-card border border-line bg-canvas p-3">
      {gerando && (
        <p className="text-[12px] text-muted">Lendo seus Cerebros e o desempenho recente...</p>
      )}

      {erro && <p className="text-[12px] leading-relaxed text-destructive">{erro}</p>}

      {sugestoes && (
        <>
          <p className="text-[13px] leading-relaxed text-ink">{sugestoes.reading}</p>

          <ul className="mt-3 flex flex-col gap-2.5">
            {sugestoes.goals.map((g, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={escolhidas.has(i)}
                    onChange={(e) => {
                      const s = new Set(escolhidas);
                      if (e.target.checked) s.add(i);
                      else s.delete(i);
                      setEscolhidas(s);
                    }}
                    className="mt-1 accent-rose"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] text-ink">{g.title}</span>
                    {g.target !== null && (
                      <span className="ml-1.5 text-[12px] tabular-nums text-faint">
                        alvo {g.target}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                      {g.rationale}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={aceitar}
              disabled={isPending || escolhidas.size === 0}
              className="flex items-center gap-1.5 rounded-control bg-ink px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
            >
              <Check size={12} />
              {isPending ? "Salvando..." : `Adicionar ${escolhidas.size}`}
            </button>
            <button
              onClick={sugerir}
              disabled={isPending}
              className="text-[12px] text-faint transition-colors hover:text-ink disabled:opacity-40"
            >
              Sugerir outras
            </button>
            <button
              onClick={() => {
                setAberto(false);
                setSugestoes(null);
                setErro(null);
              }}
              disabled={isPending}
              className="text-[12px] text-faint transition-colors hover:text-ink disabled:opacity-40"
            >
              Fechar
            </button>
          </div>
        </>
      )}

      {!sugestoes && !gerando && erro && (
        <button
          onClick={() => setAberto(false)}
          className="mt-2 text-[12px] text-faint transition-colors hover:text-ink"
        >
          Fechar
        </button>
      )}
    </div>
  );
}
