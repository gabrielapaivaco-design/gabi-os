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

function pontuar(c: CandidatoConteudo, p: CandidatoPost): { score: number; motivo: string } {
  const diaConteudo = diaDe(c.publishedAt ?? c.plannedAt);
  const diaPost = diaDe(p.publishedAt);

  let porData = 0;
  let notaData = "";
  if (diaConteudo && diaPost) {
    const d = distanciaEmDias(diaConteudo, diaPost);
    // A data e o sinal mais forte: publicar e um evento com hora marcada, e a
    // pessoa raramente erra o dia em mais de um ou dois.
    if (d === 0) [porData, notaData] = [0.6, "mesmo dia"];
    else if (d === 1) [porData, notaData] = [0.4, "um dia de diferenca"];
    else if (d <= 3) [porData, notaData] = [0.2, `${d} dias de diferenca`];
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
