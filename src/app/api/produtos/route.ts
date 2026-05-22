import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { criarProdutoSchema } from '@/schemas'
import { erroApi, sucessoApi } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const todos = searchParams.get('todos') === 'true'

  const supabase = await createServerSupabaseClient()

  let query = supabase.from('produtos').select('*').order('created_at', { ascending: false })

  if (!todos) {
    query = query.eq('ativo', true)
  }

  const { data, error } = await query

  if (error) {
    return erroApi(error.message, 500)
  }

  return sucessoApi(data)
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json()
  const resultado = criarProdutoSchema.safeParse(body)

  if (!resultado.success) {
    return erroApi(resultado.error.issues.map((e: { message: string }) => e.message).join(', '))
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('produtos')
    .insert(resultado.data)
    .select()
    .single()

  if (error) {
    return erroApi(error.message, 500)
  }

  return sucessoApi(data, 201)
}
