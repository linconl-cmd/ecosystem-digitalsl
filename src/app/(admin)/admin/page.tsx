import { redirect } from 'next/navigation'
import { obterUsuarioAutenticado } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-server'
import { buscarPainelAtendimento } from '@/lib/pipeline'
import PipelineBoard from '@/components/PipelineBoard'
import type { EtapaPipeline } from '@/types'

export default async function AdminPage() {
  const usuario = await obterUsuarioAutenticado()

  // O middleware já garante "está logado" — aqui garantimos "é admin mesmo"
  if (!usuario) {
    redirect('/login')
  }

  if (usuario.tipo !== 'admin') {
    redirect('/login?erro=sem-permissao')
  }

  const supabase = createAdminClient()
  const { data: etapas } = await supabase
    .from('etapas_pipeline')
    .select('*')
    .eq('ativo', true)
    .order('ordem')

  const pedidos = await buscarPainelAtendimento()

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Pipeline de atendimento</h1>
          <p className="text-sm text-zinc-500">Olá, {usuario.nome}</p>
        </div>
        <LogoutButton />
      </header>

      <PipelineBoard
        etapasIniciais={(etapas ?? []) as EtapaPipeline[]}
        pedidosIniciais={pedidos ?? []}
      />
    </div>
  )
}

// Botão simples — o logout em si é um Client Component (precisa do
// supabase.auth.signOut() rodando no navegador)
function LogoutButton() {
  return (
    <a
      href="/logout"
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
    >
      Sair
    </a>
  )
}
