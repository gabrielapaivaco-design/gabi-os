"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Check, Copy } from "lucide-react";
import { StudioShell } from "./director-studio";
import { CAMPO_LABEL, camposAlterados, type CardEdits } from "@/lib/ai/director/card-edits";

export interface Turn {
  role: "user" | "assistant";
  content: string;
  // Alteracoes que esta resposta propoe aos campos do card. So o Pipeline
  // produz isto; a conversa sobre o cronograma nunca traz.
  edits?: CardEdits | null;
}

export type ChatSend = (
  history: Turn[],
) => Promise<
  { ok: true; reply: string; edits?: CardEdits | null } | { ok: false; error: string }
>;

// Conversa generica com o Diretor. Serve tanto para um card do Pipeline quanto
// para o cronograma do mes — o que muda e o contexto (quem envia), a acao por
// mensagem e a acao final. A moldura, o comportamento do campo e o tratamento
// de erro sao os mesmos nos dois casos.
export function DirectorChat({
  titulo,
  intro,
  atalhos = [],
  onEnviar,
  acaoMensagem,
  onAplicar,
  acaoFinal,
  onClose,
}: {
  titulo: string;
  intro: React.ReactNode;
  atalhos?: string[];
  onEnviar: ChatSend;
  // Aparece sob cada resposta do Diretor (ex.: "Usar como roteiro").
  acaoMensagem?: { label: string; onClick: (texto: string) => void };
  // Aplica no card as alteracoes que o Diretor propos.
  onAplicar?: (edits: CardEdits) => void;
  // Aparece no rodape quando ja existe conversa (ex.: "Refazer o plano").
  acaoFinal?: { label: string; hint: string; onClick: (history: Turn[]) => void };
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, isPending]);

  function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || isPending) return;

    const historico = [...turns, { role: "user" as const, content: limpo }];
    setTurns(historico);
    setRascunho("");
    setErro(null);

    startTransition(async () => {
      const result = await onEnviar(historico.map((t) => ({ role: t.role, content: t.content })));
      if (!result.ok) {
        setErro(result.error);
        // A pergunta volta para o campo: reescrever tudo depois de uma falha de
        // rede seria punir a pessoa por um erro que nao foi dela.
        setTurns(turns);
        setRascunho(limpo);
        return;
      }
      setTurns([...historico, { role: "assistant", content: result.reply, edits: result.edits ?? null }]);
      inputRef.current?.focus();
    });
  }

  return (
    <StudioShell
      titulo={titulo}
      onClose={onClose}
      bodyClassName="px-8 py-7 sm:px-12"
      footer={
        <footer className="shrink-0 border-t border-line px-8 py-4 sm:px-12">
          <div className="mx-auto max-w-[62ch]">
            {acaoFinal && turns.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-[12px] text-muted">{acaoFinal.hint}</p>
                <button
                  onClick={() => acaoFinal.onClick(turns)}
                  disabled={isPending}
                  className="shrink-0 rounded-control bg-ink px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
                >
                  {acaoFinal.label}
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => {
                  // Enter envia, Shift+Enter quebra linha — como qualquer chat.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar(rascunho);
                  }
                }}
                rows={1}
                autoFocus
                placeholder="Diga o que mudar..."
                className="max-h-32 min-h-[38px] flex-1 resize-none rounded-control border border-line bg-canvas px-3 py-2 text-[14px] leading-[1.5] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose"
              />
              <button
                onClick={() => enviar(rascunho)}
                disabled={isPending || !rascunho.trim()}
                aria-label="Enviar"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control bg-ink text-white transition-transform duration-150 ease-premium active:scale-[0.96] disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </footer>
      }
    >
      <div className="mx-auto flex max-w-[62ch] flex-col gap-7">
        {turns.length === 0 && !isPending && (
          <div>
            <div className="text-[15px] leading-[1.7] text-muted">{intro}</div>
            {atalhos.length > 0 && (
              <div className="mt-5 flex flex-col items-start gap-2">
                {atalhos.map((a) => (
                  <button
                    key={a}
                    onClick={() => enviar(a)}
                    className="rounded-control border border-line px-3 py-1.5 text-left text-[13px] text-muted transition-colors hover:border-faint hover:text-ink"
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {turns.map((t, i) => (
          <Bolha key={i} turn={t} acao={acaoMensagem} onAplicar={onAplicar} />
        ))}

        {isPending && (
          <div className="flex items-center gap-1.5" aria-label="Diretor escrevendo">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 140}ms` }}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint"
              />
            ))}
          </div>
        )}

        {erro && (
          <p className="rounded-control border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] leading-relaxed text-destructive">
            {erro}
          </p>
        )}

        <div ref={fimRef} />
      </div>
    </StudioShell>
  );
}

function Bolha({
  turn,
  acao,
  onAplicar,
}: {
  turn: Turn;
  acao?: { label: string; onClick: (texto: string) => void };
  onAplicar?: (edits: CardEdits) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [aplicado, setAplicado] = useState(false);

  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-card bg-canvas px-4 py-2.5 text-[14px] leading-[1.6] text-ink">
          {turn.content}
        </p>
      </div>
    );
  }

  const mudou = turn.edits ? camposAlterados(turn.edits) : [];

  return (
    <div className="group">
      {turn.content && (
        <p className="whitespace-pre-wrap text-[15px] leading-[1.75] text-ink">{turn.content}</p>
      )}

      {/* A proposta de alteracao. Mostra o texto novo ANTES do botao: ela
          precisa poder discordar sem aplicar, e um botao que so diz "aplicar"
          obrigaria a aceitar para ver o que aceitou. */}
      {turn.edits && mudou.length > 0 && onAplicar && (
        <div className="mt-4 rounded-card border border-rose/30 bg-rose-tint/40 p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rose-ink">
            {mudou.length === 1
              ? `Reescreveu: ${CAMPO_LABEL[mudou[0]]}`
              : `Reescreveu ${mudou.length} campos`}
          </p>

          <div className="mt-3 flex flex-col gap-3">
            {mudou.map((campo) => (
              <div key={campo}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
                  {CAMPO_LABEL[campo]}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-[1.65] text-ink">
                  {turn.edits?.[campo]}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (!turn.edits) return;
              onAplicar(turn.edits);
              setAplicado(true);
            }}
            disabled={aplicado}
            className="mt-4 flex items-center gap-1.5 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
          >
            {aplicado ? <Check size={13} /> : null}
            {aplicado
              ? "Aplicado no card"
              : mudou.length === 1
                ? `Aplicar no ${CAMPO_LABEL[mudou[0]]}`
                : "Aplicar tudo no card"}
          </button>
          {aplicado && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              Falta salvar o card para gravar de vez.
            </p>
          )}
        </div>
      )}

      {/* Aparecem no hover para nao competir com o texto, que e o que importa. */}
      <div className="mt-1.5 flex items-center gap-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          onClick={() => {
            navigator.clipboard.writeText(turn.content);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          }}
          className="flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-ink"
        >
          {copiado ? <Check size={11} /> : <Copy size={11} />}
          {copiado ? "copiado" : "Copiar"}
        </button>
        {acao && (
          <button
            onClick={() => acao.onClick(turn.content)}
            className="text-[11px] text-faint transition-colors hover:text-rose-ink"
          >
            {acao.label}
          </button>
        )}
      </div>
    </div>
  );
}
