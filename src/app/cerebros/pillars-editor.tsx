"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, X } from "lucide-react";
import type { Pillar } from "@/lib/pillars/service";
import { PILLAR_COLORS, resolvePillarColor } from "@/lib/utils/constants";
import { createPillarAction, deletePillarAction, updatePillarAction } from "./actions";

// Editor de pilares. Ate agora eles so nasciam de migration — esta e a primeira
// tela que os cria.
//
// Fica em Cerebros porque pilar e identidade, nao configuracao: e a resposta a
// "sobre o que essa marca fala", ao lado de voz, publico e o que ja funcionou.

export function PillarsEditor({ pillars }: { pillars: Pillar[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  function agir(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, depois?: () => void) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setErro(r.error);
      depois?.();
      router.refresh();
    });
  }

  return (
    <section className="rounded-card bg-surface p-5">
      <h2 className="font-serif text-[21px] font-light leading-tight text-ink">Pilares</h2>
      <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted">
        Os assuntos recorrentes da marca. Sao o que permite ao Diretor sair de{" "}
        <em>&ldquo;Reel funciona&rdquo;</em> e chegar em{" "}
        <em>&ldquo;Reel de bastidor funciona, Reel de venda nao&rdquo;</em> — que e a parte que
        muda decisao.
      </p>

      {pillars.length === 0 && (
        <p className="mt-4 rounded-control bg-rose-tint px-3.5 py-2.5 text-[12.5px] leading-relaxed text-rose-ink">
          Este workspace ainda nao tem nenhum pilar. Enquanto nao tiver, toda analise por assunto
          fica indisponivel — os numeros existem, mas nao se agrupam por nada.
        </p>
      )}

      <ul className="mt-4 flex flex-col">
        {pillars.map((p) => (
          <li key={p.id} className="border-b border-line py-2.5 first:border-t">
            {editando === p.id ? (
              <LinhaEditando
                pilar={p}
                pendente={isPending}
                onCancelar={() => setEditando(null)}
                onSalvar={(campos) => agir(() => updatePillarAction(p.id, campos), () => setEditando(null))}
              />
            ) : confirmando === p.id ? (
              <LinhaConfirmando
                pilar={p}
                pendente={isPending}
                onCancelar={() => setConfirmando(null)}
                onRemover={() => agir(() => deletePillarAction(p.id), () => setConfirmando(null))}
              />
            ) : (
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: resolvePillarColor(p.color) }}
                />
                <button
                  onClick={() => setEditando(p.id)}
                  className="min-w-0 flex-1 text-left text-[14px] text-ink"
                >
                  {p.name}
                </button>
                <span className="shrink-0 text-[11px] text-faint">
                  {p.usos === 0 ? "sem uso" : `${p.usos} ${p.usos === 1 ? "conteudo" : "conteudos"}`}
                </span>
                <button
                  onClick={() => setConfirmando(p.id)}
                  aria-label={`Remover ${p.name}`}
                  className="shrink-0 p-1 text-faint transition-colors hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!novo.trim()) return;
          agir(() => createPillarAction(novo), () => setNovo(""));
        }}
        className="mt-4 flex items-center gap-2"
      >
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Novo pilar"
          disabled={isPending}
          className="min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-rose"
        />
        <button
          type="submit"
          disabled={isPending || !novo.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98] disabled:opacity-40"
        >
          <Plus size={13} /> Adicionar
        </button>
      </form>

      {erro && <p className="mt-3 text-[12px] text-destructive">{erro}</p>}
    </section>
  );
}

function LinhaEditando({
  pilar,
  pendente,
  onSalvar,
  onCancelar,
}: {
  pilar: Pillar;
  pendente: boolean;
  onSalvar: (campos: { name: string; color: string }) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(pilar.name);
  const [cor, setCor] = useState(pilar.color);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoFocus
        disabled={pendente}
        className="min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 py-1.5 text-[13px] text-ink outline-none focus:border-rose"
      />
      <div className="flex items-center gap-1">
        {PILLAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCor(c)}
            aria-label={`Cor ${c}`}
            className={`h-4 w-4 rounded-full transition-transform ${
              cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "hover:scale-110"
            }`}
            style={{ backgroundColor: resolvePillarColor(c) }}
          />
        ))}
      </div>
      <button
        onClick={() => onSalvar({ name: nome, color: cor })}
        disabled={pendente || !nome.trim()}
        className="rounded-control p-1.5 text-faint transition-colors hover:text-rose-ink disabled:opacity-40"
        aria-label="Salvar"
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancelar}
        disabled={pendente}
        className="rounded-control p-1.5 text-faint transition-colors hover:text-ink"
        aria-label="Cancelar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function LinhaConfirmando({
  pilar,
  pendente,
  onRemover,
  onCancelar,
}: {
  pilar: Pillar;
  pendente: boolean;
  onRemover: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* O aviso diz o que acontece com os conteudos, nao so "tem certeza?".
          A chave e `on delete set null`: eles sobrevivem sem classificacao. */}
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted">
        Remover <strong className="text-ink">{pilar.name}</strong>?{" "}
        {pilar.usos > 0
          ? `${pilar.usos} ${pilar.usos === 1 ? "conteudo continua" : "conteudos continuam"} existindo, mas ${pilar.usos === 1 ? "fica" : "ficam"} sem pilar.`
          : "Nenhum conteudo usa este pilar."}
      </p>
      <span className="flex shrink-0 items-center gap-3">
        <button
          onClick={onRemover}
          disabled={pendente}
          className="rounded-control bg-destructive px-3 py-1.5 text-[12px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Remover
        </button>
        <button
          onClick={onCancelar}
          disabled={pendente}
          className="text-[12px] text-faint transition-colors hover:text-ink"
        >
          Cancelar
        </button>
      </span>
    </div>
  );
}
