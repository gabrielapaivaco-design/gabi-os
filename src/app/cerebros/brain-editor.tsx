"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { BrainKind } from "@/types/db";
import type { BrainContent } from "@/lib/brains/service";
import { saveBrainAction } from "./actions";

interface Section {
  id: number;
  title: string;
  body: string;
}

const inputClass =
  "w-full rounded-control border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose";

export function BrainEditor({
  kind,
  label,
  description,
  content,
  suggestedSections,
}: {
  kind: BrainKind;
  label: string;
  description: string;
  content: BrainContent;
  suggestedSections: string[];
}) {
  // Um Cerebro vazio abre com os titulos sugeridos ja no lugar, para a usuaria
  // ter por onde comecar em vez de encarar uma tela em branco.
  const [sections, setSections] = useState<Section[]>(() => {
    const entries = Object.entries(content);
    if (entries.length > 0) {
      return entries.map(([title, body], i) => ({ id: i, title, body }));
    }
    return suggestedSections.map((title, i) => ({ id: i, title, body: "" }));
  });
  const [nextId, setNextId] = useState(() => Math.max(sections.length, suggestedSections.length));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function update(id: number, patch: Partial<Section>) {
    setSaved(false);
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSaved(false);
    setSections((prev) => [...prev, { id: nextId, title: "", body: "" }]);
    setNextId((n) => n + 1);
  }

  function removeSection(id: number) {
    setSaved(false);
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSave() {
    setError(null);
    const payload: BrainContent = {};
    for (const section of sections) {
      const title = section.title.trim();
      const body = section.body.trim();
      if (title && body) payload[title] = body;
    }

    startTransition(async () => {
      const result = await saveBrainAction(kind, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  const filledCount = sections.filter((s) => s.title.trim() && s.body.trim()).length;

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">{label}</h2>
        <span className="text-[11px] text-faint">
          {filledCount === 0 ? "vazio" : `${filledCount} secoes`}
        </span>
      </div>
      <p className="mb-4 text-[12px] text-muted">{description}</p>

      <div className="flex flex-col gap-3">
        {sections.map((section) => (
          <div key={section.id} className="rounded-card border border-line bg-canvas p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <input
                value={section.title}
                onChange={(e) => update(section.id, { title: e.target.value })}
                placeholder="Titulo da secao"
                aria-label="Titulo da secao"
                className="flex-1 bg-transparent text-[12px] font-medium uppercase tracking-wide text-faint focus:text-ink focus:outline-none"
              />
              <button
                onClick={() => removeSection(section.id)}
                aria-label={`Remover secao ${section.title || "sem titulo"}`}
                className="shrink-0 text-faint transition-colors hover:text-destructive"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <textarea
              value={section.body}
              onChange={(e) => update(section.id, { body: e.target.value })}
              rows={3}
              placeholder="Escreva aqui..."
              aria-label={`Conteudo de ${section.title || "secao sem titulo"}`}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={addSection}
          className="flex items-center gap-1 text-[13px] text-faint transition-colors hover:text-ink"
        >
          <Plus size={13} /> Nova secao
        </button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-[12px] text-muted">Salvo</span>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-control border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
