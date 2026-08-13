"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Historico da IA</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Nao consegui carregar o historico: {error.message}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98]"
      >
        Tentar de novo
      </button>
    </div>
  );
}
