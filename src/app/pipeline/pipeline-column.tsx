"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/utils/constants";
import type { ContentStatus } from "@/types/db";
import { ContentCard } from "./content-card";
import { cardMatchesFilter } from "./filter";
import type { ContentCardData, PillarOption } from "./pipeline-board";
import { NewContentInput } from "./new-content-input";

export function PipelineColumn({
  status,
  cards,
  pillars,
  search,
  pillarFilter,
  onOpenCard,
}: {
  status: ContentStatus;
  cards: ContentCardData[];
  pillars: PillarOption[];
  search: string;
  pillarFilter: string;
  onOpenCard: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-[260px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: STATUS_COLOR[status] }}
        />
        <h2 className="text-[12px] font-medium uppercase tracking-wide text-faint">
          {STATUS_LABEL[status]}
        </h2>
        <span className="text-[11px] text-faint">{cards.length}</span>
      </div>

      {status === "ideia" && <NewContentInput />}

      <div
        ref={setNodeRef}
        className={`flex min-h-[64px] flex-col gap-2 rounded-card p-1 transition-colors ${
          isOver ? "bg-rose-tint" : ""
        }`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-faint">Nenhum conteudo</p>
          ) : (
            cards.map((card) => (
              <ContentCard
                key={card.id}
                card={card}
                pillar={pillars.find((p) => p.id === card.pillarId)}
                dimmed={!cardMatchesFilter(card, search, pillarFilter)}
                onOpen={() => onOpenCard(card.id)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
