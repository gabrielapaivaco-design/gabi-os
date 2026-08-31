"use client";

import { useMemo, useState } from "react";
import { Search, Copy, Check, Archive } from "lucide-react";
import type { LibraryItem } from "@/lib/library/service";
import { combina, temTexto } from "@/lib/library/filter";
import { STATUS_LABEL } from "@/lib/utils/constants";
import type { ContentStatus } from "@/types/db";

// Acervo navegavel. Filtra no cliente de proposito: o volume e de dezenas de
// itens, e a busca instantanea a cada tecla vale mais do que economizar uma
// consulta. Se um dia passar de alguns milhares, isso vira busca no banco.

function data(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).format(
    new Date(iso),
  );
}

type Aba = "tudo" | "texto" | "arquivados";

export function LibraryBrowser({ items }: { items: LibraryItem[] }) {
  const [termo, setTermo] = useState("");
  const [aba, setAba] = useState<Aba>("tudo");
  const [aberto, setAberto] = useState<string | null>(null);

  const arquivados = useMemo(() => items.filter((i) => i.archived).length, [items]);

  const visiveis = useMemo(() => {
    // Arquivado nao aparece junto com o ativo: ele foi tirado de circulacao de
    // proposito, e misturar os dois refaria a bagunca que a virada de mes
    // desfez. Ele tem aba propria.
    const base =
      aba === "arquivados"
        ? items.filter((i) => i.archived)
        : items.filter((i) => !i.archived && (aba === "tudo" || temTexto(i)));

    return base.filter((i) => combina(i, termo));
  }, [items, aba, termo]);

  const abas: { id: Aba; label: string; n: number }[] = [
    { id: "tudo", label: "Tudo", n: items.filter((i) => !i.archived).length },
    { id: "texto", label: "Com texto", n: items.filter((i) => !i.archived && temTexto(i)).length },
    { id: "arquivados", label: "Arquivados", n: arquivados },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar em titulo, roteiro, legenda, hook, pilar..."
            className="w-full rounded-control border border-line bg-surface py-2.5 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-rose"
          />
        </label>

        <div className="flex items-center gap-1">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`rounded-control px-3 py-1.5 text-[12px] transition-colors ${
                aba === a.id ? "bg-surface font-medium text-ink" : "text-faint hover:text-ink"
              }`}
            >
              {a.label} <span className="text-faint">{a.n}</span>
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-card bg-surface p-5 text-[13px] leading-relaxed text-muted">
          {termo.trim()
            ? `Nada encontrado para "${termo.trim()}".`
            : aba === "arquivados"
              ? "Nada arquivado ainda. Conteudo aposentado na virada de mes aparece aqui, com o texto inteiro."
              : "Nada por aqui ainda."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((i) => (
            <Item
              key={i.id}
              item={i}
              aberto={aberto === i.id}
              onToggle={() => setAberto(aberto === i.id ? null : i.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({
  item,
  aberto,
  onToggle,
}: {
  item: LibraryItem;
  aberto: boolean;
  onToggle: () => void;
}) {
  const escrito = temTexto(item);
  const quando = item.publishedAt ?? item.plannedAt ?? item.createdAt;

  return (
    <li className="rounded-card bg-surface">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-snug text-ink">{item.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-wide text-faint">
            {item.archived && (
              <span className="inline-flex items-center gap-1 text-muted">
                <Archive size={10} /> arquivado
              </span>
            )}
            <span>{STATUS_LABEL[item.status as ContentStatus] ?? item.status}</span>
            {item.format && <span>· {item.format}</span>}
            {item.pillarName && <span>· {item.pillarName}</span>}
            {quando && <span>· {data(quando)}</span>}
          </span>
        </span>
        <span className="shrink-0 pt-0.5 text-[11px] text-faint">
          {escrito ? (aberto ? "fechar" : "ver texto") : "sem texto"}
        </span>
      </button>

      {aberto && escrito && (
        <div className="flex flex-col gap-4 border-t border-line px-4 pb-4 pt-4">
          {item.hook && <Bloco titulo="Hook" texto={item.hook} />}
          {item.script && <Bloco titulo="Roteiro" texto={item.script} />}
          {item.caption && <Bloco titulo="Legenda" texto={item.caption} />}
          {item.cta && <Bloco titulo="CTA" texto={item.cta} />}
        </div>
      )}
    </li>
  );
}

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      // Area de transferencia negada pelo navegador (contexto inseguro ou
      // permissao). O texto continua na tela, selecionavel — falhar em silencio
      // aqui e melhor que um alerta para algo que ela resolve com Ctrl+C.
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
          {titulo}
        </h3>
        <button
          onClick={copiar}
          className="flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-rose-ink"
        >
          {copiado ? <Check size={11} /> : <Copy size={11} />}
          {copiado ? "copiado" : "copiar"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{texto}</p>
    </div>
  );
}
