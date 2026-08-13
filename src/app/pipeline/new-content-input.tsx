"use client";

import { useRef, useTransition } from "react";
import { createContentAction } from "./actions";

// Mesma logica de campo sem friccao da captura de Momento: um unico campo,
// sempre visivel, sem modal. So existe na coluna Ideia — todo conteudo novo
// nasce ali (Acontecimento -> Ideia -> Conteudo...).
export function NewContentInput() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    if (isPending) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    startTransition(async () => {
      await createContentAction(formData);
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleAction} className="mb-2">
      <input
        name="title"
        placeholder="+ Novo card"
        aria-label="Titulo do novo conteudo"
        disabled={isPending}
        className="w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-faint transition-colors focus:outline-none focus:ring-1 focus:ring-rose disabled:opacity-50"
      />
    </form>
  );
}
