// Que tipo de abertura cada post usou, e quanto cada tipo rendeu NESTA conta.
//
// O Diretor ja recebia os posts publicados com os numeros. Faltava a leitura:
// ele via "1.011 de alcance" e "162 de alcance" sem nada dizendo o que separava
// os dois. E o que separava estava na primeira linha.
//
// Isto nao e conselho generico de marketing. E a conta dela virando evidencia:
// no dia 24 de setembro sairam dois posts com 23 minutos de diferenca, um
// abrindo com pergunta e outro descrevendo, e a diferenca foi de seis vezes.
//
// Modulo puro, para cada regra ter teste.

export type Abertura = "pergunta" | "contradicao" | "numero" | "lista" | "marca" | "descricao";

export const ABERTURA_LABEL: Record<Abertura, string> = {
  pergunta: "Pergunta",
  contradicao: "Contradicao",
  numero: "Numero concreto",
  lista: "Lista de servicos",
  marca: "Saudacao ou nome da marca",
  descricao: "Descricao",
};

const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

function semAcento(s: string): string {
  return s.normalize("NFD").replace(ACENTOS, "").toLowerCase();
}

// Só a primeira linha com texto: é ela que aparece antes do "mais" e é ela que
// decide se a pessoa para. O resto da legenda só é lido por quem já parou.
// Uma linha e enfeite quando todo pedaco dela e hashtag ou emoji. Verificado
// por token, e nao por regex sobre a linha inteira: as letras DENTRO da
// hashtag sao letras comuns, entao "#fyp #viral" passaria por texto.
// "Tem letra ou numero" em vez de "e emoji": as classes unicode do regex
// exigem a flag `u`, que o alvo deste tsconfig nao aceita. O intervalo cobre o
// latim acentuado, entao "construção" conta como palavra e "☀️" nao.
const TEM_PALAVRA = /[a-z0-9À-ɏ]/i;

function soEnfeite(linha: string): boolean {
  const tokens = linha.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => t.startsWith("#") || !TEM_PALAVRA.test(t));
}

export function primeiraLinha(caption: string | null): string {
  if (!caption) return "";
  for (const linha of caption.split("\n")) {
    const t = linha.trim();
    if (t && !soEnfeite(t)) return t;
  }
  return "";
}

const SAUDACOES = [
  "bom dia", "boa tarde", "boa noite", "oi ", "ola", "fala ", "e ai",
  "vem comigo", "olha so", "voce sabia", "neste video", "nesse video",
];

export function classificarAbertura(caption: string | null, marca?: string): Abertura {
  const linha = primeiraLinha(caption);
  if (!linha) return "descricao";
  const s = semAcento(linha);

  // Pergunta primeiro: e o sinal mais forte e o mais inequivoco. Vale mesmo
  // quando a frase tambem tem numero ou nome da marca.
  if (linha.includes("?")) return "pergunta";

  // Abre com saudacao ou com o nome da propria empresa — quem nao conhece a
  // marca nao para por nenhum dos dois.
  if (SAUDACOES.some((g) => s.startsWith(g))) return "marca";
  if (marca && s.startsWith(semAcento(marca))) return "marca";

  // Contradicao: nega uma coisa e afirma outra na mesma frase.
  if (/\bnao e\b.*\be\b|\bnao\b.*\bmas\b|\bnem\b.*\bnem\b/.test(s)) return "contradicao";

  // Tres ou mais itens curtos separados por virgula: a lista de servicos, que
  // foi o pior alcance da conta.
  const itens = linha.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  if (itens.length >= 3 && itens.every((p) => p.split(/\s+/).length <= 4)) return "lista";

  // Numero concreto na abertura, e nao um numero qualquer perdido na frase.
  if (/^\D{0,18}\d/.test(s)) return "numero";

  return "descricao";
}

export interface DesempenhoDaAbertura {
  abertura: Abertura;
  posts: number;
  medianaAlcance: number | null;
  exemplo: string | null;
}

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

// Agrupa os posts por tipo de abertura. Ordena do que mais alcanca para o que
// menos, que e a ordem em que a informacao e util.
export function desempenhoPorAbertura(
  posts: { caption: string | null; reach: number | null }[],
  marca?: string,
): DesempenhoDaAbertura[] {
  const grupos = new Map<Abertura, { reach: number[]; exemplo: string | null }>();

  for (const p of posts) {
    const a = classificarAbertura(p.caption, marca);
    const g = grupos.get(a) ?? { reach: [], exemplo: null };
    if (typeof p.reach === "number") g.reach.push(p.reach);
    if (!g.exemplo) g.exemplo = primeiraLinha(p.caption) || null;
    grupos.set(a, g);
  }

  return Array.from(grupos.entries())
    .map(([abertura, g]) => ({
      abertura,
      posts: g.reach.length,
      medianaAlcance: g.reach.length ? mediana(g.reach) : null,
      exemplo: g.exemplo,
    }))
    .sort((a, b) => (b.medianaAlcance ?? -1) - (a.medianaAlcance ?? -1));
}
