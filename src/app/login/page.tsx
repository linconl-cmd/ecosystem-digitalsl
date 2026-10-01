'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function FormularioLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setCarregando(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    setCarregando(false)

    if (error) {
      setErro('E-mail ou senha incorretos')
      return
    }

    router.push(searchParams.get('next') ?? '/admin')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900">Entrar</h1>

      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
        E-mail
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
      />

      <label htmlFor="senha" className="mb-1 block text-sm font-medium text-zinc-700">
        Senha
      </label>
      <input
        id="senha"
        type="password"
        required
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        className="mb-6 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
      />

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {carregando ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Suspense>
        <FormularioLogin />
      </Suspense>
    </div>
  )
}
