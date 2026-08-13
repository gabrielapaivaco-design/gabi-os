"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import type { DirectorTask } from "@/lib/ai/director";

export interface IdeaSuggestion {
  title: string;
  format: string;
  angle: string;
}

export interface ContentAnalysis {
  strengths: string[];
  risks: string[];
  suggestions: string[];
}

export type DirectorResult =
  | { task: "roteiro"; hook: string; script: string }
  | { task: "legenda"; caption: string; cta: string }
  | { task: "ideias"; ideas: IdeaSuggestion[] }
  | { task: "analise"; analysis: ContentAnalysis };

export const TASK_LABEL: Record<DirectorTask, string> = {
  roteiro: "Roteiro",
  legenda: "Legenda",
  ideias: "Outros angulos",
  analise: "Analise",
};

// O texto gerado e o produto do trabalho, entao ele manda na tipografia:
// corpo maior, entrelinha larga e coluna limitada por medida de leitura
// (~68 caracteres), nao pela largura da tela.
const PROSE = "whitespace-pre-wrap text-[15px] leading-[1.75] text-ink";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] uppercase tracking-wide text-faint">{label}</h3>
      {children}
    </section>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Block label={label}>
      <ul className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.7] text-ink">
            <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-rose" />
            {item}
          </li>
        ))}
      </ul>
    </Block>
  );
}

// Placeholder de carregamento: a geracao leva ~10s e uma tela vazia por esse
// tempo parece travamento.
function Loading({ task }: { task: DirectorTask }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] text-muted">
        Escrevendo {TASK_LABEL[task].toLowerCase()} com o contexto dos seus Cerebros...
      </p>
      <div className="flex flex-col gap-3">
        {[100, 92, 96, 74, 88, 60].map((w, i) => (
          <div
            key={i}
            style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }}
            className="h-3 animate-pulse rounded-control bg-line"
          />
        ))}
      </div>
    </div>
  );
}

function Result({ result }: { result: DirectorResult }) {
  if (result.task === "roteiro") {
    return (
      <div className="flex flex-col gap-8">
        <Block label="Hook">
          <p className={`${PROSE} font-medium`}>{result.hook}</p>
        </Block>
        <Block label="Roteiro">
          <p className={PROSE}>{result.script}</p>
        </Block>
      </div>
    );
  }

  if (result.task === "legenda") {
    return (
      <div className="flex flex-col gap-8">
        <Block label="Legenda">
          <p className={PROSE}>{result.caption}</p>
        </Block>
        <Block label="CTA">
          <p className={`${PROSE} font-medium`}>{result.cta}</p>
        </Block>
      </div>
    );
  }

  if (result.task === "ideias") {
    return (
      <ol className="flex flex-col gap-7">
        {result.ideas.map((idea, i) => (
          <li key={i} className="flex gap-4">
            <span className="mt-0.5 w-5 shrink-0 text-[13px] tabular-nums text-faint">{i + 1}</span>
            <div>
              <p className="text-[15px] font-medium leading-snug text-ink">{idea.title}</p>
              {idea.format && (
                <p className="mt-0.5 text-[12px] uppercase tracking-wide text-rose-ink">
                  {idea.format}
                </p>
              )}
              <p className="mt-1.5 text-[15px] leading-[1.7] text-muted">{idea.angle}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Bullets label="Esta forte" items={result.analysis.strengths} />
      <Bullets label="Risco" items={result.analysis.risks} />
      <Bullets label="Mudaria" items={result.analysis.suggestions} />
    </div>
  );
}

// Moldura do estudio: cabecalho, area rolavel e rodape opcional. Extraida
// para que a conversa e as tarefas estruturadas tenham exatamente o mesmo
// enquadramento, sem duplicar as medidas em dois arquivos.
export function StudioShell({
  titulo,
  onClose,
  children,
  footer,
  bodyClassName = "px-8 py-8 sm:px-12 sm:py-10",
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    // Captura: o painel lateral tambem escuta Escape, e sem isso um unico
    // toque fecharia os dois de uma vez.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      <div onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={`Diretor de Conteudo — ${titulo}`}
        className="relative flex max-h-[88vh] w-full max-w-[820px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-lg"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-8 py-5">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-rose" />
            <span className="text-[11px] uppercase tracking-wide text-faint">
              Diretor de Conteudo
            </span>
            <span className="text-[11px] text-line">/</span>
            <h2 className="text-[13px] font-medium text-ink">{titulo}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-faint transition-colors hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>

        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

        {footer}
      </motion.div>
    </div>
  );
}

export function DirectorStudio({
  task,
  result,
  loading,
  error,
  onApply,
  onRetry,
  onClose,
}: {
  task: DirectorTask;
  result: DirectorResult | null;
  loading: boolean;
  error: string | null;
  onApply: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  // Roteiro e legenda preenchem campos do card; angulos e analise sao leitura.
  const canApply = result?.task === "roteiro" || result?.task === "legenda";

  return (
    <StudioShell
      titulo={TASK_LABEL[task]}
      onClose={onClose}
      footer={
        !loading && !error && result ? (
          <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-8 py-4">
            <p className="text-[12px] text-muted">
              {canApply
                ? "Nada e gravado sozinho. Revise no card e clique em Salvar."
                : "Leitura. Nada aqui altera o card."}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-[13px] text-faint transition-colors hover:text-ink"
              >
                {canApply ? "Descartar" : "Fechar"}
              </button>
              {canApply && (
                <button
                  onClick={onApply}
                  className="rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98]"
                >
                  Usar no card
                </button>
              )}
            </div>
          </footer>
        ) : undefined
      }
    >
      <div className="mx-auto max-w-[62ch]">
        {loading && <Loading task={task} />}

        {!loading && error && (
          <div className="flex flex-col items-start gap-4">
            <p className="rounded-control border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] leading-relaxed text-destructive">
              {error}
            </p>
            <button
              onClick={onRetry}
              className="text-[13px] font-medium text-ink transition-opacity hover:opacity-60"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {!loading && !error && result && <Result result={result} />}
      </div>
    </StudioShell>
  );
}
