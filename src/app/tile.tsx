import { TINT_BORDA, TINT_FUNDO, tintColor } from "@/lib/utils/constants";

// Modulo da Bancada.
//
// Sem `cor`, e o cartao branco de sempre. Com `cor`, ele se tinge da propria
// cor daquilo que mostra — o status da fila, o rose da rotina de stories. A cor
// nunca e escolhida por gosto aqui: ela vem do dado.
export function Tile({
  cor,
  span,
  children,
  className = "",
}: {
  cor?: string;
  span?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const estilo = cor
    ? { backgroundColor: tintColor(cor, TINT_FUNDO), borderColor: tintColor(cor, TINT_BORDA) }
    : undefined;

  return (
    <section
      style={estilo}
      className={`rounded-card p-5 ${cor ? "border" : "bg-surface"} ${
        span ? "sm:col-span-2" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function TileLabel({
  children,
  cor,
  extra,
}: {
  children: React.ReactNode;
  cor?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      {cor && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />}
      <h2
        className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
        style={cor ? { color: cor } : undefined}
      >
        <span className={cor ? "" : "text-faint"}>{children}</span>
      </h2>
      {extra && <span className="ml-auto shrink-0 text-[12px] text-faint">{extra}</span>}
    </div>
  );
}
