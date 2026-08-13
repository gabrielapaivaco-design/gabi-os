"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { signInAction, signUpAction } from "./actions";

type Mode = "entrar" | "criar";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("entrar");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const action = mode === "entrar" ? signInAction : signUpAction;
      // Em caso de sucesso a action redireciona e nada volta daqui.
      const result = await action(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[340px]"
    >
      <h1 className="text-lg font-medium tracking-tight text-ink">Gabi OS</h1>
      <p className="mt-1 text-[13px] text-muted">
        {mode === "entrar"
          ? "Entre para acessar seus workspaces."
          : "Crie sua conta para comecar."}
      </p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-faint">E-mail</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            className="w-full rounded-control border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-faint">Senha</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            required
            minLength={6}
            className="w-full rounded-control border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-rose"
          />
        </label>

        {error && (
          <p className="rounded-control border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] leading-relaxed text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 rounded-control bg-ink px-3.5 py-2.5 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-50"
        >
          {isPending
            ? mode === "entrar"
              ? "Entrando..."
              : "Criando..."
            : mode === "entrar"
              ? "Entrar"
              : "Criar conta"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "entrar" ? "criar" : "entrar");
          setError(null);
        }}
        className="mt-5 text-[12px] text-faint transition-colors hover:text-ink"
      >
        {mode === "entrar" ? "Ainda nao tenho conta" : "Ja tenho conta"}
      </button>
    </motion.div>
  );
}
