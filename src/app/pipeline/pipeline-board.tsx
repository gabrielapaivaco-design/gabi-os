"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Sparkles } from "lucide-react";
import { STATUS_ORDER } from "@/lib/utils/constants";
import type { ContentStatus, Objective } from "@/types/db";
import { reorderColumnAction } from "./actions";
import { PipelineColumn } from "./pipeline-column";
import { CardPanel } from "./card-panel";

export interface ContentCardData {
  id: string;
  title: string;
  format: string | null;
  objective: Objective | null;
  pillarId: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  momentId: string | null;
  momentExcerpt: string | null;
  plannedDayKey: string | null;
  // Identidade externa: onde o conteudo saiu de fato. Nulos ate ser publicado
  // e conciliado.
  status?: string;
  publishedAt?: string | null;
  platform?: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
}

export interface PillarOption {
  id: string;
  name: string;
  color: string;
}

type Columns = Record<ContentStatus, ContentCardData[]>;

function isStatus(id: string): id is ContentStatus {
  return (STATUS_ORDER as string[]).includes(id);
}

function findColumnOf(columns: Columns, cardId: string): ContentStatus | undefined {
  return STATUS_ORDER.find((status) => columns[status].some((c) => c.id === cardId));
}

export function PipelineBoard({
  initialColumns,
  pillars,
  initialOpenCardId = null,
  aiConfigured = false,
}: {
  initialColumns: Columns;
  pillars: PillarOption[];
  initialOpenCardId?: string | null;
  aiConfigured?: boolean;
}) {
  const [columns, setColumns] = useState<Columns>(initialColumns);
  const [activeCard, setActiveCard] = useState<ContentCardData | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(initialOpenCardId);
  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState("");
  const dragOrigin = useRef<{ id: string; status: ContentStatus } | null>(null);
  // Snapshot pre-drag: se o drop for invalido (fora de qualquer coluna) ou o
  // drag for cancelado (Esc), o estado otimista movido pelo onDragOver e
  // desfeito em vez de ficar "fantasma" (visivel localmente, nunca persistido).
  const columnsSnapshot = useRef<Columns | null>(null);
  const [, startTransition] = useTransition();

  // Ressincroniza com os dados frescos do servidor apos qualquer revalidatePath
  // (criar, mover, editar, arquivar). Necessario porque useState so usa o valor
  // inicial na montagem — sem isso, edicoes/exclusoes nao apareceriam.
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const status = findColumnOf(columns, id);
    if (!status) return;
    dragOrigin.current = { id, status };
    columnsSnapshot.current = columns;
    setActiveCard(columns[status].find((c) => c.id === id) ?? null);
  }

  function handleDragCancel() {
    setActiveCard(null);
    dragOrigin.current = null;
    if (columnsSnapshot.current) setColumns(columnsSnapshot.current);
    columnsSnapshot.current = null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromStatus = findColumnOf(columns, activeId);
    const toStatus = isStatus(overId) ? overId : findColumnOf(columns, overId);
    if (!fromStatus || !toStatus || fromStatus === toStatus) return;

    setColumns((prev) => {
      const card = prev[fromStatus].find((c) => c.id === activeId);
      if (!card) return prev;
      const fromList = prev[fromStatus].filter((c) => c.id !== activeId);
      const overIndex = prev[toStatus].findIndex((c) => c.id === overId);
      const toList = [...prev[toStatus]];
      toList.splice(overIndex >= 0 ? overIndex : toList.length, 0, card);
      return { ...prev, [fromStatus]: fromList, [toStatus]: toList };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    const origin = dragOrigin.current;
    const snapshot = columnsSnapshot.current;
    dragOrigin.current = null;
    columnsSnapshot.current = null;

    if (!over || !origin) {
      if (snapshot) setColumns(snapshot);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const toStatus = isStatus(overId) ? overId : findColumnOf(columns, overId);
    if (!toStatus) {
      if (snapshot) setColumns(snapshot);
      return;
    }

    const list = columns[toStatus];
    const oldIndex = list.findIndex((c) => c.id === activeId);
    const overIndex = list.findIndex((c) => c.id === overId);
    const finalList =
      oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex
        ? arrayMove(list, oldIndex, overIndex)
        : list;

    setColumns((prev) => ({ ...prev, [toStatus]: finalList }));

    startTransition(() => {
      reorderColumnAction({
        status: toStatus,
        orderedIds: finalList.map((c) => c.id),
        movedContentId: activeId,
        movedFromStatus: origin.status,
      });
    });
  }

  function handleCardSaved(id: string, patch: Partial<ContentCardData>) {
    setColumns((prev) => {
      const status = findColumnOf(prev, id);
      if (!status) return prev;
      return {
        ...prev,
        [status]: prev[status].map((c) => (c.id === id ? { ...c, ...patch } : c)),
      };
    });
  }

  function handleCardDeleted(id: string) {
    setColumns((prev) => {
      const status = findColumnOf(prev, id);
      if (!status) return prev;
      return { ...prev, [status]: prev[status].filter((c) => c.id !== id) };
    });
    setOpenCardId(null);
  }

  const openCard = openCardId
    ? (STATUS_ORDER.map((s) => columns[s].find((c) => c.id === openCardId)).find(Boolean) ?? null)
    : null;

  return (
    <DndContext
      id="pipeline-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por titulo ou Momento..."
          aria-label="Pesquisar conteudo"
          className="w-64 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose"
        />
        <select
          value={pillarFilter}
          onChange={(e) => setPillarFilter(e.target.value)}
          aria-label="Filtrar por pilar"
          className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-rose"
        >
          <option value="">Todos os pilares</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {(search.trim() !== "" || pillarFilter !== "") && (
          <button
            onClick={() => {
              setSearch("");
              setPillarFilter("");
            }}
            className="text-[13px] text-faint transition-colors hover:text-ink"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ width: "max-content" }}>
          {STATUS_ORDER.map((status) => (
            <PipelineColumn
              key={status}
              status={status}
              cards={columns[status]}
              pillars={pillars}
              search={search}
              pillarFilter={pillarFilter}
              onOpenCard={setOpenCardId}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="w-[260px] rounded-card border border-line bg-surface p-3 text-sm shadow-lg">
            <p className="leading-snug text-ink">{activeCard.title}</p>
            {activeCard.momentExcerpt && (
              <p className="mt-1.5 flex items-start gap-1 text-[11px] text-faint">
                <Sparkles size={11} className="mt-0.5 shrink-0" />
                <span className="line-clamp-2">{activeCard.momentExcerpt}</span>
              </p>
            )}
          </div>
        ) : null}
      </DragOverlay>

      {openCard && (
        <CardPanel
          key={openCard.id}
          card={openCard}
          pillars={pillars}
          aiConfigured={aiConfigured}
          onClose={() => setOpenCardId(null)}
          onSaved={(patch) => handleCardSaved(openCard.id, patch)}
          onDeleted={() => handleCardDeleted(openCard.id)}
        />
      )}
    </DndContext>
  );
}
