// Tela Hoje — a Bancada: modulos de tamanhos diferentes, onde o tamanho e a
// hierarquia. Dados reais quando existem; ausencia honesta quando nao.
//
// A versao anterior era uma pilha de cartoes de mesmo peso, um embaixo do
// outro. Tudo parecia igualmente importante, e por isso nada parecia
// importante. Aqui a rotina de hoje ocupa duas colunas e o resto se organiza
// em volta dela.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace/current";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_ORDER,
  resolvePillarColor,
} from "@/lib/utils/constants";
import type { ContentStatus } from "@/types/db";
import { GoalsWidget, type Goal } from "./goals-widget";
import { isAiConfigured } from "@/lib/ai";
import { loadMonthlyPlan } from "@/lib/planning/service";
import { weekdayDe } from "@/lib/planning/weekday";
import type { StoriesDay } from "@/lib/ai/director/planner";
import { listExternalPosts } from "@/lib/metrics/service";
import { lerPosts, type Leitura } from "@/lib/metrics/analysis";
import { StoriesHoje } from "./stories-hoje";
import { Tile, TileLabel } from "./tile";

// Sugerir as metas do trimestre roda daqui e leva dezenas de segundos. Ver a
// nota em /planejamento sobre por que o valor mora na rota, e literal.
export const maxDuration = 300;

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
  // Cor do pilar. E o que permite ver, de relance, se a semana inteira esta
  // saindo do mesmo assunto.
  pillarColor: string | null;
}

interface HojeData {
  // Tema de Story de hoje, vindo do plano do mes. Nulo quando o mes nao foi
  // planejado ou quando o plano nao cobriu este dia da semana.
  storyDeHoje: StoriesDay | null;
  totalMoments: number;
  unconvertedMoments: number;
  statusCounts: Record<ContentStatus, number>;
  toRecord: ActionItem[];
  toEdit: ActionItem[];
  toPost: ActionItem[];
  goals: Goal[];
  leitura: Leitura | null;
  unavailable: boolean;
  erro?: string;
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
        .select("id, title, status, pillars(color)")
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
    const contents = ((contentsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
      // O join devolve objeto ou array conforme a cardinalidade que o PostgREST
      // infere; normalizar aqui evita a checagem em todo lugar que usa a cor.
      const p = r.pillars as { color?: string } | { color?: string }[] | null;
      const pilar = Array.isArray(p) ? p[0] : p;
      return {
        id: String(r.id),
        title: String(r.title),
        status: r.status as ContentStatus,
        pillarColor: pilar?.color ? resolvePillarColor(pilar.color) : null,
      };
    });
    for (const row of contents) statusCounts[row.status] += 1;

    // As duas leituras abaixo ficam fora do Promise.all de proposito: nenhuma
    // delas e obrigatoria para a tela existir, e uma ausencia — mes sem plano,
    // migration de metricas ainda nao rodada — nao pode derrubar o resto.
    const agora = new Date();
    let storyDeHoje: StoriesDay | null = null;
    try {
      const plano = await loadMonthlyPlan(db, {
        year: agora.getFullYear(),
        month: agora.getMonth(),
      });
      const dia = weekdayDe(agora);
      storyDeHoje = plano?.storiesRoutine.find((d) => d.weekday === dia) ?? null;
    } catch {
      // Plano indisponivel nao e erro da tela Hoje.
    }

    let leitura: Leitura | null = null;
    try {
      const posts = await listExternalPosts(db);
      if (posts.length > 0) leitura = lerPosts(posts);
    } catch {
      // Sem a migration 0007 nao ha metricas; os modulos delas simplesmente
      // nao aparecem.
    }

    return {
      storyDeHoje,
      totalMoments,
      unconvertedMoments: Math.max(totalMoments - linkedCount, 0),
      statusCounts,
      toRecord: contents.filter((c) => c.status === "gravar"),
      toEdit: contents.filter((c) => c.status === "editar"),
      toPost: contents.filter((c) => c.status === "agendar"),
      goals: (goalsRes.data ?? []) as Goal[],
      leitura,
      unavailable: false,
    };
  } catch (err) {
    // A mensagem real vai junto. A versao anterior engolia o erro e mostrava
    // sempre "confira o .env.local", o que mandou investigar o lugar errado
    // quando o problema era outro. Erro sem causa visivel custa mais caro que
    // erro feio.
    const causa = err instanceof Error ? err.message : String(err);
    console.error("[hoje] falha ao carregar:", causa);

    return {
      storyDeHoje: null,
      totalMoments: 0,
      unconvertedMoments: 0,
      statusCounts: emptyStatusCounts(),
      toRecord: [],
      toEdit: [],
      toPost: [],
      goals: [],
      leitura: null,
      unavailable: true,
      erro: causa,
    };
  }
}

function Fila({
  titulo,
  status,
  items,
}: {
  titulo: string;
  status: ContentStatus;
  items: ActionItem[];
}) {
  if (items.length === 0) return null;
  const cor = STATUS_COLOR[status];

  return (
    <Tile cor={cor}>
      <TileLabel cor={cor} extra={items.length}>
        {titulo}
      </TileLabel>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/pipeline?open=${item.id}`}
              className="flex items-start gap-2.5 text-[13px] leading-snug text-ink transition-colors hover:text-rose-ink"
            >
              {/* A bolinha carrega a cor do PILAR enquanto o cartao carrega a do
                  status: duas informacoes no mesmo olhar. Sem pilar ela fica
                  vazada, o que ja diz que falta classificar. */}
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={
                  item.pillarColor
                    ? { backgroundColor: item.pillarColor }
                    : { boxShadow: "inset 0 0 0 1px currentColor", opacity: 0.35 }
                }
              />
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

export default async function HojePage() {
  const {
    storyDeHoje,
    totalMoments,
    unconvertedMoments,
    statusCounts,
    toRecord,
    toEdit,
    toPost,
    goals,
    leitura,
    unavailable,
    erro,
  } = await loadHoje();

  const agora = new Date();
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(agora);

  const activeContents = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const hasData = !unavailable && totalMoments > 0;
  const alcance = leitura?.alcance ?? null;

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
          <h1 className="font-serif text-[34px] leading-tight tracking-tight">
            {saudacao()}, Gabriela
          </h1>
          <p className="text-[13px] text-faint first-letter:uppercase">{hoje}</p>
        </div>
        <Link
          href="/momentos"
          className="shrink-0 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98]"
        >
          + Momento
        </Link>
      </header>

      {unavailable ? (
        <Tile>
          <p className="text-[13px] text-ink">Nao consegui carregar os dados deste workspace.</p>
          {erro && (
            <p className="mt-2 rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-relaxed text-muted">
              {erro}
            </p>
          )}
        </Tile>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* O maior modulo e o unico trabalho com hora marcada. Sem plano no
              mes, o briefing assume o lugar dele em vez de deixar um buraco. */}
          {storyDeHoje ? (
            <StoriesHoje dia={storyDeHoje} hoje={weekdayDe(agora)} />
          ) : (
            <Tile span>
              <TileLabel>Briefing do diretor</TileLabel>
              <p className="max-w-[54ch] font-serif text-[23px] leading-[1.4] text-ink">
                {hasData ? (
                  <>
                    Voce tem{" "}
                    <span className="border-b-2 border-rose-tint">
                      {totalMoments} {totalMoments === 1 ? "Momento" : "Momentos"}
                    </span>{" "}
                    {totalMoments === 1 ? "registrado" : "registrados"}
                    {unconvertedMoments > 0 && <> — {unconvertedMoments} ainda sem virar conteudo</>}
                    .{" "}
                    {activeContents > 0 && (
                      <>
                        <span className="border-b-2 border-rose-tint">
                          {activeContents} conteudos
                        </span>{" "}
                        em andamento no Pipeline.
                      </>
                    )}
                  </>
                ) : (
                  <>
                    Bem-vinda ao seu segundo cerebro. Comece registrando um Momento sempre que algo
                    interessante acontecer &mdash; e eu transformo em conteudo a partir dai.
                  </>
                )}
              </p>
              {hasData && (
                <Link
                  href="/planejamento"
                  className="mt-3 inline-block text-[12px] text-rose-ink underline underline-offset-2"
                >
                  Este mes ainda nao tem plano
                </Link>
              )}
            </Tile>
          )}

          {/* O numero da conta, quando ha o que contar. */}
          {alcance ? (
            <Tile>
              <TileLabel>Alcance tipico</TileLabel>
              <p className="font-serif text-[44px] leading-none text-rose-ink">
                {Math.round(alcance.mediana).toLocaleString("pt-BR")}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                mediana de {alcance.amostra} posts.
                {alcance.media > alcance.mediana * 1.3 && (
                  <> A media, {Math.round(alcance.media).toLocaleString("pt-BR")}, e puxada por poucos picos.</>
                )}
              </p>
              <Link
                href="/metricas"
                className="mt-3 inline-block text-[12px] text-rose-ink underline underline-offset-2"
              >
                Ver metricas
              </Link>
            </Tile>
          ) : (
            <Tile>
              <TileLabel>Momentos</TileLabel>
              <p className="font-serif text-[44px] leading-none text-rose-ink">{totalMoments}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {unconvertedMoments > 0
                  ? `${unconvertedMoments} ainda sem virar conteudo.`
                  : "todos ja viraram conteudo."}
              </p>
            </Tile>
          )}

          <Fila titulo="Gravar" status="gravar" items={toRecord} />
          <Fila titulo="Editar" status="editar" items={toEdit} />
          <Fila titulo="Postar" status="agendar" items={toPost} />

          {/* As metas ocupam duas colunas: sao do trimestre inteiro, e o peso
              visual acompanha o horizonte. */}
          <div className="sm:col-span-2">
            <GoalsWidget goals={goals} quarter={currentQuarter()} aiConfigured={isAiConfigured()} />
          </div>

          {/* Formato so aparece quando ha mais de um para comparar: um formato
              sozinho nao e comparacao, e uma barra sozinha nao ensina nada. */}
          {leitura && leitura.porFormato.length > 1 && (
            <Tile>
              <TileLabel>Por formato</TileLabel>
              <ul className="flex flex-col gap-2.5">
                {leitura.porFormato.slice(0, 4).map((f) => {
                  const teto = leitura.porFormato[0].medianaAlcance ?? 1;
                  return (
                    <li key={f.formato}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="text-ink">
                          {f.formato} <span className="text-faint">{f.posts}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {f.medianaAlcance === null
                            ? "—"
                            : Math.round(f.medianaAlcance).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-rose"
                          style={{ width: `${((f.medianaAlcance ?? 0) / teto) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Tile>
          )}
        </div>
      )}

      {!unavailable && activeContents > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-[12px] text-muted">
          {STATUS_ORDER.filter((status) => statusCounts[status] > 0).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[status] }}
              />
              {statusCounts[status]} em {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
