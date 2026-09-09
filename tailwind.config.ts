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

        // A parte escura. Ela existe porque a tela inteira era creme sobre
        // creme: sem nenhuma massa escura, um layout fica lavado por mais
        // afinada que a paleta clara esteja. Sao dois escuros diferentes de
        // proposito — a barra e neutra e o cartao de hoje puxa para o vinho,
        // entao um nao vira sombra do outro.
        shell: {
          DEFAULT: "#241E18",    // barra lateral
          ink: "#EFE6D9",        // texto ativo sobre ela      13,3:1
          muted: "#B3A493",      // texto inativo               6,8:1
          faint: "#8E7E6C",      // rodape                      4,2:1
          rose: "#D08C93",       // icone da tela ativa         6,2:1
        },
        hero: {
          DEFAULT: "#33272A",    // cartao do dia, invertido
          ink: "#F5EEE4",        // titulo serif               12,5:1
          muted: "#D6C6BC",      // texto de apoio              8,7:1
          rose: "#E0A7AD",       // versalete
        },
        rose: {
          DEFAULT: "#A85C68",    // rose de identidade, aprofundado
          tint: "#F3E1E3",       // fundo suave
          ink: "#8E4753",        // texto sobre tint
        },
        // Sete status, uma receita so: OKLCH com luminosidade 0,55 e saturacao
        // 0,10, girando apenas o matiz.
        //
        // As anteriores tinham sido escolhidas uma a uma, em momentos
        // diferentes. Cada uma funcionava sozinha, mas o contraste delas contra
        // o papel ia de 2,7 a 3,6 — quase o dobro entre a mais fraca e a mais
        // forte, entao uma pulava da tela e outra sumia. Era isso que soava
        // desafinado. Agora todas ficam entre 4,0 e 4,5, o que de quebra as
        // coloca acima do minimo de acessibilidade que as antigas nao atingiam.
        status: {
          ideia: "#7A6E60", roteiro: "#3179A6", gravar: "#9E6033",
          editar: "#7F62A0", agendar: "#428252", publicado: "#6A7A31",
          analisar: "#9A587F",
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
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
        // Serif editorial: titulos de tela, o briefing e os numeros das metas.
        // E o que da carater — o resto do sistema continua em sans.
        //
        // Spectral: serif de texto, com traco parelho o bastante para aguentar
        // os 17px do seletor de marca e os 44px do alcance com a mesma
        // qualidade. A escolha aqui e por FAIXA DE TAMANHO, nao por gosto — ver
        // a nota em src/app/layout.tsx.
        serif: ["var(--font-spectral)", "Georgia", "serif"],
      },
      borderRadius: { card: "18px", control: "11px" },
      maxWidth: { content: "1280px" },
      transitionTimingFunction: { premium: "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
