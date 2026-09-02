import { createClient } from "@/lib/supabase/server";
import {
  listExternalPosts,
  listReconcilableContents,
  type ReconcilableContent,
  type StoredExternalPost,
} from "@/lib/metrics/service";
import { sugerirVinculos, type Sugestao } from "@/lib/metrics/matching";
import { ReconcileBoard } from "./reconcile-board";

async function load(): Promise<{
  contents: ReconcilableContent[];
  posts: StoredExternalPost[];
  sugestoes: Sugestao[];
  erro: string | null;
}> {
  try {
    const db = createClient();
    const [contents, posts] = await Promise.all([
      listReconcilableContents(db),
      listExternalPosts(db),
    ]);

    // O palpite e calculado aqui e nao guardado: ele depende do estado atual das
    // duas listas, e um palpite gravado envelheceria em silencio a cada
    // importacao.
    const sugestoes = sugerirVinculos(
      contents.filter((c) => !posts.some((p) => p.contentId === c.id)),
      posts,
    );

    return { contents, posts, sugestoes, erro: null };
  } catch (err) {
    return {
      contents: [],
      posts: [],
      sugestoes: [],
      erro: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

export default async function ConciliacaoPage() {
  const { contents, posts, sugestoes, erro } = await load();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-[34px] font-light leading-tight tracking-tight">Conciliacao</h1>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
          Ligar o que voce planejou aqui ao que realmente saiu na plataforma. E o vinculo que
          permite ao Diretor aprender qual formato, pilar e hook deram resultado.
        </p>
      </header>

      {erro ? (
        <>
          <p className="text-[13px] text-muted">Nao consegui carregar a conciliacao.</p>
          <p className="mt-2 rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-relaxed text-muted">
            {erro}
          </p>
          {/* A migration 0007 cria external_posts e as colunas de identidade
              externa. Antes dela, a tela nao tem onde ler. */}
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Se a mensagem fala de tabela ou coluna inexistente, falta rodar a migration{" "}
            <code>0007_publicacao_metricas.sql</code> no SQL Editor do Supabase.
          </p>
        </>
      ) : (
        <ReconcileBoard contents={contents} posts={posts} sugestoes={sugestoes} />
      )}
    </div>
  );
}
