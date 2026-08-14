// Tela Hoje — dashboard com dados reais quando existem; onboarding honesto
// enquanto nao ha nada registrado. Nunca inventa "inteligencia": so agrega
// dados reais de Momentos, Pipeline e Objetivos.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace/current";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "@/lib/utils/constants";
import type { ContentStatus } from "@/types/db";
import { GoalsWidget, type Goal } from "./goals-widget";
import { isAiConfigured } from "@/lib/ai";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function emptyStatusCounts(): Record<ContentStatus, number> {
  const counts = {} as Record<ContentStatus, number>;
  for (const status of STATUS_ORDER) counts[status] = 0;
  return counts;
}

interface ActionItem {
  id: string;
  title: string;
}

interface HojeData {
  totalMoments: number;
  unconvertedMoments: number;
  statusCounts: Record<ContentStatus, number>;
  toRecord: ActionItem[];
  toEdit: ActionItem[];
  toPost: ActionItem[];
  goals: Goal[];
  unavailable: boolean;
}

function currentQuarter(): string {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

async function loadHoje(): Promise<HojeData> {
  try {
    const db = createClient();
    const workspaceId = getWorkspaceId();
    const [momentsRes, linkedRes, contentsRes, goalsRes] = await Promise.all([
      db
        .from("moments")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      db
        .from("contents")
        .select("moment_id")
        .eq("workspace_id", workspaceId)
        .eq("archived", false)
        .not("moment_id", "is", null),
      db
        .from("contents")
        .select("id, title, status")
        .eq("workspace_id", workspaceId)
        .eq("archived", false),
      db
        .from("goals")
        .select("id, title, target, progress, quarter, metric_key")
        .eq("workspace_id", workspaceId)
        .eq("quarter", currentQuarter())
        .order("created_at", { ascending: true }),
    ]);

    if (momentsRes.error) throw momentsRes.error;
    if (linkedRes.error) throw linkedRes.error;
    if (contentsRes.error) throw contentsRes.error;
    if (goalsRes.error) throw goalsRes.error;

    const totalMoments = momentsRes.count ?? 0;
    const linkedCount = new Set(
      (linkedRes.data ?? []).map((r: { moment_id: string }) => r.moment_id),
    ).size;

    const statusCounts = emptyStatusCounts();
    const contents = (contentsRes.data ?? []) as { id: string; title: string; status: ContentStatus }[];
    for (const row of contents) statusCounts[row.status] += 1;

    return {
      totalMoments,
      unconvertedMoments: Math.max(totalMoments - linkedCount, 0),
      statusCounts,
      toRecord: contents.filter((c) => c.status === "gravar"),
      toEdit: contents.filter((c) => c.status === "editar"),
      toPost: contents.filter((c) => c.status === "agendar"),
      goals: (goalsRes.data ?? []) as Goal[],
      unavailable: false,
    };
  } catch {
    return {
      totalMoments: 0,
      unconvertedMoments: 0,
      statusCounts: emptyStatusCounts(),
      toRecord: [],
      toEdit: [],
      toPost: [],
      goals: [],
      unavailable: true,
    };
  }
}

function ActionQueue({ title, items }: { title: string; items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-faint">
        {title} <span className="text-faint">({items.length})</span>
      </h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/pipeline?open=${item.id}`}
              className="block text-[13px] text-ink transition-colors hover:text-rose-ink"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function HojePage() {
  const { totalMoments, unconvertedMoments, statusCounts, toRecord, toEdit, toPost, goals, unavailable } =
    await loadHoje();
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  }).format(new Date());

  const activeContents = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const hasData = !unavailable && totalMoments > 0;
  const hasActionItems = toRecord.length > 0 || toEdit.length > 0 || toPost.length > 0;

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{saudacao()}, Gabriela</h1>
          <p className="text-[13px] text-muted mt-0.5 first-letter:uppercase">{hoje}</p>
        </div>
        <Link
          href="/momentos"
          className="rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98]"
        >
          + Momento
        </Link>
      </header>

      <section className="rounded-card border border-line bg-surface p-5 mb-5">
        <div className="text-[12px] text-faint mb-2">Briefing do diretor</div>
        {unavailable ? (
          <p className="text-sm leading-relaxed text-ink">
            Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
            migrations foram executadas.
          </p>
        ) : hasData ? (
          <p className="text-sm leading-relaxed text-ink">
            Voce tem {totalMoments} {totalMoments === 1 ? "Momento registrado" : "Momentos registrados"}
            {unconvertedMoments > 0 && <> — {unconvertedMoments} ainda sem virar conteudo</>}.{" "}
            {activeContents > 0 && (
              <>
                {activeContents} {activeContents === 1 ? "conteudo em andamento" : "conteudos em andamento"} no Pipeline.
              </>
            )}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-ink">
            Bem-vinda ao seu segundo cerebro. Ainda estou coletando seus primeiros
            dados. Comece registrando um Momento sempre que algo interessante
            acontecer na sua vida &mdash; e eu transformo em conteudo a partir dai.
          </p>
        )}
      </section>

      {!unavailable && (
        <div className="mb-5">
          <GoalsWidget goals={goals} quarter={currentQuarter()} aiConfigured={isAiConfigured()} />
        </div>
      )}

      {hasActionItems && (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ActionQueue title="Gravar" items={toRecord} />
          <ActionQueue title="Editar" items={toEdit} />
          <ActionQueue title="Postar" items={toPost} />
        </div>
      )}

      <div className="flex flex-wrap gap-6 pt-4 border-t border-line text-[12px] text-muted">
        {!unavailable && activeContents > 0 ? (
          STATUS_ORDER.filter((status) => statusCounts[status] > 0).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[status] }}
              />
              {statusCounts[status]} em {STATUS_LABEL[status]}
            </span>
          ))
        ) : (
          <span>Coletando seus primeiros dados do Metricool</span>
        )}
      </div>
    </div>
  );
}
