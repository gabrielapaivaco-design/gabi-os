"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Sparkles, X } from "lucide-react";
import type { Objective } from "@/types/db";
import type { DirectorTask } from "@/lib/ai/director";
import { archiveContentAction, updateContentAction } from "./actions";
import { chatWithDirectorAction, runDirectorAction } from "./ai-actions";
import { scheduleContentAction } from "@/app/calendario/actions";
import type { ContentCardData, PillarOption } from "./pipeline-board";
import { DirectorStudio, TASK_LABEL, type DirectorResult } from "./director-studio";
import { DirectorChat } from "./director-chat";

const DIRECTOR_TASKS: DirectorTask[] = ["roteiro", "legenda", "ideias", "analise"];

// Verbos nos botoes (acao), substantivos no estudio (o que voce esta lendo).
const BUTTON_LABEL: Record<DirectorTask, string> = {
  roteiro: "Roteiro",
  legenda: "Legenda",
  ideias: "Outros angulos",
  analise: "Analisar",
};

const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: "autoridade", label: "Autoridade" },
  { value: "venda", label: "Venda" },
  { value: "conexao", label: "Conexao" },
  { value: "crescimento", label: "Crescimento" },
];

const inputClass =
  "w-full rounded-control border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose";

// Mesma moldura, tipografia de leitura: usado nos campos que recebem o texto
// gerado (hook, roteiro, legenda, CTA).
const proseInputClass = `${inputClass} resize-y px-3 py-2.5 leading-[1.7]`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  );
}

export function CardPanel({
  card,
  pillars,
  aiConfigured = false,
  onClose,
  onSaved,
  onDeleted,
}: {
  card: ContentCardData;
  pillars: PillarOption[];
  aiConfigured?: boolean;
  onClose: () => void;
  onSaved: (patch: Partial<ContentCardData>) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [format, setFormat] = useState(card.format ?? "");
  const [objective, setObjective] = useState<Objective | "">(card.objective ?? "");
  const [pillarId, setPillarId] = useState(card.pillarId ?? "");
  const [hook, setHook] = useState(card.hook ?? "");
  const [script, setScript] = useState(card.script ?? "");
  const [caption, setCaption] = useState(card.caption ?? "");
  const [cta, setCta] = useState(card.cta ?? "");
  const [plannedDay, setPlannedDay] = useState(card.plannedDayKey ?? "");

  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  // O Diretor abre em tela cheia: o texto gerado e o produto do trabalho e nao
  // cabe numa caixa lateral. `studioTask` nao-nulo significa estudio aberto.
  const [studioTask, setStudioTask] = useState<DirectorTask | null>(null);
  const [studioResult, setStudioResult] = useState<DirectorResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Sinaliza que ha texto gerado ainda nao gravado: a IA preenche os campos,
  // mas quem decide o que vai para o banco continua sendo a usuaria.
  const [aiDraft, setAiDraft] = useState(false);
  const [conversando, setConversando] = useState(false);

  function runTask(task: DirectorTask) {
    setStudioTask(task);
    setStudioResult(null);
    setAiError(null);
    setGenerating(true);

    startTransition(async () => {
      const result = await runDirectorAction(card.id, task);
      setGenerating(false);

      if (!result.ok) {
        setAiError(result.error);
        return;
      }

      const output = result.output;
      if (output.task === "roteiro") {
        setStudioResult({ task: "roteiro", hook: output.data.hook, script: output.data.script });
      } else if (output.task === "legenda") {
        setStudioResult({ task: "legenda", caption: output.data.caption, cta: output.data.cta });
      } else if (output.task === "ideias") {
        setStudioResult({ task: "ideias", ideas: output.data.ideas });
      } else {
        setStudioResult({ task: "analise", analysis: output.data });
      }
    });
  }

  // Aplicar so acontece por decisao explicita — fechar o estudio nao escreve
  // nada nos campos. O resultado fica guardado para poder ser reaberto.
  function applyStudioResult() {
    if (studioResult?.task === "roteiro") {
      setHook(studioResult.hook);
      setScript(studioResult.script);
      setAiDraft(true);
    } else if (studioResult?.task === "legenda") {
      setCaption(studioResult.caption);
      setCta(studioResult.cta);
      setAiDraft(true);
    }
    setStudioTask(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Com o estudio aberto, Escape fecha so o estudio (ele trata o evento em
      // fase de captura); o painel nao pode fechar junto.
      if (e.key === "Escape" && !studioTask && !conversando) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, studioTask, conversando]);

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("O titulo nao pode ficar vazio.");
      return;
    }
    setError(null);

    const patch: Partial<ContentCardData> = {
      title: trimmedTitle,
      format: format.trim() || null,
      objective: (objective || null) as Objective | null,
      pillarId: pillarId || null,
      hook: hook.trim() || null,
      script: script.trim() || null,
      caption: caption.trim() || null,
      cta: cta.trim() || null,
      plannedDayKey: plannedDay || null,
    };

    startTransition(async () => {
      const result = await updateContentAction(card.id, {
        title: patch.title,
        format: patch.format,
        objective: patch.objective,
        pillar_id: patch.pillarId,
        hook: patch.hook,
        script: patch.script,
        caption: patch.caption,
        cta: patch.cta,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // planned_at passa pela mesma action do Calendario, que ja converte a
      // chave do dia para timestamptz e emite conteudo.agendado.
      if ((card.plannedDayKey ?? "") !== plannedDay) {
        const scheduled = await scheduleContentAction(card.id, plannedDay || null);
        if (!scheduled.ok) {
          setError(scheduled.error);
          return;
        }
      }

      onSaved(patch);
      onClose();
    });
  }

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await archiveContentAction(card.id);
      if (!result.ok) {
        setError(result.error);
        setConfirmingDelete(false);
        return;
      }
      onDeleted();
    });
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-ink/20" />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-line bg-surface p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Editar conteudo</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-faint transition-colors hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <div className="rounded-card border border-line bg-canvas p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles size={12} className="text-rose" />
              <span className="text-[11px] uppercase tracking-wide text-faint">
                Diretor de Conteudo
              </span>
            </div>

            {aiConfigured ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {/* Conversar vem primeiro e destacado: as outras quatro sao de
                      mao unica, esta e a que deixa corrigir o Diretor. */}
                  <button
                    onClick={() => setConversando(true)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-control border border-rose/40 bg-rose-tint px-2.5 py-1 text-[12px] font-medium text-rose-ink transition-colors hover:border-rose disabled:opacity-40"
                  >
                    <MessageCircle size={12} /> Conversar
                  </button>
                  {DIRECTOR_TASKS.map((task) => (
                    <button
                      key={task}
                      onClick={() => runTask(task)}
                      disabled={isPending}
                      className="rounded-control border border-line bg-surface px-2.5 py-1 text-[12px] text-ink transition-colors hover:border-faint disabled:opacity-40"
                    >
                      {BUTTON_LABEL[task]}
                    </button>
                  ))}
                </div>

                {/* O resultado sobrevive ao fechar o estudio, para nao obrigar
                    a gerar de novo so para reler. */}
                {studioResult && !studioTask && (
                  <button
                    onClick={() => setStudioTask(studioResult.task)}
                    className="mt-2 text-[11px] font-medium text-rose-ink transition-opacity hover:opacity-70"
                  >
                    Reabrir {TASK_LABEL[studioResult.task].toLowerCase()}
                  </button>
                )}

                {aiDraft && (
                  <p className="mt-2 text-[11px] text-muted">
                    Texto gerado aplicado nos campos abaixo. Revise e clique em Salvar.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12px] text-muted">
                Defina <code>ANTHROPIC_API_KEY</code> em <code>.env.local</code> e reinicie o
                servidor para gerar roteiros, legendas e analises.
              </p>
            )}

            {/* Com o estudio aberto o erro aparece la, com espaco e um botao de
                tentar de novo; aqui fica so o rastro para quem ja fechou. */}
            {aiError && !studioTask && (
              <p className="mt-2 rounded-control border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive">
                {aiError}
              </p>
            )}
          </div>

          <Field label="Titulo">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Formato">
            <input
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="Reels, Carrossel, Stories..."
              className={inputClass}
            />
          </Field>

          <Field label="Objetivo">
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value as Objective | "")}
              className={inputClass}
            >
              <option value="">Sem objetivo</option>
              {OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pilar">
            <select value={pillarId} onChange={(e) => setPillarId(e.target.value)} className={inputClass}>
              <option value="">Sem pilar</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Planejado para">
            <input
              type="date"
              value={plannedDay}
              onChange={(e) => setPlannedDay(e.target.value)}
              className={inputClass}
            />
          </Field>

          {/* Campos de texto longo respiram mais que os de metadado: e neles
              que o roteiro gerado aterrissa. */}
          <Field label="Hook">
            <textarea
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              rows={3}
              className={proseInputClass}
            />
          </Field>
          <Field label="Roteiro">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={10}
              className={proseInputClass}
            />
          </Field>
          <Field label="Legenda">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              className={proseInputClass}
            />
          </Field>
          <Field label="CTA">
            <textarea
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              rows={2}
              className={proseInputClass}
            />
          </Field>

          {card.momentExcerpt && (
            <div className="rounded-card border border-line bg-canvas p-3 text-[12px] text-muted">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-faint">
                Momento de origem
              </span>
              {card.momentExcerpt}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-control border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <button
            onClick={handleDeleteClick}
            disabled={isPending}
            className={`text-[13px] transition-colors disabled:opacity-40 ${
              confirmingDelete ? "font-medium text-destructive" : "text-faint hover:text-destructive"
            }`}
          >
            {confirmingDelete ? "Confirmar exclusao?" : "Excluir"}
          </button>
          <div className="flex items-center gap-2">
            {confirmingDelete && (
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-[13px] text-faint hover:text-ink"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </motion.div>

      {conversando && (
        <DirectorChat
          titulo="Conversa"
          intro={
            <>
              Conversando sobre <span className="text-ink">{title || card.title}</span>. Ele ja tem
              o contexto dos seus Cerebros, do pilar e do Momento que originou esse conteudo.
            </>
          }
          atalhos={[
            "Esse conteudo ficou literal demais. Como deixar mais leve?",
            "Me da tres jeitos diferentes de abrir isso.",
            "O que voce cortaria daqui, e por que?",
          ]}
          onEnviar={(history) => chatWithDirectorAction(card.id, history)}
          acaoMensagem={{
            label: "Usar como roteiro",
            onClick: (texto) => {
              setScript(texto);
              setAiDraft(true);
              setConversando(false);
            },
          }}
          onClose={() => setConversando(false)}
        />
      )}

      {studioTask && (
        <DirectorStudio
          task={studioTask}
          result={studioResult}
          loading={generating}
          error={aiError}
          onApply={applyStudioResult}
          onRetry={() => runTask(studioTask)}
          onClose={() => setStudioTask(null)}
        />
      )}
    </>
  );
}
