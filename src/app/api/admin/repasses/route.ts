import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { enviarPixTransferencia } from '@/lib/sicoob'
import { criarRepasseSchema } from '@/schemas'
import { erroApi, sucessoApi } from '@/lib/utils'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const contadorId = searchParams.get('contador_id')

  const supabase = createAdminClient()
  let query = supabase.from('repasses_comissao').select('*').order('criado_em', { ascending: false })

  if (contadorId) {
    query = query.eq('contador_id', contadorId)
  }

  const { data, error } = await query

  if (error) {
    return erroApi(error.message, 500)
  }

  return sucessoApi(data)
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json()
  const resultado = criarRepasseSchema.safeParse(body)

  if (!resultado.success) {
    return erroApi(resultado.error.issues.map((e: { message: string }) => e.message).join(', '))
  }

  const supabase = createAdminClient()

  const { data: contador, error: erroContador } = await supabase
    .from('contadores_parceiros')
    .select('*')
    .eq('id', resultado.data.contador_id)
    .single()

  if (erroContador || !contador) {
    return erroApi('Contador não encontrado', 404)
  }

  if (!contador.chave_pix) {
    return erroApi('Contador não possui chave PIX cadastrada')
  }

  const saldo = Math.round((contador.total_comissoes - contador.total_repassado) * 100) / 100

  if (saldo <= 0) {
    return erroApi('Não há saldo pendente para repasse')
  }

  const { data: repasse, error: erroRepasse } = await supabase
    .from('repasses_comissao')
    .insert({
      contador_id: contador.id,
      valor: saldo,
      status: 'processando',
    })
    .select()
    .single()

  if (erroRepasse || !repasse) {
    return erroApi(`Erro ao criar repasse: ${erroRepasse?.message}`, 500)
  }

  try {
    const { transacaoId } = await enviarPixTransferencia({
      chavePix: contador.chave_pix,
      valor: saldo,
      identificador: repasse.id,
    })

    await supabase
      .from('repasses_comissao')
      .update({
        status: 'concluido',
        sicoob_transacao_id: transacaoId,
        processado_em: new Date().toISOString(),
      })
      .eq('id', repasse.id)

    await supabase
      .from('contadores_parceiros')
      .update({ total_repassado: contador.total_repassado + saldo })
      .eq('id', contador.id)

    return sucessoApi({ repasseId: repasse.id, valor: saldo, transacaoId }, 201)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido'

    await supabase
      .from('repasses_comissao')
      .update({ status: 'falhou', erro: mensagem })
      .eq('id', repasse.id)

    return erroApi(`Falha ao processar repasse via Sicoob: ${mensagem}`, 502)
  }
}
