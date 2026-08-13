"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthGrid, monthLabel, shiftMonth } from "@/lib/calendar/month";
import { STATUS_COLOR, STATUS_LABEL, resolvePillarColor } from "@/lib/utils/constants";
import type { ContentStatus } from "@/types/db";
import { scheduleContentAction } from "./actions";

export interface CalendarContent {
  id: string;
  title: string;
  status: ContentStatus;
  dayKey: string | null;
  pillarName: string | null;
  pillarColor: string | null;
}

export interface CommemorativeDate {
  id: string;
  name: string;
  month: number;
  day: number;
}

const UNPLANNED_ZONE = "unplanned";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function ContentChip({ content, compact = false }: { content: CalendarContent; compact?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-control border border-line bg-surface px-1.5 py-1 ${
        compact ? "text-[10px]" : "text-[12px]"
      }`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          backgroundColor: content.pillarColor
            ? resolvePillarColor(content.pillarColor)
            : STATUS_COLOR[content.status],
        }}
      />
      <span className="truncate text-ink">{content.title}</span>
    </div>
  );
}

function DraggableContent({ content, compact }: { content: CalendarContent; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: content.id });
  // aria-describedby do dnd-kit vem de um contador global que diverge entre
  // servidor e cliente (warning de hidratacao). Removido; role/tabIndex ficam,
  // entao o acesso por teclado continua funcionando.
  const { "aria-describedby": _ignored, ...a11y } = attributes;

  return (
    <div
      ref={setNodeRef}
      {...a11y}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="cursor-grab active:cursor-grabbing"
    >
      <ContentChip content={content} compact={compact} />
    </div>
  );
}

function DayCell({
  cell,
  contents,
  commemorative,
}: {
  cell: { key: string; day: number; inMonth: boolean; isToday: boolean };
  contents: CalendarContent[];
  commemorative: CommemorativeDate[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cell.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[96px] flex-col gap-1 border-b border-r border-line p-1.5 transition-colors ${
        cell.inMonth ? "bg-surface" : "bg-canvas"
      } ${isOver ? "bg-rose-tint" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] tabular-nums ${
            cell.isToday
              ? "flex h-5 w-5 items-center justify-center rounded-full bg-ink font-medium text-white"
              : cell.inMonth
                ? "text-muted"
                : "text-faint"
          }`}
        >
          {cell.day}
        </span>
      </div>

      {commemorative.map((d) => (
        <span key={d.id} className="truncate text-[10px] text-rose-ink" title={d.name}>
          {d.name}
        </span>
      ))}

      <div className="flex flex-col gap-1">
        {contents.map((c) => (
          <DraggableContent key={c.id} content={c} compact />
        ))}
      </div>
    </div>
  );
}

export function CalendarBoard({
  contents: initialContents,
  commemorativeDates,
  initialYear,
  initialMonth,
}: {
  contents: CalendarContent[];
  commemorativeDates: CommemorativeDate[];
  initialYear: number;
  initialMonth: number;
}) {
  const [contents, setContents] = useState(initialContents);
  const [{ year, month }, setCursor] = useState({ year: initialYear, month: initialMonth });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setContents(initialContents), [initialContents]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const grid = buildMonthGrid(year, month);
  const unplanned = contents.filter((c) => c.dayKey === null);
  const activeContent = contents.find((c) => c.id === activeId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const id = String(active.id);
    const target = String(over.id);
    const newDayKey = target === UNPLANNED_ZONE ? null : target;
    const previous = contents.find((c) => c.id === id);
    if (!previous || previous.dayKey === newDayKey) return;

    setError(null);
    setContents((prev) => prev.map((c) => (c.id === id ? { ...c, dayKey: newDayKey } : c)));

    startTransition(async () => {
      const result = await scheduleContentAction(id, newDayKey);
      if (!result.ok) {
        // Reverte para a posicao anterior se o servidor recusou.
        setContents((prev) =>
          prev.map((c) => (c.id === id ? { ...c, dayKey: previous.dayKey } : c)),
        );
        setError(result.error);
      }
    });
  }

  return (
    <DndContext
      id="calendar-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setCursor(shiftMonth(year, month, -1))}
          aria-label="Mes anterior"
          className="rounded-control border border-line p-1.5 text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={14} />
        </button>
        <h2 className="text-sm font-medium capitalize text-ink">{monthLabel(year, month)}</h2>
        <button
          onClick={() => setCursor(shiftMonth(year, month, 1))}
          aria-label="Proximo mes"
          className="rounded-control border border-line p-1.5 text-muted transition-colors hover:text-ink"
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={() => setCursor({ year: initialYear, month: initialMonth })}
          className="text-[13px] text-faint transition-colors hover:text-ink"
        >
          Hoje
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-control border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-7 border-l border-t border-line">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="border-b border-r border-line bg-canvas px-1.5 py-1 text-[11px] font-medium uppercase tracking-wide text-faint"
              >
                {d}
              </div>
            ))}
            {grid.map((cell) => (
              <DayCell
                key={cell.key}
                cell={cell}
                contents={contents.filter((c) => c.dayKey === cell.key)}
                commemorative={commemorativeDates.filter((d) => {
                  const [, m, day] = cell.key.split("-").map(Number);
                  return d.month === m && d.day === day;
                })}
              />
            ))}
          </div>
        </div>

        <UnplannedPanel contents={unplanned} />
      </div>

      <DragOverlay>
        {activeContent ? (
          <div className="w-[200px] shadow-lg">
            <ContentChip content={activeContent} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function UnplannedPanel({ contents }: { contents: CalendarContent[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNPLANNED_ZONE });

  return (
    <aside
      ref={setNodeRef}
      className={`w-[220px] shrink-0 rounded-card border border-line p-3 transition-colors ${
        isOver ? "bg-rose-tint" : "bg-canvas"
      }`}
    >
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
        Sem data ({contents.length})
      </h2>
      {contents.length === 0 ? (
        <p className="text-[12px] text-faint">Tudo planejado.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {contents.map((c) => (
            <div key={c.id}>
              <DraggableContent content={c} />
              <span className="mt-0.5 block text-[10px] text-faint">{STATUS_LABEL[c.status]}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
