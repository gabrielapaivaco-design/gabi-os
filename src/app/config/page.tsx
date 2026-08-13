import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/service";
import {
  countWorkspaceContents,
  getCurrentWorkspace,
  listWorkspaces,
  type Workspace,
  type WorkspaceContents,
} from "@/lib/workspace/service";
import { WorkspaceAdmin } from "./workspace-admin";
import { isAiConfigured, resolveProviderName } from "@/lib/ai";
import { getWorkspaceId } from "@/lib/workspace/current";

// Tudo o que um Workspace isola. A lista existe para tornar a arquitetura
// verificavel: cada item abaixo e uma tabela filtrada por workspace_id.
const ISOLATED = [
  "Brand Brain, Business Brain e Learned Brain",
  "Momentos",
  "Conteudos (Pipeline, Calendario e Biblioteca)",
  "Objetivos e Metricas",
  "DNA do Conteudo e historico de geracoes de IA",
  "Pilares, datas comemorativas e planos mensais",
  "Configuracoes e log de eventos",
];

async function load(): Promise<{
  current: Workspace | null;
  all: Workspace[];
  contents: WorkspaceContents | null;
  unavailable: boolean;
}> {
  try {
    const db = createClient();
    const [current, all] = await Promise.all([getCurrentWorkspace(db), listWorkspaces(db)]);
    const contents = await countWorkspaceContents(db, current.id);
    return { current, all, contents, unavailable: false };
  } catch {
    return { current: null, all: [], contents: null, unavailable: true };
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-[12px] uppercase tracking-wide text-faint">{label}</span>
      <span className="text-right text-[13px] text-ink">{children}</span>
    </div>
  );
}

export default async function ConfigPage() {
  const { current, all, contents, unavailable } = await load();
  const userEmail = (await getCurrentUser(createClient()))?.email ?? null;
  const providerName = resolveProviderName(current?.settings.ai_provider);
  const aiReady = isAiConfigured(current?.settings.ai_provider);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configuracoes</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          O workspace ativo e o que ele isola.
        </p>
      </header>

      {unavailable ? (
        <p className="text-[13px] text-muted">
          Ainda nao consegui falar com o Supabase. Confira <code>.env.local</code> e se as
          migrations foram executadas.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-medium text-ink">Workspace ativo</h2>
            <Row label="Nome">{current?.name ?? "—"}</Row>
            <Row label="Slug">
              {current?.slug ? (
                <code className="text-[12px]">{current.slug}</code>
              ) : (
                <span className="text-muted">migration 0004 pendente</span>
              )}
            </Row>
            <Row label="ID">
              <code className="text-[11px] text-muted">{getWorkspaceId()}</code>
            </Row>
            <Row label="Workspaces que voce acessa">{all.length}</Row>
            <Row label="Conta">{userEmail ?? "—"}</Row>
          </section>

          {current && contents && (
            <WorkspaceAdmin
              workspaceId={current.id}
              name={current.name}
              contents={contents}
              isOnly={all.length <= 1}
            />
          )}

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium text-ink">Diretor de Conteudo</h2>
            <p className="mb-3 text-[12px] text-muted">
              Provedor de IA usado para gerar roteiros, legendas, ideias e analises.
            </p>
            <Row label="Provedor">{providerName}</Row>
            <Row label="Status">
              {aiReady ? (
                <span className="text-ink">conectado</span>
              ) : (
                <span className="text-muted">sem chave configurada</span>
              )}
            </Row>
            {!aiReady && (
              <p className="mt-3 text-[12px] text-muted">
                Defina <code>ANTHROPIC_API_KEY</code> em <code>.env.local</code> e reinicie o
                servidor para ligar a geracao por IA.
              </p>
            )}
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-1 text-sm font-medium text-ink">Isolamento por workspace</h2>
            <p className="mb-3 text-[12px] text-muted">
              Cada workspace tem os seus proprios dados. Nada abaixo atravessa a fronteira.
            </p>
            <ul className="flex flex-col gap-1.5">
              {ISOLATED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px] text-ink">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
              O isolamento e imposto pelo banco, nao pelo codigo do app: cada tabela tem uma
              policy de Row Level Security que so devolve linhas de workspace do qual voce e
              membro (migration <code>0005</code>). Mesmo uma consulta que esquecesse de filtrar
              por <code>workspace_id</code> nao veria dado de outra marca.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
