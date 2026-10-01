import { createBrowserClient } from '@supabase/ssr'

// Único export deste arquivo de propósito: tudo que usa next/headers (sessão
// do servidor, admin client) fica em lib/supabase-server.ts. Misturar os dois
// num arquivo só quebra o build sempre que um Client Component importar
// qualquer coisa daqui — mesmo sem usar as funções de servidor, o bundler
// barra o módulo inteiro por causa do import de next/headers.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
