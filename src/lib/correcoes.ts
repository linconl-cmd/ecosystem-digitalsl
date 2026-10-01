import { createAdminClient } from '@/lib/supabase'
import { criarCobrancaPix, devolverPix } from '@/lib/sicoob'
import { moverPipeline } from '@/lib/pipeline'
import { calcularSplit } from '@/lib/utils'
import {
  enviarComprovanteEstorno,
  enviarNovaCobrancaPix,
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
    .select('*, usuarios!pedidos_usuario_id_fkey(nome, email, cpf_cnpj)')
    .eq('id', pedidoId)
    .single()

  if (erroPedido || !pedido) {
    throw new Error('Pedido não encontrado')
  }

  if (pedido.status_pagamento !== 'pago') {
    throw new Error('Só é possível estornar pedidos com status pago')
  }

  if (!pedido.sicoob_e2e_id) {
    throw new Error('Pedido sem e2eId do Pix — não é possível devolver o pagamento')
  }

  const usuario = pedido.usuarios as { nome: string; email: string; cpf_cnpj: string }

  // 1. Devolução total do Pix na Sicoob
  const devolucao = await devolverPix({ e2eId: pedido.sicoob_e2e_id, valor: pedido.valor_pago })

  // 2. Salvar correção
  const { data: correcao, error: erroCorrecao } = await supabase
    .from('correcoes_pedido')
    .insert({
      pedido_id: pedidoId,
      tipo: 'estorno_total',
      motivo,
      dados_anteriores: {
        status_pagamento: pedido.status_pagamento,
        etapa_atual: pedido.etapa_atual,
        valor_pago: pedido.valor_pago,
      },
      sicoob_devolucao_id: devolucao.id,
      valor_estornado: pedido.valor_pago,
      criado_por: criadoPor ?? null,
    })
    .select()
    .single()

  if (erroCorrecao || !correcao) {
    throw new Error(`Erro ao registrar correção: ${erroCorrecao?.message}`)
  }

  // 3. Atualizar pedido original
  await supabase
    .from('pedidos')
    .update({ status_pagamento: 'estornado', tem_correcao_pendente: true })
    .eq('id', pedidoId)

  // 4. Cancelar certificado
  await supabase
    .from('certificados')
    .update({ status: 'cancelado' })
    .eq('pedido_id', pedidoId)

  // 5. Mover pipeline do pedido original para CANCELADO
  await moverPipeline({
    pedidoId,
    etapaCodigo: 'CANCELADO',
    observacao: `Estorno total: ${motivo}`,
    criadoPor,
  })

  // 6. Novo pedido (mantém o snapshot de comissão do contador, se houver)
  const { comissaoValor, liquidoValor } = calcularSplit(pedido.valor_pago, pedido.comissao_percentual)

  const { data: novoPedido, error: erroNovoPedido } = await supabase
    .from('pedidos')
    .insert({
      usuario_id: pedido.usuario_id,
      produto_id: pedido.produto_id,
      periodo_meses: pedido.periodo_meses,
      contador_id: pedido.contador_id,
      cupom_id: pedido.cupom_id,
      valor_bruto: pedido.valor_bruto,
      valor_desconto: pedido.valor_desconto,
      valor_pago: pedido.valor_pago,
      comissao_percentual: pedido.comissao_percentual,
      comissao_valor: comissaoValor,
      valor_liquido: liquidoValor,
      status_pagamento: 'aguardando',
    })
    .select()
    .single()

  if (erroNovoPedido || !novoPedido) {
    throw new Error(`Erro ao criar novo pedido: ${erroNovoPedido?.message}`)
  }

  await supabase
    .from('pedidos')
    .update({ novo_pedido_id: novoPedido.id })
    .eq('id', pedidoId)

  await moverPipeline({
    pedidoId: novoPedido.id,
    etapaCodigo: 'AGUARDANDO_PAGAMENTO',
    observacao: 'Pedido gerado após estorno do pedido anterior',
    criadoPor,
  })

  // 7. Nova cobrança Pix (expira em 24h)
  const cobranca = await criarCobrancaPix({
    pedidoId: novoPedido.id,
    valor: pedido.valor_pago,
    devedor: { nome: usuario.nome, cpfCnpj: usuario.cpf_cnpj },
  })

  await supabase
    .from('pedidos')
    .update({ sicoob_txid: cobranca.txid, pix_copia_e_cola: cobranca.pixCopiaECola })
    .eq('id', novoPedido.id)

  await supabase
    .from('correcoes_pedido')
    .update({ novo_txid: cobranca.txid })
    .eq('id', correcao.id)

  // 8. E-mails ao cliente
  await enviarComprovanteEstorno({
    email: usuario.email,
    nomeCliente: usuario.nome,
    valorEstornado: pedido.valor_pago,
    motivo,
  })

  await enviarNovaCobrancaPix({
    email: usuario.email,
    nomeCliente: usuario.nome,
    pixCopiaECola: cobranca.pixCopiaECola,
  })

  return {
    devolucaoId: devolucao.id,
    novoPedidoId: novoPedido.id,
    pixCopiaECola: cobranca.pixCopiaECola,
  }
}
