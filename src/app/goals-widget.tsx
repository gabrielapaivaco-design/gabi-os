"use client";

import { useEffect, useState, useTransition } from "react";
import {
  bumpGoalProgressAction,
  createGoalAction,
  deleteGoalAction,
  updateGoalAction,
} from "./goals-actions";
import { GoalsSuggest } from "./goals-suggest";

export interface Goal {
  id: string;
  title: string;
  target: number | null;
  progress: number;
  quarter: string | null;
  metric_key: string | null;
}

const inputClass =
  "rounded-control border border-line bg-canvas px-2 py-1 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose";

export function GoalsWidget({
  goals: initialGoals,
  quarter,
  aiConfigured = false,
}: {
  goals: Goal[];
  quarter: string;
  aiConfigured?: boolean;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setGoals(initialGoals), [initialGoals]);

  function handleBump(goal: Goal, delta: number) {
    setError(null);
    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? { ...g, progress: Math.max(g.progress + delta, 0) } : g)),
    );
    startTransition(async () => {
      const result = await bumpGoalProgressAction(goal.id, goal.progress, delta);
      if (!result.ok) setError(result.error);
    });
  }

  function handleCreate(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    setError(null);
    startTransition(async () => {
      const result = await createGoalAction(formData);
      if (!result.ok) setError(result.error);
    });
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setEditingId(null);
    startTransition(async () => {
      const result = await deleteGoalAction(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-faint">
        Metas do trimestre ({quarter})
      </h2>

      {goals.length === 0 && <p className="mb-3 text-[13px] text-muted">Nenhuma meta ainda.</p>}

      <ul className="flex flex-col gap-2.5">
        {goals.map((goal) => {
          const pct = goal.target ? Math.min((goal.progress / goal.target) * 100, 100) : null;
          return (
            <li key={goal.id}>
              {editingId === goal.id ? (
                <GoalEditRow
                  goal={goal}
                  onDone={() => setEditingId(null)}
                  onDelete={() => handleDelete(goal.id)}
                  onError={setError}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingId(goal.id)}
                    className="flex-1 truncate text-left text-[13px] text-ink transition-colors hover:text-rose-ink"
                  >
                    {goal.title}
                  </button>
                  <span className="shrink-0 text-[12px] tabular-nums text-faint">
                    {goal.progress}
                    {goal.target ? ` / ${goal.target}` : ""}
                  </span>
                  <button
                    onClick={() => handleBump(goal, 1)}
                    disabled={isPending}
                    className="shrink-0 rounded-control border border-line px-2 py-0.5 text-[12px] text-ink transition-colors hover:bg-canvas disabled:opacity-40"
                  >
                    +1
                  </button>
                </div>
              )}
              {pct !== null && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-rose" style={{ width: `${pct}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form action={handleCreate} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="quarter" value={quarter} />
        <input name="title" placeholder="+ Nova meta" aria-label="Titulo da meta" className={`flex-1 ${inputClass}`} />
        <input
          name="target"
          type="number"
          placeholder="alvo"
          aria-label="Valor alvo (opcional)"
          className={`w-20 ${inputClass}`}
        />
        <button
          type="submit"
          className="rounded-control bg-ink px-3 py-1.5 text-[12px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98]"
        >
          Adicionar
        </button>
      </form>

      {error && (
        <p className="mt-2 rounded-control border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-destructive">
          {error}
        </p>
      )}

      <GoalsSuggest existingTitles={goals.map((g) => g.title)} aiConfigured={aiConfigured} />
    </section>
  );
}

function GoalEditRow({
  goal,
  onDone,
  onDelete,
  onError,
}: {
  goal: Goal;
  onDone: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [target, setTarget] = useState(goal.target?.toString() ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      onError("O titulo nao pode ficar vazio.");
      return;
    }
    startTransition(async () => {
      const result = await updateGoalAction(goal.id, {
        title: trimmed,
        target: target.trim() ? Number(target) : null,
      });
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`flex-1 ${inputClass}`}
      />
      <input
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        type="number"
        className={`w-16 ${inputClass}`}
      />
      {confirmingDelete ? (
        <button onClick={onDelete} className="shrink-0 text-[12px] font-medium text-destructive">
          Confirmar?
        </button>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="shrink-0 text-[12px] text-faint transition-colors hover:text-destructive"
        >
          Excluir
        </button>
      )}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="shrink-0 rounded-control bg-ink px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
      >
        {isPending ? "..." : "Salvar"}
      </button>
      <button onClick={onDone} className="shrink-0 text-[12px] text-faint transition-colors hover:text-ink">
        Cancelar
      </button>
    </div>
  );
}
