// O ritmo de um cronograma: quantos conteudos caem em cada semana e qual o
// maior buraco entre dois.
//
// O plano de outubro trouxe 12 itens distribuidos 2, 3, 4, 2, 1 — a ultima
// semana quase vazia e 19 dias sem nada. A regra do prompt so dizia "nao
// empilhe tudo na primeira semana", que proibe um defeito e nao exige ritmo.
//
// Modulo puro: mede, nao conserta. Mover data mecanicamente quebraria o que
// tem motivo para estar no dia — o conteudo do Dia das Criancas precisa cair
// no dia 12, nao num dia vago.

export interface Semana {
  // 1 a 5. A ultima costuma ser parcial.
  numero: number;
  primeiroDia: number;
  ultimoDia: number;
  dias: number;
  itens: number;
}

export interface Ritmo {
  semanas: Semana[];
  total: number;
  // Maior sequencia de dias seguidos sem nenhum conteudo, dentro da janela que
  // o plano cobre. Nao conta o vazio antes do primeiro item nem depois do
  // ultimo: esses sao inicio e fim, nao buraco.
  maiorBuraco: number;
  // A semana mais fraca tem menos de 60% da densidade da mais cheia.
  //
  // Comparado por DIA disponivel, e nao por contagem bruta: a ultima semana de
  // outubro tinha 1 item e parecia o buraco do mes, mas sao tres dias — 0,33
  // por dia, mais denso que a primeira semana, com 2 itens em 7. Contar cabeca
  // fez eu mesmo acusar a semana errada.
  desequilibrado: boolean;
}

// Abaixo de 60% da densidade da semana mais cheia, a diferenca ja se ve no
// calendario. O plano real de outubro ficou em 50% (0,29 contra 0,57) — este
// corte existe para pegar aquele caso, e nao um numero escolhido a esmo.
const PROPORCAO_MINIMA = 0.6;

export function semanasDoMes(year: number, month: number): Omit<Semana, "itens">[] {
  const ultimo = new Date(year, month + 1, 0).getDate();
  const semanas: Omit<Semana, "itens">[] = [];

  for (let inicio = 1, n = 1; inicio <= ultimo; inicio += 7, n++) {
    const fim = Math.min(inicio + 6, ultimo);
    semanas.push({ numero: n, primeiroDia: inicio, ultimoDia: fim, dias: fim - inicio + 1 });
  }
  return semanas;
}

export function medirRitmo(
  dias: number[],
  year: number,
  month: number,
  // A partir de que dia o plano vale. No mes corrente o Diretor so propoe do
  // dia de hoje em diante, e cobrar ritmo dos dias que ja passaram seria
  // cobrar o impossivel.
  primeiroDiaValido = 1,
): Ritmo {
  const ultimo = new Date(year, month + 1, 0).getDate();

  const semanas: Semana[] = semanasDoMes(year, month)
    .map((s) => ({
      ...s,
      primeiroDia: Math.max(s.primeiroDia, primeiroDiaValido),
      itens: dias.filter((d) => d >= Math.max(s.primeiroDia, primeiroDiaValido) && d <= s.ultimoDia)
        .length,
    }))
    .map((s) => ({ ...s, dias: Math.max(s.ultimoDia - s.primeiroDia + 1, 0) }))
    .filter((s) => s.dias > 0);

  // Array.from e nao spread: o alvo do tsconfig nao itera Set direto (TS2802).
  const ordenados = Array.from(new Set(dias))
    .filter((d) => d >= primeiroDiaValido && d <= ultimo)
    .sort((a, b) => a - b);

  let maiorBuraco = 0;
  for (let i = 1; i < ordenados.length; i++) {
    maiorBuraco = Math.max(maiorBuraco, ordenados[i] - ordenados[i - 1] - 1);
  }

  // Densidade por dia disponivel, e nao contagem bruta.
  const densidades = semanas.map((s) => s.itens / s.dias);
  const cheia = Math.max(...densidades, 0);
  const fraca = Math.min(...densidades, Number.POSITIVE_INFINITY);

  return {
    semanas,
    total: ordenados.length,
    maiorBuraco,
    desequilibrado: semanas.length > 1 && cheia > 0 && fraca < cheia * PROPORCAO_MINIMA,
  };
}

// Frase pronta para a tela. Devolve null quando o ritmo esta bom — um aviso que
// aparece sempre deixa de ser aviso.
export function avisoDeRitmo(r: Ritmo): string | null {
  if (r.total === 0) return null;

  const problemas: string[] = [];

  if (r.desequilibrado) {
    const porSemana = r.semanas.map((s) => `s${s.numero}=${s.itens}`).join("  ");
    problemas.push(`o mes esta irregular (${porSemana})`);
  }
  if (r.maiorBuraco >= 5) {
    problemas.push(`ha ${r.maiorBuraco} dias seguidos sem nada`);
  }

  if (problemas.length === 0) return null;
  return `Ritmo: ${problemas.join(", e ")}. Vale pedir para redistribuir na conversa.`;
}
