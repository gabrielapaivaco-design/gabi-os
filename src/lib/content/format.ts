// Formato do conteudo: Reel, Carrossel, Stories, Foto unica.
//
// A coluna `contents.format` e texto livre — quem escreve nela e o planejador
// (via IA), o formulario do card e o seed. O resultado no banco real da Eisen
// Haus e o esperado de texto livre: "Reel" e "Reels" convivem, e ha um
// "Carrosel" com um esse so. Sao o mesmo formato escrito de tres jeitos.
//
// Isso nunca tinha aparecido porque o formato so era lido dentro do card, um de
// cada vez. No momento em que ele vira etiqueta no quadro, a inconsistencia
// fica na cara — e, pior, faria a mesma coisa parecer duas.
//
// Modulo puro, sem banco: da para testar cada variacao.

export type Formato = "reel" | "carrossel" | "stories" | "foto";

export const FORMATO_LABEL: Record<Formato, string> = {
  reel: "Reel",
  carrossel: "Carrossel",
  stories: "Stories",
  foto: "Foto",
};

// Cada variacao que ja existe no banco, mais as que a IA tende a produzir.
// Comparadas sem acento e sem caixa, entao "Foto Única" e "foto unica" caem no
// mesmo lugar.
const VARIACOES: Record<string, Formato> = {
  reel: "reel",
  reels: "reel",
  video: "reel",
  "video vertical": "reel",
  carrossel: "carrossel",
  carrosel: "carrossel",
  carousel: "carrossel",
  album: "carrossel",
  stories: "stories",
  story: "stories",
  storie: "stories",
  foto: "foto",
  "foto unica": "foto",
  "foto única": "foto",
  imagem: "foto",
  post: "foto",
  feed: "foto",
};

const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

function chave(s: string): string {
  return s
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Devolve null para vazio E para formato desconhecido. Sao coisas diferentes
// para quem escreve, mas iguais para a etiqueta: em ambos os casos ela nao tem
// o que afirmar, e afirmar errado e pior que nao afirmar.
export function normalizarFormato(bruto: string | null | undefined): Formato | null {
  if (!bruto) return null;
  const k = chave(bruto);
  if (!k) return null;

  const direto = VARIACOES[k];
  if (direto) return direto;

  // Ultimo recurso para texto composto ("Reel de bastidor", "Carrossel 5
  // slides"): a primeira palavra conhecida ganha. Verificado por palavra
  // inteira, senao "storyboard" viraria Stories.
  for (const palavra of k.split(" ")) {
    if (VARIACOES[palavra]) return VARIACOES[palavra];
  }
  return null;
}

export function formatoLabel(bruto: string | null | undefined): string | null {
  const f = normalizarFormato(bruto);
  return f ? FORMATO_LABEL[f] : null;
}
