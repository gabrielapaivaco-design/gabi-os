import { createClient } from "@/lib/supabase/server";
import { listGenerations, type Generation } from "@/lib/ai/history";
import { HistoryList } from "./history-list";

async function load(): Promise<{ generations: Generation[]; unavailable: boolean }> {
  try {
    return { generations: await listGenerations(createClient()), unavailable: false };
  } catch {
    return { generations: [], unavailable: true };
  }
}

export default async function HistoricoPage() {
  const { generations, unavailable } = await load();

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Historico da IA</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Tudo o que o Diretor de Conteudo gerou neste workspace, com o custo em tokens.
        </p>
      </header>

      {unavailable ? (
        <p className="text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas.
        </p>
      ) : (
        <HistoryList generations={generations} />
      )}
    </div>
  );
}
