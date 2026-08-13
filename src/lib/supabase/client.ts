import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes de navegador. Le as variaveis publicas.
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
