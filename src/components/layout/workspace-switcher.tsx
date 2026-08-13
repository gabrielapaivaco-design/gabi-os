"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import type { Workspace } from "@/lib/workspace/service";
import { createWorkspaceAction, switchWorkspaceAction } from "@/app/workspace-actions";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  // Cookie apontando para workspace que nao esta mais na lista (foi excluido,
  // ou o acesso saiu): as paginas leem o cookie direto e viriam vazias, com a
  // sidebar mostrando outra marca como ativa. O middleware nao corrige isso
  // porque so consulta os vinculos quando o cookie esta ausente — e consultar
  // em toda requisicao custava ~50ms por navegacao. Entao a correcao acontece
  // aqui, uma vez, quando a inconsistencia realmente aparece.
  const orfao = workspaces.length > 0 && !workspaces.some((w) => w.id === activeWorkspaceId);
  useEffect(() => {
    if (!orfao || !active) return;
    startTransition(async () => {
      const result = await switchWorkspaceAction(active.id);
      if (result.ok) router.refresh();
    });
  }, [orfao, active, router]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  function close() {
    setOpen(false);
    setCreating(false);
    setNewName("");
    setError(null);
  }

  function handleSwitch(id: string) {
    if (id === activeWorkspaceId) return close();
    setError(null);
    startTransition(async () => {
      const result = await switchWorkspaceAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      // O cookie mudou no servidor; sem refresh a arvore atual continuaria
      // mostrando os dados do workspace anterior.
      router.refresh();
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createWorkspaceAction(newName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  // Conta sem nenhum workspace precisa poder criar o primeiro daqui: e o unico
  // lugar da interface que cria marca. Sem isso, quem entra numa conta nova
  // fica preso num app inteiro sem dados e sem saida.
  const vazio = workspaces.length === 0;

  return (
    <div ref={rootRef} className="relative mx-1">
      <button
        onClick={() => {
          if (open) return close();
          setOpen(true);
          if (vazio) setCreating(true);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-control border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-faint"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-medium ${
            vazio ? "bg-canvas text-faint" : "bg-rose-tint text-rose-ink"
          }`}
        >
          {vazio ? <Plus size={12} /> : initials(active?.name ?? "")}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-[13px] ${
            vazio ? "text-muted" : "font-medium text-ink"
          }`}
        >
          {vazio ? "Criar workspace" : (active?.name ?? "Workspace")}
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-faint" />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-lg"
        >
          <ul role="listbox" className="flex flex-col">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  role="option"
                  aria-selected={w.id === activeWorkspaceId}
                  onClick={() => handleSwitch(w.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-ink transition-colors hover:bg-canvas disabled:opacity-40"
                >
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {w.id === activeWorkspaceId && (
                    <Check size={13} className="shrink-0 text-rose" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className={vazio ? "" : "mt-1 border-t border-line pt-1"}>
            {creating ? (
              <form onSubmit={handleCreate} className="px-2.5 py-1.5">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome da marca"
                  autoFocus
                  disabled={isPending}
                  className="w-full rounded-control border border-line bg-canvas px-2 py-1.5 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose disabled:opacity-40"
                />
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isPending || !newName.trim()}
                    className="text-[12px] font-medium text-rose-ink transition-opacity hover:opacity-70 disabled:opacity-40"
                  >
                    {isPending ? "Criando..." : "Criar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                      setError(null);
                    }}
                    className="text-[12px] text-faint transition-colors hover:text-ink"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                <Plus size={13} className="shrink-0" /> Novo workspace
              </button>
            )}
          </div>

          {error && (
            <p className="mx-2.5 mb-1.5 mt-1 text-[11px] leading-relaxed text-destructive">
              {error}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
