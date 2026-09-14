import { normalizar } from "@/lib/library/filter";

// Sugestao de conciliacao: qual post externo provavelmente e qual conteudo.
//
// Ate agora conciliar era comparar duas listas com o olho e clicar duas vezes.
// Com quatro posts isso e chato; com quarenta ninguem faz — e o ciclo de
// aprendizado depende justamente de alguem fazer.
//
// Modulo puro: recebe as duas listas e devolve pares propostos. Nao vincula
// nada. A confirmacao continua sendo dela, porque so ela sabe se o video e o
// mesmo — o sistema so sabe que a data e o assunto batem.

export interface CandidatoConteudo {
  id: string;
  title: string;
  hook: string | null;
  plannedAt: string | null;
  publishedAt: string | null;
}

export interface CandidatoPost {
  id: string;
  caption: string | null;
  publishedAt: string | null;
  contentId: string | null;
}

export interface Sugestao {
  contentId: string;
  postId: string;
  score: number;
  motivo: string;
}

// Abaixo disto a sugestao atrapalha mais do que ajuda: propor um par errado
// custa mais caro que nao propor nada, porque convida a um clique errado.
const CORTE = 0.3;

function diaDe(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function distanciaEmDias(a: string, b: string): number {
  const ms = Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime());
  return Math.round(ms / 86_400_000);
}

// Palavras com menos de quatro letras sao quase todas ligacao ("de", "para",
// "com") e apareceriam em qualquer par, inflando toda semelhanca. Hashtag sai
// junto: "#fyp" nao diz do que o post trata.
function palavras(texto: string | null): Set<string> {
  if (!texto) return new Set();
  return new Set(
    normalizar(texto)
      .replace(/#\S+/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4),
  );
}

function semelhanca(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  // Array.from e nao `for..of` direto: o alvo do tsconfig nao permite iterar um
  // Set (TS2802).
  let comuns = 0;
  for (const p of Array.from(a)) if (b.has(p)) comuns++;
  // Sobre o menor dos dois: uma legenda longa nao deve ser punida por ter mais
  // palavras que o titulo curto com que ela combina.
  return comuns / Math.min(a.size, b.size);
}

function pontuarData(d: number): { score: number; nota: string } {
  // A data e o sinal mais forte: publicar e um evento com hora marcada, e a
  // pessoa raramente erra o dia em mais de um ou dois.
  if (d === 0) return { score: 0.6, nota: "mesmo dia" };
  if (d === 1) return { score: 0.4, nota: "um dia de diferenca" };
  if (d <= 3) return { score: 0.2, nota: `${d} dias de diferenca` };
  return { score: 0, nota: "" };
}

function pontuar(c: CandidatoConteudo, p: CandidatoPost): { score: number; motivo: string } {
  const diaPost = diaDe(p.publishedAt);

  // As DUAS datas do conteudo concorrem, e vale a que chegar mais perto.
  //
  // `published_at` e a hora em que ela clicou "publicado" no sistema — e isso
  // costuma acontecer dias depois de o post ir ao ar, numa sentada de
  // organizar. Aconteceu de verdade: o post saiu no dia 10, que era a data
  // planejada; ela marcou publicado no dia 14. Olhando so a publicacao, o par
  // mais obvio da tela ficou sem sugestao.
  let porData = 0;
  let notaData = "";
  if (diaPost) {
    for (const dia of [c.publishedAt, c.plannedAt].map(diaDe)) {
      if (!dia) continue;
      const r = pontuarData(distanciaEmDias(dia, diaPost));
      if (r.score > porData) [porData, notaData] = [r.score, r.nota];
    }
  }

  const porTexto = semelhanca(palavras(`${c.title} ${c.hook ?? ""}`), palavras(p.caption));
  const notaTexto = porTexto >= 0.25 ? "assunto parecido" : "";

  const motivo = [notaData, notaTexto].filter(Boolean).join(", ");
  return { score: porData + porTexto * 0.4, motivo: motivo || "poucas pistas" };
}

// Um post so pode pertencer a um conteudo, e vice-versa. Sem essa exclusividade
// o mesmo post apareceria sugerido em tres conteudos diferentes e a tela
// passaria a mentir tres vezes em vez de ajudar uma.
export function sugerirVinculos(
  contents: CandidatoConteudo[],
  posts: CandidatoPost[],
): Sugestao[] {
  const livres = posts.filter((p) => !p.contentId);

  const todos: Sugestao[] = [];
  for (const c of contents) {
    for (const p of livres) {
      const { score, motivo } = pontuar(c, p);
      if (score >= CORTE) todos.push({ contentId: c.id, postId: p.id, score, motivo });
    }
  }

  // Guloso pelo melhor par primeiro: o par mais obvio da tela e decidido antes,
  // e nao perde o post para um palpite pior que so foi avaliado primeiro.
  todos.sort((a, b) => b.score - a.score || a.postId.localeCompare(b.postId));

  const usados = new Set<string>();
  const escolhidas: Sugestao[] = [];
  for (const s of todos) {
    if (usados.has(s.contentId) || usados.has(s.postId)) continue;
    usados.add(s.contentId);
    usados.add(s.postId);
    escolhidas.push(s);
  }

  return escolhidas;
}
