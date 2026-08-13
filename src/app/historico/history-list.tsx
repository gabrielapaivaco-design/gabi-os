"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Trash2 } from "lucide-react";
// Importa de history-view, nao de history: este e um client component, e
// history puxa next/headers pela cadeia do getWorkspaceId.
import { KIND_LABEL, summarize, type Generation } from "@/lib/ai/history-view";
import { clearGenerationsAction, deleteGenerationAction } from "./actions";

function quando(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function HistoryList({ generations }: { generations: Generation[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<{ id: string | null; msg: string } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [limpando, setLimpando] = useState(false);
  const [digitado, setDigitado] = useState("");

  function excluir(id: string) {
    setErro(null);
    startTransition(async () => {
      const r = await deleteGenerationAction(id);
      if (!r.ok) return setErro({ id, msg: r.error });
      router.refresh();
    });
  }

  function limparTudo() {
    setErro(null);
    startTransition(async () => {
      const r = await clearGenerationsAction(digitado);
      if (!r.ok) return setErro({ id: null, msg: r.error });
      setLimpando(false);
      setDigitado("");
      router.refresh();
    });
  }

  if (generations.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Nada gerado ainda neste workspace. Abra um card no Pipeline e use o Diretor de Conteudo.
      </p>
    );
  }

  const totalTokens = generations.reduce(
    (soma, g) => soma + (g.inputTokens ?? 0) + (g.outputTokens ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[12px] text-muted">
          {generations.length} {generations.length === 1 ? "geracao" : "geracoes"} ·{" "}
          {totalTokens.toLocaleString("pt-BR")} tokens no total
        </p>
        {!limpando && (
          <button
            onClick={() => setLimpando(true)}
            className="text-[12px] text-faint transition-colors hover:text-destructive"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {limpando && (
        <div className="rounded-card border border-destructive/30 bg-surface p-4">
          <p className="text-[13px] leading-relaxed text-ink">
            Isso apaga as {generations.length} geracoes deste workspace. O texto ja aplicado nos
            cards continua onde esta — o que se perde e o registro de custo e o que a IA
            respondeu.
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] text-muted">
              Digite <strong className="text-ink">limpar</strong> para confirmar:
            </span>
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              autoFocus
              disabled={isPending}
              className="w-full max-w-[200px] rounded-control border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-rose"
            />
          </label>
          {erro?.id === null && <p className="mt-2 text-[12px] text-destructive">{erro.msg}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={limparTudo}
              disabled={isPending || digitado.trim().toLowerCase() !== "limpar"}
              className="rounded-control bg-destructive px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
            >
              {isPending ? "Limpando..." : "Limpar historico"}
            </button>
            <button
              onClick={() => {
                setLimpando(false);
                setDigitado("");
                setErro(null);
              }}
              disabled={isPending}
              className="text-[12px] text-faint transition-colors hover:text-ink disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {generations.map((g, i) => {
          const aberto = expandido === g.id;
          const resumo = summarize(g);

          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.015 }}
              className={`rounded-card border bg-surface p-4 ${
                g.error ? "border-destructive/30" : "border-line"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-medium text-ink">
                    {KIND_LABEL[g.kind] ?? g.kind}
                  </span>
                  {g.contentTitle && (
                    <span className="truncate text-[12px] text-muted">· {g.contentTitle}</span>
                  )}
                  {g.error && (
                    <span className="flex items-center gap-1 text-[11px] text-destructive">
                      <AlertCircle size={11} /> falhou
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[11px] tabular-nums text-faint">{quando(g.createdAt)}</span>
                  <button
                    onClick={() => excluir(g.id)}
                    disabled={isPending}
                    aria-label="Excluir este registro"
                    className="text-faint transition-colors hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {resumo && (
                <p
                  onClick={() => setExpandido(aberto ? null : g.id)}
                  className={`mt-1.5 cursor-pointer whitespace-pre-wrap text-[13px] leading-relaxed ${
                    g.error ? "text-destructive" : "text-muted"
                  } ${aberto ? "" : "line-clamp-2"}`}
                >
                  {resumo}
                </p>
              )}

              <p className="mt-2 text-[11px] tabular-nums text-faint">
                {g.model}
                {g.inputTokens !== null &&
                  ` · ${g.inputTokens.toLocaleString("pt-BR")} entrada / ${(g.outputTokens ?? 0).toLocaleString("pt-BR")} saida`}
              </p>

              {erro?.id === g.id && (
                <p className="mt-2 text-[12px] text-destructive">{erro.msg}</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
