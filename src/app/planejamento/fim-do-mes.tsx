import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { monthLabel } from "@/lib/calendar/month";

// Quando o mes que a tela mostra esta acabando, o cronograma que falta e o do
// mes seguinte — e ate agora ele estava atras de uma seta de 16 pixels.
//
// Sem isto, gerar no dia 30 produzia um plano de dois itens, os dois no dia 30,
// e parecia que o sistema tinha quebrado. Nao tinha: o Diretor recebe "restam 1
// dias no mes" e propoe o que cabe em um dia. O erro era a tela deixar ela
// pedir a coisa errada sem avisar.

// Cinco dias: abaixo disso nao da para distribuir conteudo com respiro, e
// qualquer plano sai apertado no fim do mes.
const DIAS_DE_SOBRA = 5;

export function diasRestantesNoMes(hoje: Date): number {
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return ultimo - hoje.getDate() + 1;
}

export function FimDoMes({
  hoje,
  proximo,
  href,
}: {
  hoje: Date;
  proximo: { year: number; month: number };
  href: string;
}) {
  const restantes = diasRestantesNoMes(hoje);
  if (restantes > DIAS_DE_SOBRA) return null;

  return (
    <section className="mb-5 rounded-card border border-rose/30 bg-rose-tint/40 p-5">
      <h2 className="font-serif text-[21px] leading-tight text-ink">
        {monthLabel(hoje.getFullYear(), hoje.getMonth())} acaba{" "}
        {restantes === 1 ? "hoje" : `em ${restantes} dias`}
      </h2>
      <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted">
        Gerar o cronograma deste mes agora rende{" "}
        {restantes === 1 ? "um plano de um dia so" : `um plano de ${restantes} dias`} — o Diretor
        so propoe para os dias que ainda nao passaram. O cronograma que falta e o de{" "}
        <span className="capitalize">{monthLabel(proximo.year, proximo.month)}</span>.
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-ink px-3.5 py-2 text-[13px] font-medium text-white transition-transform duration-150 ease-premium active:scale-[0.98]"
      >
        Planejar <span className="capitalize">{monthLabel(proximo.year, proximo.month)}</span>
        <ArrowRight size={13} />
      </Link>
    </section>
  );
}
