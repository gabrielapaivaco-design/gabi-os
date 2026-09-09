"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, History, Link2, LogOut, Settings } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { signOutAction } from "@/app/login/actions";
import type { Workspace } from "@/lib/workspace/service";
import { cn } from "@/lib/utils/cn";

// Sidebar minimalista (Linear/Arc). Estado ativo usa o rose de identidade, discreto.
export function Sidebar({
  workspaces,
  activeWorkspaceId,
  userEmail,
}: {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    // Escura, e essa e a decisao mais pesada do layout. Antes ela era do mesmo
    // creme do fundo: nao separava de nada e a tela inteira ficava lavada, sem
    // nenhuma massa escura em lugar nenhum. Uma faixa escura de 228px da coluna
    // vertebral a pagina e faz o papel quente do lado direito parecer papel, em
    // vez de parecer a ausencia de cor.
    <aside className="flex w-[228px] shrink-0 flex-col bg-shell px-4 py-6 text-shell-muted">
      {/* Marca ativa no topo: e o primeiro dado que a pessoa precisa ver, porque
          define o que todas as telas abaixo estao mostrando. */}
      <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />

      <nav className="mt-6 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-control px-3.5 py-2.5 text-[14px] transition-colors duration-150 ease-premium",
                active
                  ? "bg-white/[0.07] font-medium text-shell-ink"
                  : "text-shell-muted hover:text-shell-ink",
              )}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2.2 : 1.8}
                className={active ? "text-shell-rose" : ""}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 pt-6">
        <Link
          href="/cerebros"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-shell-faint transition-colors hover:text-shell-ink"
        >
          <Brain size={14} strokeWidth={1.8} /> Cerebros
        </Link>
        <Link
          href="/conciliacao"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-shell-faint transition-colors hover:text-shell-ink"
        >
          <Link2 size={14} strokeWidth={1.8} /> Conciliacao
        </Link>
        <Link
          href="/historico"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-shell-faint transition-colors hover:text-shell-ink"
        >
          <History size={14} strokeWidth={1.8} /> Historico da IA
        </Link>
        <Link
          href="/config"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-shell-faint transition-colors hover:text-shell-ink"
        >
          <Settings size={14} strokeWidth={1.8} /> Configuracoes
        </Link>

        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="truncate px-3 text-[11px] text-shell-faint" title={userEmail}>
            {userEmail}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-shell-faint transition-colors hover:text-shell-ink"
            >
              <LogOut size={14} strokeWidth={1.8} /> Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
