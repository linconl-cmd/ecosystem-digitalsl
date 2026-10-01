import { createServerSupabaseClient } from '@/lib/supabase-server'
import { erroApi } from '@/lib/utils'
import type { TipoUsuario } from '@/types'

export interface UsuarioAutenticado {
  id: string
  nome: string
  email: string
  tipo: TipoUsuario
}

// Lê a sessão pelos cookies (Server Components e API Routes) e busca o
// registro correspondente em `usuarios` — é lá que mora o `tipo`, a sessão do
// Supabase Auth sozinha só diz "quem é a pessoa", não "o que ela pode fazer".
export async function obterUsuarioAutenticado(): Promise<UsuarioAutenticado | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nome, email, tipo')
    .eq('id', user.id)
    .single()

  return usuario
}

// Para usar no topo de uma API Route: `const { usuario, erro } = await exigirTipo(['admin'])`
// — se `erro` vier preenchido, retorne ele direto (já é a resposta HTTP certa).
export async function exigirTipo(tipos: TipoUsuario[]): Promise<
  { usuario: UsuarioAutenticado; erro: null } | { usuario: null; erro: ReturnType<typeof erroApi> }
> {
  const usuario = await obterUsuarioAutenticado()

  if (!usuario) {
    return { usuario: null, erro: erroApi('Não autenticado', 401) }
  }

  if (!tipos.includes(usuario.tipo)) {
    return { usuario: null, erro: erroApi('Sem permissão para esta ação', 403) }
  }

  return { usuario, erro: null }
}

export function exigirAdmin() {
  return exigirTipo(['admin'])
}
