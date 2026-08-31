import { createClient } from "@/lib/supabase/server";
import { listLibrary, type LibraryItem } from "@/lib/library/service";
import { LibraryBrowser } from "./library-browser";

// Biblioteca: o acervo do que ela ja escreveu, inclusive o arquivado.
//
// Duas perguntas que nao tinham tela: "ja escrevi sobre isso?" e "para onde foi
// o que eu aposentei?". A segunda passou a existir com a virada de mes — sem
// este lugar, "Aposentar" pareceria um botao de apagar.

async function carregar(): Promise<{ items: LibraryItem[]; erro: string | null }> {
  try {
    return { items: await listLibrary(createClient()), erro: null };
  } catch (err) {
    return { items: [], erro: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export default async function BibliotecaPage() {
  const { items, erro } = await carregar();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-[34px] font-light leading-tight tracking-tight">
          Biblioteca
        </h1>
        <p className="mt-0.5 max-w-prose text-[13px] leading-relaxed text-muted">
          Tudo que ja foi escrito neste workspace. Busque por qualquer palavra do roteiro, da
          legenda ou do hook — o que foi arquivado continua aqui, inteiro.
        </p>
      </header>

      {erro ? (
        <section className="rounded-card bg-surface p-5">
          <p className="text-[13px] text-muted">Nao consegui carregar a biblioteca.</p>
          <p className="mt-2 rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-relaxed text-muted">
            {erro}
          </p>
        </section>
      ) : (
        <LibraryBrowser items={items} />
      )}
    </div>
  );
}
