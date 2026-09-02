"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Link2, Unlink, Wand2 } from "lucide-react";
import { platformLabel } from "@/lib/metrics/types";
import type { ReconcilableContent, StoredExternalPost } from "@/lib/metrics/service";
import type { Sugestao } from "@/lib/metrics/matching";
import { importPostsAction, linkPostAction, unlinkPostAction } from "./actions";

function data(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

function num(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("pt-BR");
}

export function ReconcileBoard({
  contents,
  posts,
  sugestoes,
}: {
  contents: ReconcilableContent[];
  posts: StoredExternalPost[];
  sugestoes: Sugestao[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Post selecionado do LADO B, esperando um conteudo do LADO A.
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [json, setJson] = useState("");
  // Sugestoes que ela dispensou nesta visita. Nao vao para o banco: recusar um
  // palpite nao e um dado sobre a marca, e na proxima importacao o palpite pode
  // ate estar certo.
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set());

  const naoConciliados = posts.filter((p) => !p.contentId);
  const conciliados = posts.filter((p) => p.contentId);
  const porContentId = new Map(conciliados.map((p) => [p.contentId!, p]));
  const porPostId = new Map(posts.map((p) => [p.id, p]));

  const sugestaoPorConteudo = new Map(
    sugestoes.filter((s) => !dispensadas.has(s.contentId)).map((s) => [s.contentId, s]),
  );

  function vincular(contentId: string, postId?: string) {
    const post = postId ?? selecionado;
    if (!post) return;
    setErro(null);
    startTransition(async () => {
      const r = await linkPostAction(post, contentId);
      if (!r.ok) return setErro(r.error);
      setSelecionado(null);
      router.refresh();
    });
  }

  function desfazer(postId: string) {
    setErro(null);
    startTransition(async () => {
      const r = await unlinkPostAction(postId);
      if (!r.ok) return setErro(r.error);
      router.refresh();
    });
  }

  function importar() {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await importPostsAction(json, "instagram");
      if (!r.ok) return setErro(r.error);
      setAviso(r.mensagem ?? "Importado.");
      setJson("");
      setImportando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-ink">Importar posts</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              Cole as linhas da origem (hoje, o conector do Windsor). Reimportar o mesmo periodo
              corrige em vez de duplicar.
            </p>
          </div>
          {!importando && (
            <button
              onClick={() => setImportando(true)}
              className="shrink-0 rounded-control border border-line px-3 py-1.5 text-[12px] text-ink transition-colors hover:border-faint"
            >
              Colar dados
            </button>
          )}
        </div>

        {importando && (
          <div className="mt-3">
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={6}
              autoFocus
              placeholder='{"result":[{"media_id":"...","media_reach":703, ...}]}'
              className="w-full resize-y rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-relaxed text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={importar}
                disabled={isPending || !json.trim()}
                className="rounded-control bg-ink px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
              >
                {isPending ? "Importando..." : "Importar"}
              </button>
              <button
                onClick={() => {
                  setImportando(false);
                  setJson("");
                }}
                className="text-[12px] text-faint transition-colors hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {erro && (
        <p className="rounded-control border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] leading-relaxed text-destructive">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="rounded-control border border-line bg-canvas px-3 py-2 text-[13px] text-ink">{aviso}</p>
      )}

      {selecionado && (
        <p className="rounded-control border border-rose/40 bg-rose-tint px-3 py-2 text-[13px] text-rose-ink">
          Post selecionado. Agora clique em <strong>Vincular</strong> no conteudo correspondente,
          a esquerda.{" "}
          <button onClick={() => setSelecionado(null)} className="underline underline-offset-2">
            cancelar
          </button>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* LADO A */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-1 text-[12px] font-medium uppercase tracking-wide text-faint">
            Conteudos do Gabi OS
          </h2>
          <p className="mb-4 text-[12px] text-muted">
            Agendados e publicados. {contents.length}{" "}
            {contents.length === 1 ? "conteudo" : "conteudos"}.
          </p>

          {contents.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-muted">
              Nenhum conteudo agendado ou publicado ainda. Agende no Calendario ou marque um card
              como publicado no Pipeline.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {contents.map((c) => {
                const post = porContentId.get(c.id);
                return (
                  <li key={c.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="text-[13px] font-medium leading-snug text-ink">{c.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-wide text-faint">
                      {c.format && <span className="text-rose-ink">{c.format}</span>}
                      {c.pillarName && <span>· {c.pillarName}</span>}
                      <span>· {c.status}</span>
                      {c.plannedAt && <span>· {data(c.plannedAt)}</span>}
                    </div>

                    {post ? (
                      <div className="mt-1.5 flex items-center gap-2 text-[12px]">
                        <Check size={12} className="shrink-0 text-status-agendar" />
                        <span className="text-muted">
                          {platformLabel(post.platform)}
                          {post.metrics?.reach !== null && post.metrics !== null && (
                            <> · {num(post.metrics.reach)} de alcance</>
                          )}
                        </span>
                        <button
                          onClick={() => desfazer(post.id)}
                          disabled={isPending}
                          className="flex items-center gap-1 text-faint transition-colors hover:text-destructive disabled:opacity-40"
                        >
                          <Unlink size={11} /> desfazer
                        </button>
                      </div>
                    ) : selecionado ? (
                      <button
                        onClick={() => vincular(c.id)}
                        disabled={isPending}
                        className="mt-1.5 flex items-center gap-1.5 rounded-control bg-ink px-2.5 py-1 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
                      >
                        <Link2 size={11} /> Vincular aqui
                      </button>
                    ) : sugestaoPorConteudo.has(c.id) ? (
                      <Palpite
                        sugestao={sugestaoPorConteudo.get(c.id)!}
                        post={porPostId.get(sugestaoPorConteudo.get(c.id)!.postId)}
                        pendente={isPending}
                        onConfirmar={() =>
                          vincular(c.id, sugestaoPorConteudo.get(c.id)!.postId)
                        }
                        onDispensar={() =>
                          setDispensadas(new Set(dispensadas).add(c.id))
                        }
                      />
                    ) : (
                      <p className="mt-1.5 text-[12px] text-faint">sem post vinculado</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* LADO B */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-1 text-[12px] font-medium uppercase tracking-wide text-faint">
            Posts publicados de verdade
          </h2>
          <p className="mb-4 text-[12px] text-muted">
            {naoConciliados.length} sem vinculo, {conciliados.length}{" "}
            {conciliados.length === 1 ? "vinculado" : "vinculados"}.
          </p>

          {posts.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-muted">
              Nenhum post importado ainda. Use &quot;Colar dados&quot; acima.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {[...naoConciliados, ...conciliados].map((p) => {
                const jaVinculado = !!p.contentId;
                const estaSelecionado = selecionado === p.id;
                return (
                  <li
                    key={p.id}
                    className={`border-b border-line pb-3 last:border-0 last:pb-0 ${
                      jaVinculado ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-wide">
                          <span className="text-rose-ink">{p.mediaType ?? "post"}</span>
                          <span className="text-faint">· {data(p.publishedAt)}</span>
                          <span className="text-faint">· {platformLabel(p.platform)}</span>
                        </div>
                        {p.caption && (
                          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink">
                            {p.caption}
                          </p>
                        )}
                        {p.metrics && (
                          <p className="mt-1 text-[11px] tabular-nums text-faint">
                            alcance {num(p.metrics.reach)} · salvos {num(p.metrics.saves)} ·
                            compart. {num(p.metrics.shares)} · curtidas {num(p.metrics.likes)}
                          </p>
                        )}
                      </div>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Abrir no Instagram"
                          className="shrink-0 text-faint transition-colors hover:text-ink"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>

                    {!jaVinculado && (
                      <button
                        onClick={() => setSelecionado(estaSelecionado ? null : p.id)}
                        disabled={isPending}
                        className={`mt-1.5 rounded-control border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-40 ${
                          estaSelecionado
                            ? "border-rose bg-rose-tint font-medium text-rose-ink"
                            : "border-line text-ink hover:border-faint"
                        }`}
                      >
                        {estaSelecionado ? "selecionado" : "Conciliar este"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// O palpite do sistema, dentro do conteudo a que ele se refere.
//
// Mostra a legenda do post e o motivo do palpite antes de qualquer botao: ela
// precisa poder discordar sem clicar. Um palpite que se explica pode ser
// recusado em um segundo; um que so diz "vincular?" obriga a ir conferir do
// outro lado da tela, que era exatamente o trabalho que isto veio poupar.
function Palpite({
  sugestao,
  post,
  pendente,
  onConfirmar,
  onDispensar,
}: {
  sugestao: Sugestao;
  post: StoredExternalPost | undefined;
  pendente: boolean;
  onConfirmar: () => void;
  onDispensar: () => void;
}) {
  if (!post) return null;

  return (
    <div className="mt-2 rounded-control border border-rose/30 bg-rose-tint/40 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-rose-ink">
        <Wand2 size={11} /> provavelmente este post
        <span className="normal-case tracking-normal text-muted">· {sugestao.motivo}</span>
      </p>

      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink">
        {post.caption?.trim() || <span className="text-faint">Sem legenda</span>}
      </p>
      <p className="mt-0.5 text-[11px] text-faint">
        {data(post.publishedAt)}
        {post.metrics?.reach !== null && post.metrics && <> · {num(post.metrics.reach)} de alcance</>}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onConfirmar}
          disabled={pendente}
          className="flex items-center gap-1.5 rounded-control bg-ink px-2.5 py-1 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
        >
          <Link2 size={11} /> E este
        </button>
        <button
          onClick={onDispensar}
          disabled={pendente}
          className="text-[12px] text-faint transition-colors hover:text-ink disabled:opacity-40"
        >
          nao e
        </button>
      </div>
    </div>
  );
}
