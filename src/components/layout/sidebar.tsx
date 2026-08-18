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
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-line bg-canvas px-3 py-5">
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
                "flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] transition-colors duration-150 ease-premium",
                active
                  ? "border border-line bg-surface font-medium text-ink"
                  : "text-muted hover:text-ink",
              )}
            >
              <Icon size={15} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-rose" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 pt-6">
        <Link
          href="/cerebros"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-faint transition-colors hover:text-ink"
        >
          <Brain size={14} strokeWidth={1.8} /> Cerebros
        </Link>
        <Link
          href="/conciliacao"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-faint transition-colors hover:text-ink"
        >
          <Link2 size={14} strokeWidth={1.8} /> Conciliacao
        </Link>
        <Link
          href="/historico"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-faint transition-colors hover:text-ink"
        >
          <History size={14} strokeWidth={1.8} /> Historico da IA
        </Link>
        <Link
          href="/config"
          className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-faint transition-colors hover:text-ink"
        >
          <Settings size={14} strokeWidth={1.8} /> Configuracoes
        </Link>

        <div className="mt-3 border-t border-line pt-3">
          <p className="truncate px-3 text-[11px] text-faint" title={userEmail}>
            {userEmail}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-[12px] text-faint transition-colors hover:text-ink"
            >
              <LogOut size={14} strokeWidth={1.8} /> Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
