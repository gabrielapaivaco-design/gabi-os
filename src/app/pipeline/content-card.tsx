"use client";

import { CircleDashed, Image, Layers, Sparkles, Video } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { resolvePillarColor } from "@/lib/utils/constants";
import { FORMATO_LABEL, normalizarFormato, type Formato } from "@/lib/content/format";
import type { ContentCardData, PillarOption } from "./pipeline-board";

// Um icone por formato. A forma e o que se le mais rapido varrendo uma coluna
// inteira — mais rapido que a palavra, e sem gastar uma terceira dimensao de
// cor no card, que ja usa cor para o pilar e a coluna para o status.
const ICONE: Record<Formato, typeof Video> = {
  reel: Video,
  carrossel: Layers,
  stories: CircleDashed,
  foto: Image,
};

function EtiquetaFormato({ format }: { format: string | null }) {
  const f = normalizarFormato(format);

  // Sem formato reconhecido a etiqueta diz isso, em vez de sumir. Sete
  // conteudos ativos estao assim: some-los esconderia o que ela precisa
  // arrumar, e a etiqueta vazia e o proprio lembrete.
  if (!f) {
    return (
      <span className="inline-flex items-center gap-1 rounded-control bg-canvas px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-faint">
        sem formato
      </span>
    );
  }

  const Icon = ICONE[f];
  return (
    <span className="inline-flex items-center gap-1 rounded-control bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
      <Icon size={10} strokeWidth={2} />
      {FORMATO_LABEL[f]}
    </span>
  );
}

export function ContentCard({
  card,
  pillar,
  dimmed = false,
  onOpen,
}: {
  card: ContentCardData;
  pillar?: PillarOption;
  dimmed?: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  // aria-describedby do dnd-kit vem de um contador global que diverge entre
  // servidor e cliente (warning de hidratacao). Removido; role/tabIndex ficam,
  // entao o acesso por teclado continua funcionando.
  const { "aria-describedby": _ignored, ...a11y } = attributes;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : dimmed ? 0.3 : 1,
      }}
      {...a11y}
      {...(dimmed ? {} : listeners)}
      onClick={dimmed ? undefined : onOpen}
      className={`rounded-card border border-line bg-surface p-3 text-sm transition-colors ${
        dimmed ? "pointer-events-none" : "cursor-grab hover:border-faint active:cursor-grabbing"
      }`}
    >
      {/* O formato vem antes do titulo: e o que ela varre a coluna procurando,
          e ate agora so aparecia abrindo o card. */}
      <div className="mb-1.5">
        <EtiquetaFormato format={card.format} />
      </div>

      <p className="leading-snug text-ink">{card.title}</p>
      {pillar && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-faint">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: resolvePillarColor(pillar.color) }}
          />
          {pillar.name}
        </span>
      )}
      {card.momentExcerpt && (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-faint">
          <Sparkles size={11} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{card.momentExcerpt}</span>
        </p>
      )}
    </div>
  );
}
