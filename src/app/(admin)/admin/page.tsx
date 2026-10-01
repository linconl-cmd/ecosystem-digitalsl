import { redirect } from 'next/navigation'
import { obterUsuarioAutenticado } from '@/lib/auth'

export default async function AdminPage() {
  const usuario = await obterUsuarioAutenticado()

  // O middleware já garante "está logado" — aqui garantimos "é admin mesmo"
  if (!usuario) {
    redirect('/login')
  }

  if (usuario.tipo !== 'admin') {
    redirect('/login?erro=sem-permissao')
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <h1 className="text-2xl font-semibold text-zinc-900">Painel Admin</h1>
      <p className="mt-2 text-zinc-600">
        Olá, {usuario.nome}. O pipeline de atendimento ainda vai entrar aqui.
      </p>
    </div>
  )
}
