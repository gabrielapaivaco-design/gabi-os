import { Sun, Sparkles, CalendarRange, LayoutList, Calendar, LineChart, BookOpen } from "lucide-react";

// Os sete destinos, na ordem do ciclo: acontece (Momentos), vira plano
// (Planejamento), vira trabalho (Pipeline), ganha data (Calendario), sai e
// rende numero (Metricas), fica de acervo (Biblioteca). "Hoje" abre a lista
// porque e de onde se comeca.
//
// Planejamento estava fora do menu e so era alcancavel por um link dentro do
// Calendario — sendo a tela onde o mes inteiro nasce. Metricas e Biblioteca
// estavam no menu sem existir, e davam 404.
export const NAV_ITEMS = [
  { href: "/", label: "Hoje", icon: Sun },
  { href: "/momentos", label: "Momentos", icon: Sparkles },
  { href: "/planejamento", label: "Planejamento", icon: CalendarRange },
  { href: "/pipeline", label: "Pipeline", icon: LayoutList },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/metricas", label: "Metricas", icon: LineChart },
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
] as const;
