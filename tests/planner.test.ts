import { describe, it, expect, vi, afterEach } from "vitest";
import { renderPlanningContext, buildPlanPrompt } from "@/lib/ai/director/planner";
import type { PlanningContext } from "@/lib/planning/context";

function ctx(over: Partial<PlanningContext> = {}): PlanningContext {
  return {
    workspaceId: "w1",
    period: { year: 2026, month: 7 },
    brains: { brand: {}, business: {}, learned: {} },
    pillars: [],
    objectives: [],
    recentMoments: [],
    contentHistory: [],
    alreadyPlanned: [],
    metrics: [],
    contentDna: [],
    commemorativeDates: [],
    bestTimes: null,
    published: [],
    missing: [],
    ...over,
  };
}

afterEach(() => vi.useRealTimers());

describe("buildPlanPrompt — janela de dias", () => {
  it("no mes corrente, proibe planejar dias que ja passaram", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 10, 9, 0));
    const p = buildPlanPrompt(ctx({ period: { year: 2026, month: 7 } }));

    expect(p).toMatch(/HOJE E DIA 10 DE AGOSTO/);
    expect(p).toMatch(/Restam 22 dias/);
    expect(p).toMatch(/Nao proponha nada antes do dia 10/);
    expect(p).toMatch(/entre o dia 10 e o dia 31/);
  });

  it("em mes futuro, libera o mes inteiro", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 10, 9, 0));
    const p = buildPlanPrompt(ctx({ period: { year: 2026, month: 8 } }));

    expect(p).toMatch(/do dia 1 ao dia 30/);
    expect(p).not.toMatch(/HOJE E DIA/);
  });

  it("no primeiro dia do mes, a janela e o mes todo", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 1, 9, 0));
    const p = buildPlanPrompt(ctx({ period: { year: 2026, month: 7 } }));
    expect(p).toMatch(/Restam 31 dias/);
    expect(p).toMatch(/entre o dia 1 e o dia 31/);
  });
});

describe("renderPlanningContext", () => {
  it("omite secoes vazias em vez de escrever '(nenhum)'", () => {
    // Uma secao vazia explicita convida o modelo a preencher o vazio inventando.
    const texto = renderPlanningContext(ctx());
    expect(texto).not.toMatch(/Brand Brain/);
    expect(texto).not.toMatch(/Pilares/);
    expect(texto.trim()).toBe("");
  });

  it("inclui apenas as secoes de Cerebro com conteudo real", () => {
    const texto = renderPlanningContext(
      ctx({ brains: { brand: { Voz: "Direta", Vazio: "  " }, business: {}, learned: {} } }),
    );
    expect(texto).toMatch(/Brand Brain/);
    expect(texto).toMatch(/Direta/);
    expect(texto).not.toMatch(/Vazio/);
    expect(texto).not.toMatch(/Business Brain/);
  });

  it("numera os Momentos nao aproveitados para o modelo referenciar por indice", () => {
    const texto = renderPlanningContext(
      ctx({
        recentMoments: [
          { id: "m1", body: "primeiro", created_at: "2026-08-01T00:00:00Z", converted: false },
          { id: "m2", body: "ja virou conteudo", created_at: "2026-08-02T00:00:00Z", converted: true },
          { id: "m3", body: "segundo", created_at: "2026-08-03T00:00:00Z", converted: false },
        ],
      }),
    );
    expect(texto).toMatch(/\[0\] 2026-08-01 — primeiro/);
    expect(texto).toMatch(/\[1\] 2026-08-03 — segundo/);
    // O indice pula o convertido: a numeracao acompanha a lista filtrada, que e
    // a mesma que a action usa para traduzir indice em id.
    expect(texto).not.toMatch(/ja virou conteudo/);
  });

  it("separa metricas de conta das metricas por conteudo", () => {
    const texto = renderPlanningContext(
      ctx({
        metrics: [
          { content_id: null, reach: 12444, retention: null, saves: null, shares: null, comments: null, followers_gained: -162, collected_at: "2026-07-31T23:59:00Z" },
          { content_id: "c1", reach: 500, retention: null, saves: 3, shares: null, comments: null, followers_gained: null, collected_at: "2026-07-10T00:00:00Z" },
        ],
      }),
    );
    expect(texto).toMatch(/alcance 12444/);
    expect(texto).toMatch(/saldo de seguidores -162/);
    // A linha por conteudo nao entra no bloco de desempenho da conta.
    expect(texto).not.toMatch(/alcance 500/);
  });

  it("mostra so as datas comemorativas do mes planejado", () => {
    const texto = renderPlanningContext(
      ctx({
        period: { year: 2026, month: 7 },
        commemorativeDates: [
          { id: "d1", name: "Dia dos Pais", month: 8, day: 9, lead_days: 7 },
          { id: "d2", name: "Natal", month: 12, day: 25, lead_days: 20 },
        ],
      }),
    );
    expect(texto).toMatch(/Dia dos Pais/);
    expect(texto).not.toMatch(/Natal/);
  });

  it("declara o que nao conseguiu ler, para nao ser confundido com vazio", () => {
    const texto = renderPlanningContext(ctx({ missing: ["metrics"] }));
    expect(texto).toMatch(/Indisponivel/);
    expect(texto).toMatch(/metrics/);
  });

  it("lista os melhores horarios quando existem", () => {
    const texto = renderPlanningContext(ctx({ bestTimes: { domingo: [18, 19] } }));
    expect(texto).toMatch(/domingo: 18h, 19h/);
  });
});
