"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { deleteWorkspaceAction, renameWorkspaceAction } from "@/app/workspace-actions";
import type { WorkspaceContents } from "@/lib/workspace/service";

const inputClass =
  "w-full rounded-control border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose";

function resumo(c: WorkspaceContents): string[] {
  const partes: string[] = [];
  if (c.moments) partes.push(`${c.moments} ${c.moments === 1 ? "Momento" : "Momentos"}`);
  if (c.contents) partes.push(`${c.contents} ${c.contents === 1 ? "Conteudo" : "Conteudos"}`);
  if (c.filledBrains)
    partes.push(`${c.filledBrains} ${c.filledBrains === 1 ? "Cerebro" : "Cerebros"} preenchidos`);
  if (c.goals) partes.push(`${c.goals} ${c.goals === 1 ? "meta" : "metas"}`);
  if (c.aiGenerations)
    partes.push(`${c.aiGenerations} ${c.aiGenerations === 1 ? "geracao" : "geracoes"} de IA`);
  return partes;
}

export function WorkspaceAdmin({
  workspaceId,
  name,
  contents,
  isOnly,
}: {
  workspaceId: string;
  name: string;
  contents: WorkspaceContents;
  isOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState(name);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const [confirmando, setConfirmando] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const perdas = resumo(contents);

  function renomear(e: React.FormEvent) {
    e.preventDefault();
    setErroNome(null);
    startTransition(async () => {
      const result = await renameWorkspaceAction(workspaceId, novoNome);
      if (!result.ok) {
        setErroNome(result.error);
        return;
      }
      setEditando(false);
      setSalvo(true);
      router.refresh();
    });
  }

  function excluir() {
    setErroExcluir(null);
    startTransition(async () => {
      const result = await deleteWorkspaceAction(workspaceId, digitado);
      if (!result.ok) {
        setErroExcluir(result.error);
        return;
      }
      // O workspace atual deixou de existir; a action ja moveu o cookie.
      router.push("/");
      router.refresh();
    });
  }

  return (
    <>
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-medium text-ink">Nome da marca</h2>
        <p className="mb-3 text-[12px] text-muted">
          O identificador e gerado a partir do nome, entao renomear tambem o atualiza.
        </p>

        {editando ? (
          <form onSubmit={renomear} className="flex flex-col gap-2">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              autoFocus
              disabled={isPending}
              className={inputClass}
            />
            {erroNome && <p className="text-[12px] text-destructive">{erroNome}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending || !novoNome.trim() || novoNome.trim() === name}
                className="rounded-control bg-ink px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
              >
                {isPending ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setNovoNome(name);
                  setErroNome(null);
                }}
                className="text-[12px] text-faint transition-colors hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-ink">{name}</span>
            <button
              onClick={() => {
                setEditando(true);
                setSalvo(false);
              }}
              className="flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-ink"
            >
              <Pencil size={12} /> Renomear
            </button>
            {salvo && (
              <span className="flex items-center gap-1 text-[12px] text-rose-ink">
                <Check size={12} /> salvo
              </span>
            )}
          </div>
        )}
      </section>

      <section className="rounded-card border border-destructive/30 bg-surface p-5">
        <h2 className="mb-1 text-sm font-medium text-ink">Excluir esta marca</h2>
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          Diferente de um card do Pipeline, que e apenas arquivado, isto apaga do banco de vez e
          leva tudo junto. Nao ha desfazer.
        </p>

        {perdas.length > 0 ? (
          <div className="mb-3 rounded-control border border-line bg-canvas px-3 py-2.5">
            <span className="text-[11px] uppercase tracking-wide text-faint">Voce vai perder</span>
            <ul className="mt-1.5 flex flex-col gap-1">
              {perdas.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[13px] text-ink">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mb-3 text-[12px] text-muted">Esta marca ainda nao tem conteudo nenhum.</p>
        )}

        {isOnly ? (
          <p className="text-[12px] leading-relaxed text-muted">
            Este e o seu unico workspace, entao nao da para exclui-lo — a conta ficaria sem
            nenhum lugar para trabalhar. Crie outra marca antes.
          </p>
        ) : confirmando ? (
          <div className="flex flex-col gap-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-ink">
                Digite <strong>{name}</strong> para confirmar:
              </span>
              <input
                value={digitado}
                onChange={(e) => setDigitado(e.target.value)}
                autoFocus
                disabled={isPending}
                className={inputClass}
              />
            </label>
            {erroExcluir && <p className="text-[12px] text-destructive">{erroExcluir}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={excluir}
                disabled={isPending || digitado.trim() !== name}
                className="rounded-control bg-destructive px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
              >
                {isPending ? "Excluindo..." : "Excluir permanentemente"}
              </button>
              <button
                onClick={() => {
                  setConfirmando(false);
                  setDigitado("");
                  setErroExcluir(null);
                }}
                disabled={isPending}
                className="text-[12px] text-faint transition-colors hover:text-ink disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            className="text-[13px] font-medium text-destructive transition-opacity hover:opacity-70"
          >
            Excluir {name}
          </button>
        )}
      </section>
    </>
  );
}
