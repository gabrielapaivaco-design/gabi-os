import type { StoredExternalPost, StoredMetric } from "./service";

// Leitura dos numeros. Modulo puro: recebe os posts ja carregados e devolve o
// que a tela mostra. Sem banco e sem rede, entao cada regra abaixo tem teste.
//
// Uma decisao atravessa o arquivo inteiro: `null` e "nao sei", nunca zero. Um
// post sem alcance coletado nao entra na conta — se entrasse como zero, puxaria
// toda media para baixo e a tela mentiria com numero preciso.

export interface Estatistica {
  // A mediana vem primeiro de proposito. Numa conta pequena, dois posts que
  // estouram levantam a media acima de quase tudo que ela publica: a media do
  // alcance da Eisen Haus e ~1.200 e a mediana ~700, e e a mediana que descreve
  // o post tipico. A media fica ao lado porque a diferenca entre as duas e ela
  // propria um dado — mede o quanto a conta depende de picos.
  mediana: number;
  media: number;
  total: number;
  melhor: number;
  pior: number;
  amostra: number;
}

export interface PostLido extends StoredExternalPost {
  // Alcance dividido pela mediana. 1 e o post tipico; 2 alcancou o dobro do
  // normal. Numero relativo porque "740 de alcance" nao diz nada sozinho.
  vezesAMediana: number | null;
  // Interacoes sobre alcance. So calculado quando ha alcance e ao menos uma
  // interacao conhecida.
  engajamento: number | null;
}

export interface PorFormato {
  formato: string;
  posts: number;
  medianaAlcance: number | null;
  medianaEngajamento: number | null;
}

export interface Leitura {
  posts: number;
  comMetrica: number;
  conciliados: number;
  periodo: { de: string; ate: string } | null;
  alcance: Estatistica | null;
  engajamento: Estatistica | null;
  porFormato: PorFormato[];
  melhores: PostLido[];
  piores: PostLido[];
  todos: PostLido[];
}

export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 === 0
    ? (ordenado[meio - 1] + ordenado[meio]) / 2
    : ordenado[meio];
}

export function estatistica(valores: number[]): Estatistica | null {
  if (valores.length === 0) return null;
  return {
    mediana: mediana(valores),
    media: valores.reduce((s, v) => s + v, 0) / valores.length,
    total: valores.reduce((s, v) => s + v, 0),
    melhor: Math.max(...valores),
    pior: Math.min(...valores),
    amostra: valores.length,
  };
}

// Curtida + comentario + compartilhamento + salvamento, sobre alcance.
//
// Soma so o que foi coletado: um provedor que nao devolve salvamento nao pode
// baixar a taxa de quem salva bem. Devolve null quando nao ha alcance ou quando
// nenhuma interacao e conhecida — o contrario seria dizer "0% de engajamento"
// para um post do qual nao sabemos nada.
export function taxaEngajamento(m: StoredMetric | null): number | null {
  if (!m || !m.reach || m.reach <= 0) return null;

  const partes = [m.likes, m.comments, m.shares, m.saves].filter(
    (v): v is number => typeof v === "number",
  );
  if (partes.length === 0) return null;

  return partes.reduce((s, v) => s + v, 0) / m.reach;
}

// Nome do formato como ela fala, nao como a API devolve.
const FORMATO_LABEL: Record<string, string> = {
  REELS: "Reel",
  REEL: "Reel",
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carrossel",
  CAROUSEL: "Carrossel",
  FEED: "Foto unica",
  IMAGE: "Foto unica",
  STORY: "Story",
};

export function formatoLabel(mediaType: string | null): string {
  if (!mediaType) return "Sem formato";
  return FORMATO_LABEL[mediaType.toUpperCase()] ?? mediaType;
}

export function lerPosts(posts: StoredExternalPost[]): Leitura {
  const alcances = posts
    .map((p) => p.metrics?.reach)
    .filter((v): v is number => typeof v === "number");

  const alcance = estatistica(alcances);
  const medianaAlcance = alcance?.mediana ?? 0;

  const todos: PostLido[] = posts.map((p) => {
    const r = p.metrics?.reach;
    return {
      ...p,
      vezesAMediana:
        typeof r === "number" && medianaAlcance > 0 ? r / medianaAlcance : null,
      engajamento: taxaEngajamento(p.metrics),
    };
  });

  const engajamentos = todos
    .map((p) => p.engajamento)
    .filter((v): v is number => typeof v === "number");

  // Ordenar por alcance so faz sentido entre quem tem alcance. Os demais ficam
  // fora do ranking em vez de ocuparem o fim dele como se tivessem ido mal.
  const comAlcance = todos
    .filter((p) => typeof p.metrics?.reach === "number")
    .sort((a, b) => (b.metrics?.reach ?? 0) - (a.metrics?.reach ?? 0));

  const datas = posts
    .map((p) => p.publishedAt)
    .filter((d): d is string => Boolean(d))
    .sort();

  return {
    posts: posts.length,
    comMetrica: alcances.length,
    conciliados: posts.filter((p) => p.contentId).length,
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
    alcance,
    engajamento: estatistica(engajamentos),
    porFormato: agruparPorFormato(todos),
    // Tres e cada ponta, e so quando ha ranking suficiente para as pontas serem
    // diferentes uma da outra. Com quatro posts, "os 3 melhores" e quase a lista
    // inteira e o recorte nao ensina nada.
    melhores: comAlcance.length >= 6 ? comAlcance.slice(0, 3) : [],
    piores: comAlcance.length >= 6 ? comAlcance.slice(-3).reverse() : [],
    todos: comAlcance.length ? [...comAlcance, ...todos.filter((p) => !comAlcance.includes(p))] : todos,
  };
}

function agruparPorFormato(posts: PostLido[]): PorFormato[] {
  const grupos = new Map<string, PostLido[]>();
  for (const p of posts) {
    const f = formatoLabel(p.mediaType);
    grupos.set(f, [...(grupos.get(f) ?? []), p]);
  }

  // Array.from e nao spread: o alvo do tsconfig nao permite iterar um Map
  // diretamente (TS2802), e o spread perderia os tipos no caminho.
  return Array.from(grupos.entries())
    .map(([formato, lista]) => {
      const alc = lista
        .map((p) => p.metrics?.reach)
        .filter((v): v is number => typeof v === "number");
      const eng = lista
        .map((p) => p.engajamento)
        .filter((v): v is number => typeof v === "number");
      return {
        formato,
        posts: lista.length,
        medianaAlcance: alc.length ? mediana(alc) : null,
        medianaEngajamento: eng.length ? mediana(eng) : null,
      };
    })
    .sort((a, b) => (b.medianaAlcance ?? -1) - (a.medianaAlcance ?? -1));
}
