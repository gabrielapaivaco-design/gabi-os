"use client";

export default function CerebrosError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-sm text-ink">Algo falhou ao carregar os Cerebros.</p>
      <p className="mt-1 text-[13px] text-muted">
        Confira as variaveis em <code>.env.local</code> e se as migrations foram executadas.
      </p>
      <button
        onClick={reset}
        className="mt-3 rounded-control border border-line px-3 py-1.5 text-[13px] text-ink transition-colors hover:bg-canvas"
      >
        Tentar de novo
      </button>
    </div>
  );
}
