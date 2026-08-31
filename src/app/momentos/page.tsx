import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace/current";
import { groupMomentsByDay } from "@/lib/moments/group-by-day";
import type { Moment } from "@/types/db";
import { MomentCapture } from "./moment-capture";
import { MomentFeed } from "./moment-feed";

interface MomentsLoadResult {
  moments: Moment[];
  // momento -> titulos dos Conteudos vivos que nasceram dele. Serve tanto para
  // o selo "Ja e conteudo" quanto para nomear o que sera afetado na exclusao.
  linkedTitles: Record<string, string[]>;
  unavailable: boolean;
}

async function loadMoments(): Promise<MomentsLoadResult> {
  try {
    const db = createClient();
    const workspaceId = getWorkspaceId();
    const [momentsRes, linkedRes] = await Promise.all([
      db
        .from("moments")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      db
        .from("contents")
        .select("moment_id, title")
        .eq("workspace_id", workspaceId)
        .eq("archived", false)
        .not("moment_id", "is", null),
    ]);

    if (momentsRes.error) throw momentsRes.error;
    if (linkedRes.error) throw linkedRes.error;

    const linkedTitles: Record<string, string[]> = {};
    for (const row of (linkedRes.data ?? []) as { moment_id: string; title: string }[]) {
      (linkedTitles[row.moment_id] ??= []).push(row.title);
    }

    return {
      moments: (momentsRes.data ?? []) as Moment[],
      linkedTitles,
      unavailable: false,
    };
  } catch {
    return { moments: [], linkedTitles: {}, unavailable: true };
  }
}

export default async function MomentosPage() {
  const { moments, linkedTitles, unavailable } = await loadMoments();
  const groups = groupMomentsByDay(moments);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-[34px] font-light leading-tight tracking-tight">Momentos</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Registre o que acontecer, sem filtro. A classificacao vem depois.
        </p>
      </header>

      <MomentCapture />

      {unavailable ? (
        <p className="text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas.
        </p>
      ) : (
        <MomentFeed groups={groups} linkedTitles={linkedTitles} />
      )}
    </div>
  );
}
