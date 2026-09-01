import { createClient } from "@/lib/supabase/server";
import {
  BRAIN_DESCRIPTION,
  BRAIN_LABEL,
  SUGGESTED_SECTIONS,
  loadBrains,
  type BrainContent,
} from "@/lib/brains/service";
import { listPillars, type Pillar } from "@/lib/pillars/service";
import type { BrainKind } from "@/types/db";
import { BrainEditor } from "./brain-editor";
import { PillarsEditor } from "./pillars-editor";

const KINDS: BrainKind[] = ["brand", "business", "learned"];

async function load(): Promise<{
  brains: Record<BrainKind, BrainContent>;
  pillars: Pillar[];
  unavailable: boolean;
}> {
  try {
    const db = createClient();
    const [brains, pillars] = await Promise.all([loadBrains(db), listPillars(db)]);
    return { brains, pillars, unavailable: false };
  } catch {
    return { brains: { brand: {}, business: {}, learned: {} }, pillars: [], unavailable: true };
  }
}

export default async function CerebrosPage() {
  const { brains, pillars, unavailable } = await load();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-[34px] font-light leading-tight tracking-tight">Cerebros</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          O que o Diretor de Conteudo sabe sobre voce. Quanto mais preenchido, mais a IA escreve
          na sua voz — e nao numa voz generica.
        </p>
      </header>

      {unavailable && (
        <p className="mb-4 text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {KINDS.map((kind) => (
          <BrainEditor
            key={kind}
            kind={kind}
            label={BRAIN_LABEL[kind]}
            description={BRAIN_DESCRIPTION[kind]}
            content={brains[kind]}
            suggestedSections={SUGGESTED_SECTIONS[kind]}
          />
        ))}

        {/* Depois dos tres cerebros: os pilares sao o resumo operacional do que
            eles dizem — o que a marca fala, em lista. */}
        {!unavailable && <PillarsEditor pillars={pillars} />}
      </div>
    </div>
  );
}
