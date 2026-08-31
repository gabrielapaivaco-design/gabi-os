import type { Metadata } from "next";
import { Newsreader, Work_Sans } from "next/font/google";
import "./globals.css";

// Work Sans no corpo, Newsreader nos titulos. `display: swap` para o texto
// aparecer na fonte de sistema enquanto a real carrega, em vez de piscar vazio.
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-work-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-newsreader",
  display: "swap",
});
import { headers } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { createClient } from "@/lib/supabase/server";
import { listWorkspaces, type Workspace } from "@/lib/workspace/service";
import { getWorkspaceId } from "@/lib/workspace/current";
import { USER_EMAIL_HEADER } from "@/middleware";

export const metadata: Metadata = {
  title: "Gabi OS",
  description: "Seu segundo cerebro para documentar a construcao da sua vida.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O e-mail vem do cabecalho que o middleware escreveu depois de validar a
  // sessao. Chamar `getUser()` aqui repetiria essa validacao pela rede em toda
  // navegacao, so para exibir um texto na sidebar.
  const userEmail = headers().get(USER_EMAIL_HEADER);

  // Sem usuario nao ha o que enquadrar: o middleware so deixa passar /login.
  // Assim a tela de entrada nao herda a sidebar de um app em que ninguem entrou.
  let workspaces: Workspace[] = [];
  if (userEmail !== null) {
    try {
      workspaces = await listWorkspaces(createClient());
    } catch {
      // Banco fora do ar ou migration 0005 pendente: o seletor aparece vazio e
      // cada pagina explica o problema no seu proprio contexto.
    }
  }

  return (
    <html lang="pt-BR" className={`${workSans.variable} ${newsreader.variable}`}>
      <body className="font-sans">
        {userEmail !== null ? (
          <div className="flex min-h-screen">
            <Sidebar
              workspaces={workspaces}
              activeWorkspaceId={getWorkspaceId()}
              userEmail={userEmail}
            />
            <main className="min-w-0 flex-1">
              <div className="mx-auto max-w-content px-8 py-8">{children}</div>
            </main>
          </div>
        ) : (
          <div className="flex min-h-screen items-center justify-center px-6">{children}</div>
        )}
      </body>
    </html>
  );
}
