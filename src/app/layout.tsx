import type { Metadata } from "next";
import { Instrument_Serif, Karla } from "next/font/google";
import "./globals.css";

// Karla no corpo, Instrument Serif nos titulos. `display: swap` para o texto
// aparecer na fonte de sistema enquanto a real carrega, em vez de piscar vazio.
//
// A Instrument Serif so existe em um peso (400) — nao ha `font-light` nela. Foi
// por isso que os titulos do sistema todo sairam de font-light: pedir 300 numa
// fonte que nao tem 300 faz o navegador sintetizar um afinamento, e o resultado
// e um desenho pior do que o proprio peso normal.
const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-karla",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
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
    <html lang="pt-BR" className={`${karla.variable} ${instrumentSerif.variable}`}>
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
