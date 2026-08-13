"use client";

import { Sparkles } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { resolvePillarColor } from "@/lib/utils/constants";
import type { ContentCardData, PillarOption } from "./pipeline-board";

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
