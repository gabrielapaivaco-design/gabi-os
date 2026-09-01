import Link from "next/link";
import { ArrowUpRight, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listExternalPosts, listReconcilableContents } from "@/lib/metrics/service";
import { lerPosts, formatoLabel, type Leitura, type PostLido } from "@/lib/metrics/analysis";
import { platformLabel } from "@/lib/metrics/types";

// Metricas: o que os numeros dizem sobre o que ela publicou.
//
// A tela inteira se recusa a preencher lacuna. Post sem coleta aparece como
// "—", nao como zero; secao sem amostra some, em vez de mostrar um grafico
// vazio com cara de dado. Uma conta que ainda nao importou nada precisa ver
// isso escrito, nao um painel bonito de zeros.

function numero(v: number | null | undefined): string {
  return typeof v === "number" ? Math.round(v).toLocaleString("pt-BR") : "—";
}

function percentual(v: number | null): string {
  return typeof v === "number" ? `${(v * 100).toFixed(1).replace(".", ",")}%` : "—";
}

function data(iso: string | null): string {
  if (!iso) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso));
}

async function carregar(): Promise<{
  leitura: Leitura | null;
  conciliaveis: number;
  erro: string | null;
}> {
  try {
    const db = createClient();
    const [posts, conteudos] = await Promise.all([
      listExternalPosts(db),
      listReconcilableContents(db),
    ]);
    return { leitura: lerPosts(posts), conciliaveis: conteudos.length, erro: null };
  } catch (err) {
    return {
      leitura: null,
      conciliaveis: 0,
      erro: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

export default async function MetricasPage() {
  const { leitura, conciliaveis, erro } = await carregar();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-[34px] font-light leading-tight tracking-tight">Metricas</h1>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
          O que aconteceu depois de publicar. Numeros importados da plataforma, sem estimativa e
          sem preenchimento: o que nao foi coletado aparece em branco.
        </p>
      </header>

      {erro ? (
        <ErroDeCarga erro={erro} />
      ) : !leitura || leitura.posts === 0 ? (
        <SemDados />
      ) : (
        <div className="flex flex-col gap-5">
          <Resumo l={leitura} conciliaveis={conciliaveis} />
          {leitura.porFormato.length > 1 && <Formatos l={leitura} />}
          {leitura.melhores.length > 0 && <Pontas l={leitura} />}
          <Tabela l={leitura} />
        </div>
      )}
    </div>
  );
}

function ErroDeCarga({ erro }: { erro: string }) {
  return (
    <section className="rounded-card bg-surface p-5">
      <p className="text-[13px] text-muted">Nao consegui carregar as metricas.</p>
      <p className="mt-2 rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-relaxed text-muted">
        {erro}
      </p>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Se a mensagem fala de tabela ou coluna inexistente, falta rodar a migration{" "}
        <code>0007_publicacao_metricas.sql</code> no SQL Editor do Supabase.
      </p>
    </section>
  );
}

function SemDados() {
  return (
    <section className="rounded-card bg-surface p-6">
      <h2 className="font-serif text-[21px] font-light leading-tight text-ink">
        Nenhum post importado ainda
      </h2>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted">
        Esta tela le o que foi importado da plataforma. Enquanto nao houver nada, ela fica assim —
        preferivel a um painel de zeros que parece dado.
      </p>
      <Link
        href="/conciliacao"
        className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98]"
      >
        <Link2 size={13} /> Importar em Conciliacao
      </Link>
    </section>
  );
}

function Resumo({ l, conciliaveis }: { l: Leitura; conciliaveis: number }) {
  const a = l.alcance;

  return (
    <section className="rounded-card bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
          A conta no periodo
        </h2>
        <span className="text-[12px] text-faint">
          {l.periodo && `${data(l.periodo.de)} a ${data(l.periodo.ate)} · `}
          {l.posts} {l.posts === 1 ? "post" : "posts"}
          {l.comMetrica < l.posts && ` · ${l.posts - l.comMetrica} sem numero coletado`}
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
        <Numero
          rotulo="Alcance tipico"
          valor={numero(a?.mediana)}
          nota={
            a && a.media > a.mediana * 1.3
              ? `a media e ${numero(a.media)} — puxada por poucos picos`
              : "mediana dos posts do periodo"
          }
          destaque
        />
        <Numero rotulo="Melhor post" valor={numero(a?.melhor)} nota="alcance" />
        <Numero
          rotulo="Engajamento tipico"
          valor={percentual(l.engajamento?.mediana ?? null)}
          nota="interacoes sobre alcance"
        />
      </div>

      {/* O elo aberto do ciclo — dito de dois jeitos, porque cobrar uma acao
          impossivel e pior que nao cobrar nada.

          Hoje a Eisen Haus esta no segundo caso: 20 posts de maio a julho e um
          unico conteudo publicado, de agosto. Nao existe par a formar. Mandar
          "Conciliar" aqui seria mandar ela bater numa porta fechada. */}
      {l.conciliados < l.posts && (
        <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
          {l.conciliados > 0
            ? `${l.conciliados} de ${l.posts} posts estao ligados a um conteudo do Pipeline. `
            : "Nenhum destes posts esta ligado a um conteudo do Pipeline. "}
          Sem esse vinculo os numeros existem, mas o Diretor nao consegue dizer{" "}
          <em>qual pilar ou formato</em> deu resultado.{" "}
          {conciliaveis > 0 ? (
            <>
              Ha {conciliaveis} {conciliaveis === 1 ? "conteudo esperando" : "conteudos esperando"}{" "}
              <Link href="/conciliacao" className="text-rose-ink underline underline-offset-2">
                em Conciliacao
              </Link>
              .
            </>
          ) : (
            <>
              Estes posts sao anteriores ao sistema, entao nao ha conteudo a que liga-los — o elo
              se fecha sozinho no primeiro conteudo que voce publicar a partir de um card.
            </>
          )}
        </p>
      )}
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">{rotulo}</p>
      <p
        className={`mt-1 font-serif font-light leading-none ${
          destaque ? "text-[38px] text-rose-ink" : "text-[30px] text-ink"
        }`}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-faint">{nota}</p>
    </div>
  );
}

function Formatos({ l }: { l: Leitura }) {
  const teto = Math.max(...l.porFormato.map((f) => f.medianaAlcance ?? 0), 1);

  return (
    <section className="rounded-card bg-surface p-5">
      <h2 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
        Por formato
      </h2>
      <p className="mb-4 text-[12px] leading-relaxed text-muted">
        Mediana de alcance de cada formato. E a comparacao que muda decisao — mas leia junto com
        a quantidade: dois posts nao definem um formato.
      </p>

      <ul className="flex flex-col gap-3">
        {l.porFormato.map((f) => (
          <li key={f.formato}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink">
                {f.formato}
                <span className="ml-2 text-[11px] text-faint">
                  {f.posts} {f.posts === 1 ? "post" : "posts"}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {numero(f.medianaAlcance)}
                {f.medianaEngajamento !== null && (
                  <span className="ml-2 text-[11px] text-faint">
                    {percentual(f.medianaEngajamento)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-rose"
                style={{ width: `${((f.medianaAlcance ?? 0) / teto) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pontas({ l }: { l: Leitura }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Ponta titulo="O que foi melhor" nota="Repita a mecanica, nao o assunto." posts={l.melhores} />
      <Ponta
        titulo="O que foi pior"
        nota="Vale olhar o que estes tem em comum."
        posts={l.piores}
      />
    </div>
  );
}

function Ponta({ titulo, nota, posts }: { titulo: string; nota: string; posts: PostLido[] }) {
  return (
    <section className="rounded-card bg-surface p-5">
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
        {titulo}
      </h2>
      <p className="mb-3 mt-1 text-[12px] leading-relaxed text-muted">{nota}</p>
      <ul className="flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] uppercase tracking-wide text-faint">
                {formatoLabel(p.mediaType)} · {data(p.publishedAt)}
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-ink">
                {numero(p.metrics?.reach)}
                {p.vezesAMediana !== null && (
                  <span className="ml-1.5 text-[11px] text-faint">
                    {p.vezesAMediana.toFixed(1).replace(".", ",")}x
                  </span>
                )}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
              {p.caption?.trim() || <span className="text-faint">Sem legenda importada</span>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tabela({ l }: { l: Leitura }) {
  return (
    <section className="rounded-card bg-surface p-5">
      <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
        Todos os posts
      </h2>

      {/* A tabela e larga; ela rola dentro do proprio cartao para a pagina
          nunca rolar de lado. */}
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              {["Post", "Formato", "Alcance", "Views", "Curtidas", "Coment.", "Compart.", "Salvos"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`pb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint ${
                      i >= 2 ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {l.todos.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 align-top">
                <td className="max-w-[280px] py-2.5 pr-4">
                  <span className="block text-[11px] text-faint">
                    {data(p.publishedAt)} · {platformLabel(p.platform)}
                    {p.contentId && <span className="text-rose-ink"> · conciliado</span>}
                  </span>
                  <span className="line-clamp-1 text-ink">
                    {p.caption?.trim() || <span className="text-faint">Sem legenda</span>}
                  </span>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-rose-ink"
                    >
                      abrir <ArrowUpRight size={10} />
                    </a>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-muted">{formatoLabel(p.mediaType)}</td>
                <td className="py-2.5 text-right tabular-nums text-ink">{numero(p.metrics?.reach)}</td>
                <td className="py-2.5 text-right tabular-nums text-muted">{numero(p.metrics?.views)}</td>
                <td className="py-2.5 text-right tabular-nums text-muted">{numero(p.metrics?.likes)}</td>
                <td className="py-2.5 text-right tabular-nums text-muted">
                  {numero(p.metrics?.comments)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-muted">{numero(p.metrics?.shares)}</td>
                <td className="py-2.5 text-right tabular-nums text-muted">{numero(p.metrics?.saves)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
