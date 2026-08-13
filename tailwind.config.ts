import type { Config } from "tailwindcss";

// Identidade visual congelada no Product Playbook.
// Rosé de identidade: uso < 2% da tela, apenas em detalhes.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFAF8",       // fundo (branco quente, papel)
        surface: "#FFFFFF",      // cards
        ink: "#18181B",          // texto primário / acento preto
        muted: "#71717A",        // texto secundário
        faint: "#A1A1AA",        // dicas
        line: "#EBEBE8",         // bordas
        rose: {
          DEFAULT: "#B76E79",    // rosé de identidade
          tint: "#F7EEEF",       // fundo suave
          ink: "#8E4F58",        // texto sobre tint
        },
        status: {
          ideia: "#888780", roteiro: "#378ADD", gravar: "#BA7517",
          editar: "#7F77DD", agendar: "#1D9E75", publicado: "#639922",
          analisar: "#D4537E",
        },
        // Tokens semanticos para shadcn/ui, mapeados sobre a identidade acima
        // (nao substituem nem redefinem nenhuma cor congelada).
        background: "#FAFAF8",
        foreground: "#18181B",
        card: { DEFAULT: "#FFFFFF", foreground: "#18181B" },
        popover: { DEFAULT: "#FFFFFF", foreground: "#18181B" },
        primary: { DEFAULT: "#18181B", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#FAFAF8", foreground: "#18181B" },
        accent: { DEFAULT: "#F7EEEF", foreground: "#8E4F58" },
        destructive: { DEFAULT: "#DC2626", foreground: "#FFFFFF" },
        border: "#EBEBE8",
        input: "#EBEBE8",
        ring: "#B76E79",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "12px", control: "8px" },
      maxWidth: { content: "1040px" },
      transitionTimingFunction: { premium: "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
