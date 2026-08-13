import { Sun, Sparkles, LayoutList, Calendar, LineChart, BookOpen } from "lucide-react";

// Navegacao congelada no Product Playbook: 6 destinos, nada de Studio IA.
export const NAV_ITEMS = [
  { href: "/", label: "Hoje", icon: Sun },
  { href: "/momentos", label: "Momentos", icon: Sparkles },
  { href: "/pipeline", label: "Pipeline", icon: LayoutList },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/metricas", label: "Metricas", icon: LineChart },
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
] as const;
