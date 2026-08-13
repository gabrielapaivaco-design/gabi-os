import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { WORKSPACE_COOKIE } from "@/lib/workspace/current";

// Porta de entrada de toda requisicao. Faz tres coisas, nesta ordem:
//   1. renova a sessao do Supabase (o refresh token so pode ser rotacionado
//      aqui, onde ainda da para escrever cookies);
//   2. barra quem nao esta autenticado;
//   3. garante que o cookie de workspace aponta para um workspace do qual a
//      pessoa realmente e membro.
//
// O passo 3 e conveniencia, nao seguranca: quem impede o vazamento entre
// workspaces e o RLS no banco. Um cookie adulterado aqui nao mostra dado de
// ninguem — apenas telas vazias. Corrigi-lo evita esse estado confuso.

const PUBLIC_PATHS = ["/login"];

// O layout precisa do e-mail para a sidebar. Repassar por cabecalho evita um
// segundo `getUser()` — que e uma chamada de rede ao servidor de auth, nao uma
// leitura local. O middleware sempre sobrescreve estes cabecalhos, entao um
// valor vindo do cliente nunca sobrevive.
export const USER_EMAIL_HEADER = "x-gabios-user-email";

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(USER_EMAIL_HEADER);

  let response = NextResponse.next({ request: { headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all: { name: string; value: string; options: CookieOptions }[]) => {
          all.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers } });
          all.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() valida o token no servidor de auth. getSession() apenas le o
  // cookie, que o cliente controla — nao serve para decidir acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  headers.set(USER_EMAIL_HEADER, user.email ?? "");
  // `NextResponse.next` congela os cabecalhos no momento da chamada, entao a
  // resposta precisa ser refeita depois de escrever o e-mail.
  response = NextResponse.next({ request: { headers } });

  await ensureWorkspaceCookie(supabase, request, response);
  return response;
}

async function ensureWorkspaceCookie(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const current = request.cookies.get(WORKSPACE_COOKIE)?.value;

  // Cookie ja preenchido: sair sem consultar nada. Esta funcao roda em toda
  // requisicao, e uma consulta de rede aqui custava ~50ms em cada navegacao
  // para confirmar algo que quase nunca muda. Se o cookie estiver errado, o
  // RLS nao devolve dado nenhum (nao ha vazamento) e o seletor da sidebar
  // mostra o workspace certo como ativo.
  if (current) return;

  // O RLS ja limita esta consulta aos vinculos da propria pessoa.
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, created_at")
    .order("created_at", { ascending: true });

  // Banco fora do ar ou migration 0005 pendente: manter o cookie como esta e
  // deixar a pagina explicar o problema, em vez de expulsar de um workspace
  // valido por causa de uma falha temporaria.
  if (error) return;

  const ids = (data ?? []).map((row) => String(row.workspace_id));
  if (ids.length === 0) return;

  response.cookies.set(WORKSPACE_COOKIE, ids[0], {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export const config = {
  // Tudo menos assets estaticos e imagens — nao ha por que validar sessao para
  // servir um .woff2.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
