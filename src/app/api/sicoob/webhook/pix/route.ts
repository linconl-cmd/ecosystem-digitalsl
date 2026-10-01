import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { consultarCobrancaPix } from '@/lib/sicoob'
import { registrarPagamentoConfirmado } from '@/lib/pipeline'
import { enviarReciboPagamento, enviarLinkAgendamento } from '@/lib/email'
import { erroApi, sucessoApi } from '@/lib/utils'

export const runtime = 'nodejs'

// O padrão Bacen chama <webhookUrl>/pix — por isso a rota fica em /webhook/pix e
// a URL cadastrada na Sicoob para a chave Pix é <APP_URL>/api/sicoob/webhook.
interface NotificacaoPix {
  pix?: { endToEndId?: string; txid?: string }[]
}

async function processarPix(txid: string) {
  const supabase = createAdminClient()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`
      *,
      usuarios!pedidos_usuario_id_fkey(nome, email),
      products!pedidos_produto_id_fkey(name),
      contadores_parceiros!pedidos_contador_id_fkey(id, usuario_id, total_vendas, total_comissoes)
    `)
    .eq('sicoob_txid', txid)
    .single()

  // Pix sem pedido correspondente (ex.: outro recebimento na mesma chave) ou já processado
  if (!pedido || pedido.status_pagamento === 'pago') {
    return
  }

  // Não confia no payload do webhook: confirma a cobrança direto na Sicoob
  const cobranca = await consultarCobrancaPix(txid)

  if (cobranca.status !== 'CONCLUIDA' || cobranca.valorOriginal !== pedido.valor_pago) {
    return
  }

  await registrarPagamentoConfirmado({ pedidoId: pedido.id, e2eId: cobranca.e2eId })

  const usuario = pedido.usuarios as { nome: string; email: string }
  const produto = pedido.products as { name: string }
  const contador = pedido.contadores_parceiros as { id: string; usuario_id: string; total_vendas: number; total_comissoes: number } | null

  const { data: certificado } = await supabase
    .from('certificados')
    .insert({
      pedido_id: pedido.id,
      usuario_id: pedido.usuario_id,
      produto_id: pedido.produto_id,
      status: 'pendente',
      contador_indicador_id: contador?.usuario_id ?? null,
    })
    .select()
    .single()

  // Ledger da comissão: o repasse ao contador sai depois, via /api/admin/repasses
  if (contador) {
    await supabase
      .from('contadores_parceiros')
      .update({
        total_vendas: contador.total_vendas + 1,
        total_comissoes: contador.total_comissoes + pedido.comissao_valor,
      })
      .eq('id', contador.id)
  }

  await enviarReciboPagamento({
    email: usuario.email,
    nomeCliente: usuario.nome,
    nomeProduto: produto.name,
    valorPago: pedido.valor_pago,
    pedidoId: pedido.id,
  })

  if (certificado) {
    await enviarLinkAgendamento({
      email: usuario.email,
      nomeCliente: usuario.nome,
      certificadoId: certificado.id,
    })
  }
}

export async function POST(request: NextRequest) {
  let notificacao: NotificacaoPix
  try {
    notificacao = await request.json()
  } catch {
    return erroApi('Payload inválido')
  }

  for (const pix of notificacao.pix ?? []) {
    if (pix.txid) {
      await processarPix(pix.txid)
    }
  }

  return sucessoApi({ processado: true })
}
