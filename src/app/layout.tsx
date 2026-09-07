import type { Metadata } from "next";
import { Public_Sans, Spectral } from "next/font/google";
import "./globals.css";

// Public Sans no corpo, Spectral nos titulos. `display: swap` para o texto
// aparecer na fonte de sistema enquanto a real carrega, em vez de piscar vazio.
//
// A Spectral e uma serif de TEXTO, e essa e a razao de estar aqui. A Instrument
// Serif, que ficou no ar por um dia, e de display: contraste altissimo entre o
// traco grosso e o fino. Num titulo grande e solto ela brilha; mas no sistema a
// serif tambem aparece a 17, 19, 21 e 23px — o seletor de marca, os subtitulos
// dos cartoes — e nesses tamanhos o traco fino simplesmente some. Era uma fonte
// de cartaz fazendo trabalho de texto.
//
// Os cinco pesos da Spectral tambem devolvem o `font-light` aos titulos
// grandes, que a Instrument (peso unico) tinha obrigado a remover.
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-spectral",
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
    <html lang="pt-BR" className={`${publicSans.variable} ${spectral.variable}`}>
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
