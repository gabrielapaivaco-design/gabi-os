"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Sparkles, Trash2 } from "lucide-react";
import type { MomentDayGroup } from "@/lib/moments/group-by-day";
import { createContentFromMomentAction } from "@/app/pipeline/actions";
import { deleteMomentAction } from "./actions";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function listTitles(titles: string[]): string {
  if (titles.length === 1) return `"${titles[0]}"`;
  return titles.map((t) => `"${t}"`).join(", ");
}

export function MomentFeed({
  groups,
  linkedTitles,
}: {
  groups: MomentDayGroup[];
  linkedTitles: Record<string, string[]>;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  function handleTransform(momentId: string, body: string) {
    startTransition(() => {
      createContentFromMomentAction(momentId, body);
    });
  }

  function handleDelete(momentId: string) {
    setError(null);
    setDeletingId(momentId);
    startTransition(async () => {
      const result = await deleteMomentAction(momentId);
      setDeletingId(null);
      if (!result.ok) {
        setError({ id: momentId, message: result.error });
        return;
      }
      // So fecha a confirmacao quando a exclusao deu certo — se falhou, a
      // pessoa continua vendo o estado em que estava.
      setConfirmingId(null);
    });
  }

  if (groups.length === 0) {
    return (
      <p className="text-[13px] text-muted">Nenhum Momento ainda. Registre o primeiro acima.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-faint first-letter:uppercase">
            {group.label}
          </h2>
          <div className="flex flex-col gap-2">
            {group.moments.map((m, i) => {
              const titles = linkedTitles[m.id] ?? [];
              const isLinked = titles.length > 0;
              const isConfirming = confirmingId === m.id;
              const isDeleting = deletingId === m.id;
              const rowError = error?.id === m.id ? error.message : null;

              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
                  className={`rounded-card border bg-surface p-4 transition-colors ${
                    isConfirming ? "border-destructive/40" : "border-line"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[11px] text-faint">{formatTime(m.created_at)}</div>
                    <div className="flex shrink-0 items-center gap-3">
                      {isLinked ? (
                        <span className="flex items-center gap-1 text-[11px] text-faint">
                          <Sparkles size={11} /> Ja e conteudo
                        </span>
                      ) : (
                        <button
                          onClick={() => handleTransform(m.id, m.body)}
                          disabled={isPending}
                          className="text-[11px] font-medium text-rose-ink transition-opacity hover:opacity-70 disabled:opacity-40"
                        >
                          Transformar em Conteudo
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setError(null);
                          setConfirmingId(isConfirming ? null : m.id);
                        }}
                        disabled={isPending}
                        aria-label={`Excluir Momento das ${formatTime(m.created_at)}`}
                        title="Excluir Momento"
                        className={`transition-colors disabled:opacity-40 ${
                          isConfirming ? "text-destructive" : "text-faint hover:text-destructive"
                        }`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {m.body}
                  </p>

                  {isConfirming && (
                    <div className="mt-3 border-t border-line pt-3">
                      {isLinked ? (
                        <p className="text-[12px] leading-relaxed text-ink">
                          Esse Momento ja virou {listTitles(titles)} no Pipeline. O conteudo
                          continua la, mas perde o vinculo com a origem.
                        </p>
                      ) : (
                        <p className="text-[12px] leading-relaxed text-muted">
                          O Momento sai do banco de vez. Nao da para desfazer.
                        </p>
                      )}

                      {rowError && (
                        <p className="mt-2 text-[12px] text-destructive">{rowError}</p>
                      )}

                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => handleDelete(m.id)}
                          disabled={isPending}
                          className="text-[12px] font-medium text-destructive transition-opacity hover:opacity-70 disabled:opacity-40"
                        >
                          {isDeleting ? "Excluindo..." : "Excluir mesmo assim"}
                        </button>
                        <button
                          onClick={() => {
                            setError(null);
                            setConfirmingId(null);
                          }}
                          disabled={isPending}
                          className="text-[12px] text-faint transition-colors hover:text-ink disabled:opacity-40"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Erro depois de fechar a confirmacao (ex.: falha de rede) */}
                  {rowError && !isConfirming && (
                    <p className="mt-2 text-[12px] text-destructive">{rowError}</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
