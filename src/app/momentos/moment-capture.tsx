"use client";

import { useEffect, useRef, useTransition } from "react";
import { createMomentAction } from "./actions";

// Campo sem friccao: uma unica caixa de texto, sem titulo nem metadados.
// Atalhos: "N" foca o campo de qualquer lugar da pagina; Ctrl/Cmd+Enter registra.
export function MomentCapture() {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const hasModifier = e.metaKey || e.ctrlKey || e.altKey;
      if (!isTyping && !hasModifier && e.key.toLowerCase() === "n") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isPending) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleAction(formData: FormData) {
    if (isPending) return;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    startTransition(async () => {
      await createMomentAction(formData);
      formRef.current?.reset();
      textareaRef.current?.focus();
    });
  }

  return (
    <form ref={formRef} action={handleAction} className="mb-8">
      <textarea
        ref={textareaRef}
        name="body"
        rows={2}
        autoFocus
        aria-label="O que aconteceu?"
        placeholder="O que aconteceu?"
        onKeyDown={handleTextareaKeyDown}
        className="w-full resize-none rounded-card border border-line bg-surface p-4 text-sm text-ink placeholder:text-faint transition-colors focus:outline-none focus:ring-1 focus:ring-rose"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-faint">Ctrl+Enter registra &middot; N foca aqui</span>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Registrando..." : "Registrar Momento"}
        </button>
      </div>
    </form>
  );
}
