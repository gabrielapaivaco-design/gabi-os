import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NAV_ITEMS } from "@/components/layout/nav-items";

// O menu apontou por semanas para /metricas e /biblioteca, que nao existiam:
// dois itens que davam 404. Nada quebrava na compilacao, no lint nem nos testes
// — um href e so uma string.
//
// Este teste fecha essa porta: cada destino do menu tem de ter uma pagina de
// verdade no disco.

const APP = join(process.cwd(), "src", "app");

function existePagina(href: string): boolean {
  const segmentos = href.split("/").filter(Boolean);
  return existsSync(join(APP, ...segmentos, "page.tsx"));
}

describe("navegacao", () => {
  it.each(NAV_ITEMS.map((i) => [i.label, i.href]))(
    "%s (%s) tem uma pagina de verdade",
    (_label, href) => {
      expect(existePagina(href)).toBe(true);
    },
  );

  it("nao tem destino repetido", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("todo href e absoluto", () => {
    // Um href relativo resolveria contra a rota atual e levaria a lugares
    // diferentes dependendo de onde a pessoa clicou.
    for (const { href } of NAV_ITEMS) expect(href.startsWith("/")).toBe(true);
  });

  it("todo destino tem rotulo", () => {
    for (const { label } of NAV_ITEMS) expect(label.trim().length).toBeGreaterThan(0);
  });
});
