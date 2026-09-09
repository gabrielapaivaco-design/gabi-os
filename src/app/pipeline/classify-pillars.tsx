"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { resolvePillarColor } from "@/lib/utils/constants";
import type { PilarSugerido } from "@/lib/ai/director/classify";
import type { PillarOption } from "./pipeline-board";
import { aplicarPilaresAction, sugerirPilaresAction } from "./pillar-actions";

// Classificar em bloco os conteudos que ficaram sem pilar.
//
// Um seletor por card e uma tarefa que ninguem cumpre: com os pilares criados,
// 10 dos 12 conteudos continuavam sem classificacao. Aqui o Diretor propoe
// todos de uma vez e ela confere a lista inteira numa tela — trocar um pilar
// continua sendo um clique, mas o caso comum vira zero cliques.

export function ClassifyPillars({
  semPilar,
  pillars,
  aiConfigured,
  titulos,
}: {
  semPilar: number;
  pillars: PillarOption[];
  aiConfigured: boolean;
  // Titulo por id, para a lista de revisao mostrar do que se trata sem que a
  // action precise devolver o texto de volta.
  titulos: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sugestoes, setSugestoes] = useState<PilarSugerido[] | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  if (semPilar === 0 || pillars.length === 0) return null;

  function sugerir() {
    setErro(null);
    startTransition(async () => {
      const r = await sugerirPilaresAction();
      if (!r.ok) return setErro(r.error);
      setSugestoes(r.sugestoes);
      setEscolhas(
        Object.fromEntries(
          r.sugestoes.filter((s) => s.pillarId).map((s) => [s.contentId, s.pillarId as string]),
        ),
      );
    });
  }

  function aplicar() {
    const pares = Object.entries(escolhas)
      .filter(([, pillarId]) => pillarId)
      .map(([contentId, pillarId]) => ({ contentId, pillarId }));
    if (pares.length === 0) return;

    setErro(null);
    startTransition(async () => {
      const r = await aplicarPilaresAction(pares);
      if (!r.ok) return setErro(r.error);
      setSugestoes(null);
      setFeito(
        `${r.gravados} ${r.gravados === 1 ? "conteudo classificado" : "conteudos classificados"}.`,
      );
      router.refresh();
    });
  }

  if (feito) {
    return (
      <p className="mb-4 rounded-control border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink">
        {feito}
      </p>
    );
  }

  const marcados = Object.values(escolhas).filter(Boolean).length;

  return (
    <>
      {!sugestoes && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-control border border-rose/30 bg-rose-tint/40 px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">
            <strong>
              {semPilar} {semPilar === 1 ? "conteudo" : "conteudos"} sem pilar.
            </strong>{" "}
            <span className="text-muted">
              Sem pilar, as Metricas nao conseguem dizer qual assunto deu resultado.
            </span>
          </p>
          {aiConfigured && (
            <button
              onClick={sugerir}
              disabled={isPending}
              className="flex shrink-0 items-center gap-1.5 rounded-control bg-ink px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
            >
              <Sparkles size={12} />
              {isPending ? "Lendo os conteudos..." : "Classificar com o Diretor"}
            </button>
          )}
        </div>
      )}

      {erro && (
        <p className="mb-4 rounded-control border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-destructive">
          {erro}
        </p>
      )}

      {sugestoes && (
        <section className="mb-4 rounded-card border border-line bg-surface p-5">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-[21px] leading-tight text-ink">
              Confira antes de aplicar
            </h2>
            <button
              onClick={() => setSugestoes(null)}
              className="shrink-0 p-1 text-faint transition-colors hover:text-ink"
              aria-label="Descartar sugestoes"
            >
              <X size={15} />
            </button>
          </div>
          <p className="mb-4 max-w-prose text-[12.5px] leading-relaxed text-muted">
            Troque o que estiver errado no seletor da direita. Deixar em{" "}
            <em>sem pilar</em> tira o conteudo desta rodada — melhor sem classificacao do que com a
            errada.
          </p>

          <ul className="flex flex-col">
            {sugestoes.map((s) => (
              <li
                key={s.contentId}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-2.5 first:border-t"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink" title={titulos[s.contentId]}>
                    {titulos[s.contentId] ?? "Conteudo"}
                  </span>
                  {s.porque && (
                    <span className="mt-0.5 block text-[11.5px] text-faint">{s.porque}</span>
                  )}
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: escolhas[s.contentId]
                        ? resolvePillarColor(
                            pillars.find((p) => p.id === escolhas[s.contentId])?.color ?? "gray",
                          )
                        : "transparent",
                      boxShadow: escolhas[s.contentId] ? undefined : "inset 0 0 0 1px currentColor",
                      opacity: escolhas[s.contentId] ? 1 : 0.35,
                    }}
                  />
                  <select
                    value={escolhas[s.contentId] ?? ""}
                    onChange={(e) =>
                      setEscolhas({ ...escolhas, [s.contentId]: e.target.value })
                    }
                    disabled={isPending}
                    className="rounded-control border border-line bg-canvas px-2 py-1 text-[12.5px] text-ink focus:outline-none focus:ring-1 focus:ring-rose"
                  >
                    <option value="">sem pilar</option>
                    {pillars.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={aplicar}
              disabled={isPending || marcados === 0}
              className="rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
            >
              {isPending ? "Gravando..." : `Aplicar em ${marcados}`}
            </button>
            <button
              onClick={() => setSugestoes(null)}
              disabled={isPending}
              className="text-[12.5px] text-faint transition-colors hover:text-ink"
            >
              Descartar
            </button>
          </div>
        </section>
      )}
    </>
  );
}
