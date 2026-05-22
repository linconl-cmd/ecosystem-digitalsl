import { createAdminClient } from '@/lib/supabase'
import { stripe, paraCentavos } from '@/lib/stripe'
import { moverPipeline } from '@/lib/pipeline'
import {
  enviarComprovanteEstorno,
  enviarNovoLinkPagamento,
} from '@/lib/email'

export async function estornarEReemitir(params: {
  pedidoId: string
  motivo: string
  criadoPor?: string | null
}) {
  const { pedidoId, motivo, criadoPor } = params
  const supabase = createAdminClient()

  const { data: pedido, error: erroPedido } = await supabase
    .from('pedidos')
    .select('*, usuarios!pedidos_usuario_id_fkey(nome, email), produtos!pedidos_produto_id_fkey(nome, preco, stripe_price_id)')
    .eq('id', pedidoId)
    .single()

  if (erroPedido || !pedido) {
    throw new Error('Pedido não encontrado')
  }

  if (pedido.status_pagamento !== 'pago') {
    throw new Error('Só é possível estornar pedidos com status pago')
  }

  if (!pedido.stripe_payment_id) {
    throw new Error('Pedido sem payment_id do Stripe')
  }

  // 1. Estorno no Stripe
  const refund = await stripe.refunds.create({
    payment_intent: pedido.stripe_payment_id,
    reason: 'requested_by_customer',
  })

  // 2. Salvar correção
  const dadosAnteriores = {
    status_pagamento: pedido.status_pagamento,
    etapa_atual: pedido.etapa_atual,
    valor_pago: pedido.valor_pago,
  }

  await supabase.from('correcoes_pedido').insert({
    pedido_id: pedidoId,
    tipo: 'estorno_total',
    motivo,
    dados_anteriores: dadosAnteriores,
    stripe_refund_id: refund.id,
    valor_estornado: pedido.valor_pago,
    criado_por: criadoPor ?? null,
  })

  // 3. Atualizar pedido
  await supabase
    .from('pedidos')
    .update({
      status_pagamento: 'estornado',
      tem_correcao_pendente: true,
    })
    .eq('id', pedidoId)

  // 4. Cancelar certificado
  await supabase
    .from('certificados')
    .update({ status: 'cancelado' })
    .eq('pedido_id', pedidoId)

  // 5. Mover pipeline para CANCELADO
  await moverPipeline({
    pedidoId,
    etapaCodigo: 'CANCELADO',
    observacao: `Estorno total: ${motivo}`,
    criadoPor,
  })

  // 6. Criar nova sessão de checkout
  const usuario = pedido.usuarios as { nome: string; email: string }
  const produto = pedido.produtos as { nome: string; preco: number; stripe_price_id: string | null }

  const sessionParams: Record<string, unknown> = {
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: produto.nome },
        unit_amount: paraCentavos(produto.preco),
      },
      quantity: 1,
    }],
    customer_email: usuario.email,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancelado`,
    metadata: {
      pedido_original_id: pedidoId,
      usuario_id: pedido.usuario_id,
      produto_id: pedido.produto_id,
    },
  }

  // Manter split do contador se existir
  if (pedido.contador_id) {
    const { data: contador } = await supabase
      .from('contadores_parceiros')
      .select('stripe_account_id, percentual_comissao')
      .eq('id', pedido.contador_id)
      .single()

    if (contador?.stripe_account_id) {
      const comissaoCentavos = Math.round(paraCentavos(produto.preco) * contador.percentual_comissao / 100)
      sessionParams.payment_intent_data = {
        transfer_data: {
          destination: contador.stripe_account_id,
          amount: comissaoCentavos,
        },
      }
    }
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
  )

  // 7. Atualizar pedido com nova session
  await supabase
    .from('correcoes_pedido')
    .update({ nova_session_id: session.id })
    .eq('pedido_id', pedidoId)
    .eq('tipo', 'estorno_total')
    .order('created_at', { ascending: false })
    .limit(1)

  // 8. Enviar e-mails
  await enviarComprovanteEstorno({
    email: usuario.email,
    nomeCliente: usuario.nome,
    valorEstornado: pedido.valor_pago,
    motivo,
  })

  await enviarNovoLinkPagamento({
    email: usuario.email,
    nomeCliente: usuario.nome,
    checkoutUrl: session.url!,
  })

  return {
    refundId: refund.id,
    novaSessionId: session.id,
    checkoutUrl: session.url,
  }
}
