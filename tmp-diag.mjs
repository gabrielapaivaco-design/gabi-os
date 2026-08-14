import { createClient } from "@supabase/supabase-js";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: ws } = await admin.from("workspaces").select("id, name").eq("slug", "eisen-haus").single();
console.log("workspace:", ws.name, ws.id);
const q = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;
console.log("trimestre calculado:", q);

const testes = [
  ["moments count", () => admin.from("moments").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id)],
  ["contents moment_id", () => admin.from("contents").select("moment_id").eq("workspace_id", ws.id).eq("archived", false).not("moment_id", "is", null)],
  ["contents lista", () => admin.from("contents").select("id, title, status").eq("workspace_id", ws.id).eq("archived", false)],
  ["goals do trimestre", () => admin.from("goals").select("id, title, target, progress, quarter, metric_key").eq("workspace_id", ws.id).eq("quarter", q).order("created_at", { ascending: true })],
];

for (const [nome, fn] of testes) {
  const { error, count, data } = await fn();
  console.log(`  ${nome.padEnd(22)} ${error ? "ERRO: " + error.message : "ok (" + (count ?? (data ?? []).length) + ")"}`);
}
process.exit(0);
