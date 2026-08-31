import type { LibraryItem } from "./service";

// Parte pura da Biblioteca: busca e classificacao, sem banco.
//
// Vive separada de ./service.ts porque a tela filtra no cliente, e service.ts
// chega em `next/headers` pela cadeia do getWorkspaceId. Importar um VALOR dali
// dentro de um componente cliente compila, passa no lint e quebra em execucao —
// ja aconteceu uma vez, no /historico. `import type` some na compilacao e por
// isso o tipo acima e seguro.

// Um item "tem texto" quando ha trabalho de escrita dentro dele. E o que separa
// o acervo util da lista de titulos que nunca viraram nada.
export function temTexto(item: LibraryItem): boolean {
  return Boolean(item.script?.trim() || item.caption?.trim() || item.cta?.trim());
}

// Sem acento e sem caixa: procurar "cozinha" tem de achar "Cozinha", e procurar
// "modulo" tem de achar "módulo" — ela nao vai lembrar como digitou.
// U+0300 a U+036F e o bloco de acentos combinantes que o NFD separa das letras.
//
// Montado por RegExp a partir de uma string com escapes, e nao escrito como
// literal /[...]/: os caracteres do intervalo sao invisiveis: um literal
// deixaria dois bytes que ninguem consegue ler, revisar ou digitar de novo, e
// que qualquer ferramenta que reencode o arquivo pode comer em silencio.
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(ACENTOS, "").toLowerCase();
}

export function combina(item: LibraryItem, termo: string): boolean {
  const t = normalizar(termo.trim());
  if (!t) return true;

  const corpo = normalizar(
    [item.title, item.hook, item.script, item.caption, item.cta, item.pillarName, item.format]
      .filter(Boolean)
      .join(" "),
  );

  // Cada palavra precisa aparecer em algum lugar, nao necessariamente no mesmo
  // campo: "reel cozinha" acha um Reel cujo roteiro fala de cozinha.
  return t.split(/\s+/).every((p) => corpo.includes(p));
}
