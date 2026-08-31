import type { Config } from "tailwindcss";

// Identidade "Papel quente": editorial e acolhedora.
//
// A primeira versao era quase monocromatica, com o rose em menos de 2% da tela.
// Funcionava, mas nao tinha cara de ninguem — "generico" foi a palavra usada.
// Esta paleta troca o cinza neutro por papel quente e deixa o rose ser tinta,
// nao enfeite: ele sublinha numero no briefing, marca a meta, indica a marca
// ativa.
//
// O terracota chegou a ser testado e ficou de fora: dois vermelhos-alaranjados
// (ele e o rose da marca) brigavam pela mesma tela.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5EEE4",       // fundo (papel quente)
        surface: "#FFFCF7",      // cards, sobre o papel
        ink: "#2A231C",          // texto primario (marrom quase preto)
        muted: "#71634F",        // texto secundario
        faint: "#A89684",        // dicas
        line: "#E4D9C9",         // bordas
        rose: {
          DEFAULT: "#A85C68",    // rose de identidade, aprofundado
          tint: "#F3E1E3",       // fundo suave
          ink: "#8E4753",        // texto sobre tint
        },
        status: {
          ideia: "#888780", roteiro: "#378ADD", gravar: "#BA7517",
          editar: "#7F77DD", agendar: "#1D9E75", publicado: "#639922",
          analisar: "#D4537E",
        },
        // Tokens semanticos para shadcn/ui, mapeados sobre a identidade acima
        // (nao substituem nem redefinem nenhuma cor congelada).
        background: "#F5EEE4",
        foreground: "#2A231C",
        card: { DEFAULT: "#FFFCF7", foreground: "#2A231C" },
        popover: { DEFAULT: "#FFFCF7", foreground: "#2A231C" },
        primary: { DEFAULT: "#2A231C", foreground: "#F5EEE4" },
        secondary: { DEFAULT: "#F5EEE4", foreground: "#2A231C" },
        accent: { DEFAULT: "#F3E1E3", foreground: "#8E4753" },
        destructive: { DEFAULT: "#B3403F", foreground: "#FFFCF7" },
        border: "#E4D9C9",
        input: "#E4D9C9",
        ring: "#A85C68",
      },
      fontFamily: {
        sans: ["var(--font-work-sans)", "system-ui", "sans-serif"],
        // Serif editorial: titulos de tela, o briefing e os numeros das metas.
        // E o que da carater — o resto do sistema continua em sans.
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
      },
      borderRadius: { card: "18px", control: "11px" },
      maxWidth: { content: "1040px" },
      transitionTimingFunction: { premium: "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
