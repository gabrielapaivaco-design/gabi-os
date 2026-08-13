// Parte do historico que a interface precisa: o formato de um registro e como
// resumi-lo. Este arquivo NAO pode importar nada de servidor.
//
// A separacao existe por uma razao concreta: `history.ts` importa
// `getWorkspaceId`, que importa `next/headers`. Um componente com "use client"
// que importasse de la arrastaria `next/headers` para o bundle do navegador e
// quebraria o build da rota inteira — foi exatamente o que aconteceu.

export interface Generation {
  id: string;
  kind: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  contentTitle: string | null;
}

export const KIND_LABEL: Record<string, string> = {
  roteiro: "Roteiro",
  legenda: "Legenda",
  ideias: "Outros angulos",
  analise: "Analise",
  conversa: "Conversa",
};

// Resumo legivel do que cada geracao produziu. O formato de `result` muda por
// tipo, entao a leitura fica aqui e nao espalhada pela tela.
export function summarize(g: Generation): string {
  if (g.error) return g.error;
  if (!g.result) return "sem resultado gravado";

  const r = g.result;
  switch (g.kind) {
    case "roteiro":
      return String(r.hook ?? "");
    case "legenda":
      return String(r.caption ?? "");
    case "conversa":
      return String(r.reply ?? "");
    case "ideias": {
      const ideas = Array.isArray(r.ideas) ? r.ideas : [];
      return ideas.map((i) => String((i as { title?: string }).title ?? "")).join(" · ");
    }
    case "analise": {
      const fortes = Array.isArray(r.strengths) ? r.strengths.length : 0;
      const riscos = Array.isArray(r.risks) ? r.risks.length : 0;
      const mudaria = Array.isArray(r.suggestions) ? r.suggestions.length : 0;
      return `${fortes} pontos fortes, ${riscos} riscos, ${mudaria} sugestoes`;
    }
    default:
      return "";
  }
}
