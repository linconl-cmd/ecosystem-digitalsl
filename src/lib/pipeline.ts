import { createAdminClient } from '@/lib/supabase'
import { enviarNotificacaoEtapa } from '@/lib/email'
import type { EtapaCodigo } from '@/types'

export async function moverPipeline(params: {
  pedidoId: string
  etapaCodigo: EtapaCodigo
  observacao?: string | null
  criadoPor?: string | null
}) {
  const { pedidoId, etapaCodigo, observacao, criadoPor } = params
  const supabase = createAdminClient()

  const { error: erroHistorico } = await supabase
    .from('pedido_pipeline')
    .insert({
      pedido_id: pedidoId,
      etapa_codigo: etapaCodigo,
      observacao: observacao ?? null,
      criado_por: criadoPor ?? null,
    })

  if (erroHistorico) {
    throw new Error(`Erro ao registrar histórico de pipeline: ${erroHistorico.message}`)
  }

  const { error: erroPedido } = await supabase
    .from('pedidos')
    .update({ etapa_atual: etapaCodigo })
    .eq('id', pedidoId)

  if (erroPedido) {
    throw new Error(`Erro ao atualizar etapa do pedido: ${erroPedido.message}`)
  }

  const { data: etapa } = await supabase
    .from('etapas_pipeline')
    .select('nome, notificar_cliente')
    .eq('codigo', etapaCodigo)
    .single()

  if (etapa?.notificar_cliente) {
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('usuario_id')
      .eq('id', pedidoId)
      .single()

    if (pedido) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('nome, email')
        .eq('id', pedido.usuario_id)
        .single()

      if (usuario) {
        await enviarNotificacaoEtapa({
          email: usuario.email,
          nomeCliente: usuario.nome,
          etapaNome: etapa.nome,
          observacao: observacao ?? undefined,
        })
      }
    }
  }
}

export async function registrarPagamentoConfirmado(params: {
  pedidoId: string
  stripePaymentId: string
}) {
  const { pedidoId, stripePaymentId } = params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('pedidos')
    .update({
      status_pagamento: 'pago',
      stripe_payment_id: stripePaymentId,
    })
    .eq('id', pedidoId)

  if (error) {
    throw new Error(`Erro ao registrar pagamento: ${error.message}`)
  }

  await moverPipeline({
    pedidoId,
    etapaCodigo: 'PAGO_AGUARDANDO_ATENDIMENTO',
    observacao: 'Pagamento confirmado via Stripe',
  })
}

export async function buscarPainelAtendimento() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('painel_atendimento')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar painel: ${error.message}`)
  }

  return data
}
