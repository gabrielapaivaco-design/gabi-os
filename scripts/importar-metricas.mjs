// Importa o desempenho de um mes para dentro do Gabi OS.
//
// POR QUE ISTO E UM SCRIPT E NAO UM BOTAO NO APP:
// o Gabi OS nao tem conexao com o Metricool. Quem tem acesso as metricas hoje
// e o assistente, pela sessao de MCP dele. O fluxo real e:
//   1. voce pede as metricas do mes ao assistente
//   2. ele busca no Metricool e monta o JSON abaixo
//   3. este script grava no seu banco
//
// Quando o app ganhar conexao propria (Graph API do Meta, gratuita), este
// script vira o corpo de um job agendado — o formato de gravacao nao muda.
//
// USO:
//   node scripts/importar-metricas.mjs metricas.json
//
// FORMATO ESPERADO (metricas.json):
// {
//   "ano": 2026, "mes": 7,
//   "alcance": 12444,
//   "seguidoresGanhos": -162,
//   "seguidoresTotal": 6863,
//   "publicacoes": 37,
//   "salvamentos": null, "compartilhamentos": null, "comentarios": null,
//   "melhoresHorarios": { "domingo": [18, 19], "segunda": [11, 20] },
//   "observacoes": "Dia 22 teve 1673 de alcance com 3 posts — 8x a media."
// }

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: node scripts/importar-metricas.mjs <arquivo.json>");
  process.exit(1);
}

const dados = JSON.parse(readFileSync(arquivo, "utf8"));
const { ano, mes } = dados;
if (!ano || !mes) {
  console.error("o JSON precisa de 'ano' e 'mes'.");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const slug = process.env.WORKSPACE_SLUG ?? "gabriela";
const { data: ws, error: wsErr } = await db
  .from("workspaces")
  .select("id, name, settings")
  .eq("slug", slug)
  .single();

if (wsErr || !ws) {
  console.error(`workspace "${slug}" nao encontrado.`, wsErr?.message ?? "");
  process.exit(1);
}
console.log(`workspace: ${ws.name}`);

// Ultimo instante do mes, em Sao Paulo. `content_id` nulo marca a linha como
// resumo da conta no periodo, e nao metrica de um post especifico — a coluna
// ja e nullable no schema, entao nao precisa de migration.
const fim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59)).toISOString();

// Idempotente: reimportar o mesmo mes corrige em vez de duplicar.
const { data: existente } = await db
  .from("metrics")
  .select("id")
  .eq("workspace_id", ws.id)
  .is("content_id", null)
  .gte("collected_at", new Date(Date.UTC(ano, mes - 1, 1)).toISOString())
  .lte("collected_at", fim)
  .maybeSingle();

const linha = {
  workspace_id: ws.id,
  content_id: null,
  reach: dados.alcance ?? null,
  saves: dados.salvamentos ?? null,
  shares: dados.compartilhamentos ?? null,
  comments: dados.comentarios ?? null,
  followers_gained: dados.seguidoresGanhos ?? null,
  collected_at: fim,
};

if (existente) {
  const { error } = await db.from("metrics").update(linha).eq("id", existente.id);
  if (error) throw new Error(error.message);
  console.log(`metricas de ${mes}/${ano}: atualizadas`);
} else {
  const { error } = await db.from("metrics").insert(linha);
  if (error) throw new Error(error.message);
  console.log(`metricas de ${mes}/${ano}: gravadas`);
}

// Melhores horarios ficam em workspaces.settings: sao propriedade da marca, nao
// de um mes, e o Diretor usa para sugerir hora, nao so data.
if (dados.melhoresHorarios) {
  const settings = { ...(ws.settings ?? {}), best_times: dados.melhoresHorarios };
  const { error } = await db.from("workspaces").update({ settings }).eq("id", ws.id);
  if (error) throw new Error(error.message);
  console.log("melhores horarios: gravados em settings");
}

// A leitura em texto vai para o Learned Brain — e literalmente "o que a pratica
// ensinou". Fica editavel por voce em /cerebros, e o Diretor le como contexto.
if (dados.observacoes) {
  const { data: brain } = await db
    .from("brains")
    .select("content")
    .eq("workspace_id", ws.id)
    .eq("kind", "learned")
    .single();

  const meses = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const titulo = `Desempenho — ${meses[mes - 1]} de ${ano}`;
  const corpo = [
    dados.seguidoresTotal != null ? `Seguidores no fim do mes: ${dados.seguidoresTotal}.` : null,
    dados.seguidoresGanhos != null ? `Saldo do mes: ${dados.seguidoresGanhos > 0 ? "+" : ""}${dados.seguidoresGanhos}.` : null,
    dados.alcance != null ? `Alcance total: ${dados.alcance}.` : null,
    dados.publicacoes != null ? `Publicacoes: ${dados.publicacoes}.` : null,
    dados.observacoes,
  ].filter(Boolean).join(" ");

  const content = { ...(brain?.content ?? {}), [titulo]: corpo };
  const { error } = await db
    .from("brains")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("workspace_id", ws.id)
    .eq("kind", "learned");
  if (error) throw new Error(error.message);
  console.log(`Learned Brain: secao "${titulo}" gravada`);
}

console.log("\npronto. o resumo aparece em /cerebros (Learned Brain) e no /planejamento.");
process.exit(0);
