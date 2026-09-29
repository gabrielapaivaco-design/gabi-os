// Rede contra proposta repetida.
//
// O prompt manda o Diretor conferir o que ja existe antes de propor, e isso
// resolve a maioria dos casos. Mas regra de prompt e pedido, nao garantia: uma
// vez que o modelo escorrega, o card duplicado entra no Pipeline e sai de la
// so na mao. Esta funcao e a parte que nao depende de ninguem obedecer.
//
// Modulo puro: a mesma medida de semelhanca da conciliacao, aplicada a titulos.

const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

// Palavras de tres letras ou menos sao quase todas ligacao ("de", "que", "um")
// e apareceriam em qualquer par, inflando toda semelhanca.
function palavras(texto: string): Set<string> {
  return new Set(
    texto
      .normalize("NFD")
      .replace(ACENTOS, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length > 3),
  );
}

export function semelhancaDeTitulo(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;

  let comuns = 0;
  for (const p of Array.from(pa)) if (pb.has(p)) comuns++;

  // Sobre o MENOR dos dois conjuntos: "O mapa da parede do escritorio: todas as
  // cidades onde ja entregamos" e "Fiz um mapa no escritorio com todas as
  // cidades" sao o mesmo conteudo, e o titulo mais longo nao pode diluir isso.
  return comuns / Math.min(pa.size, pb.size);
}

// Dois tercos das palavras significativas em comum. Calibrado contra os casos
// reais que passaram: os tres titulos identicos batem 1,0, e o par do mapa —
// contado como repeticao por ela — bate 0,8. Abaixo disso comecam a aparecer
// conteudos que sao de fato diferentes sobre o mesmo assunto, e remover um
// deles custaria mais do que deixar passar.
const CORTE = 0.67;

export interface Repetido<T> {
  item: T;
  titulo: string;
  jaExiste: string;
  semelhanca: number;
}

// Separa o que e novo do que repete algo que ja existe. Nao decide o que fazer
// com o repetido — quem chama e que escolhe descartar ou mostrar.
export function separarRepetidos<T>(
  propostos: T[],
  tituloDe: (item: T) => string,
  existentes: string[],
): { novos: T[]; repetidos: Repetido<T>[] } {
  const novos: T[] = [];
  const repetidos: Repetido<T>[] = [];

  // Os aceitos entram na comparacao seguinte: sem isso, o plano poderia trazer
  // a mesma ideia duas vezes dentro dele mesmo e as duas passariam, porque
  // nenhuma delas existia antes.
  const referencia = [...existentes];

  for (const item of propostos) {
    const titulo = tituloDe(item);

    let pior: Repetido<T> | null = null;
    for (const existente of referencia) {
      const s = semelhancaDeTitulo(titulo, existente);
      if (s >= CORTE && (!pior || s > pior.semelhanca)) {
        pior = { item, titulo, jaExiste: existente, semelhanca: s };
      }
    }

    if (pior) {
      repetidos.push(pior);
    } else {
      novos.push(item);
      referencia.push(titulo);
    }
  }

  return { novos, repetidos };
}
