import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { criarCobrancaPix } from '@/lib/sicoob'
import { moverPipeline } from '@/lib/pipeline'
import { criarCheckoutSchema } from '@/schemas'
import { calcularSplit, erroApi, sucessoApi } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body: unknown = await request.json()
  const resultado = criarCheckoutSchema.safeParse(body)

  if (!resultado.success) {
    return erroApi(resultado.error.issues.map((e: { message: string }) => e.message).join(', '))
  }

  const { produto_id, periodo_meses, cupom_codigo, dados_cliente } = resultado.data
  const supabase = createAdminClient()

  const { data: produto, error: erroProduto } = await supabase
    .from('products')
    .select('*')
    .eq('id', produto_id)
    .eq('active', true)
    .single()

  if (erroProduto || !produto) {
    return erroApi('Produto não encontrado ou indisponível', 404)
  }

  // Produto sem períodos só existe em 12 meses; com períodos, o preço vem da coluna do período escolhido
  const periodoEfetivo = produto.has_periods ? periodo_meses : 12
  const precoBase: number | null = !produto.has_periods
    ? produto.price
    : periodo_meses === 24 ? produto.price_24m : produto.price_12m

  if (precoBase === null) {
    return erroApi('Período indisponível para este produto')
  }

  let cupom: { id: string; percentual_desconto: number; contador_id: string | null; limite_usos: number | null; usos_realizados: number } | null = null

  if (cupom_codigo) {
    const { data: cupomData } = await supabase
      .from('cupons')
      .select('id, percentual_desconto, contador_id, limite_usos, usos_realizados, validade')
      .eq('codigo', cupom_codigo.toUpperCase())
      .eq('ativo', true)
      .single()

    if (!cupomData) {
      return erroApi('Cupom inválido ou inativo')
    }

    if (cupomData.validade && new Date(cupomData.validade) < new Date()) {
      return erroApi('Cupom expirado')
    }

    if (cupomData.limite_usos !== null && cupomData.usos_realizados >= cupomData.limite_usos) {
      return erroApi('Cupom atingiu o limite de usos')
    }

    cupom = cupomData
  }

  const desconto = cupom ? Math.round(precoBase * cupom.percentual_desconto) / 100 : 0
  const valorPago = Math.round((precoBase - desconto) * 100) / 100

  let contadorParceiro: { id: string; percentual_comissao: number } | null = null

  if (cupom?.contador_id) {
    const { data } = await supabase
      .from('contadores_parceiros')
      .select('id, percentual_comissao')
      .eq('usuario_id', cupom.contador_id)
      .eq('ativo', true)
      .single()

    contadorParceiro = data
  }

  // Snapshot da comissão: fica imutável no pedido mesmo que o contador mude de % depois
  const comissaoPercentual = contadorParceiro?.percentual_comissao ?? 0
  const { comissaoValor, liquidoValor } = calcularSplit(valorPago, comissaoPercentual)

  const { data: usuario, error: erroUsuario } = await supabase
    .from('usuarios')
    .upsert(
      {
        nome: dados_cliente.nome,
        email: dados_cliente.email,
        cpf_cnpj: dados_cliente.cpf_cnpj.replace(/\D/g, ''),
        telefone: dados_cliente.telefone ?? null,
        tipo: 'cliente',
        contador_indicador_id: cupom?.contador_id ?? null,
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (erroUsuario || !usuario) {
    return erroApi(`Erro ao registrar cliente: ${erroUsuario?.message}`, 500)
  }

  const { data: pedido, error: erroPedido } = await supabase
    .from('pedidos')
    .insert({
      usuario_id: usuario.id,
      produto_id: produto.id,
      contador_id: contadorParceiro?.id ?? null,
      cupom_id: cupom?.id ?? null,
      periodo_meses: periodoEfetivo,
      valor_bruto: precoBase,
      valor_desconto: desconto,
      valor_pago: valorPago,
      comissao_percentual: comissaoPercentual,
      comissao_valor: comissaoValor,
      valor_liquido: liquidoValor,
      status_pagamento: 'aguardando',
    })
    .select()
    .single()

  if (erroPedido || !pedido) {
    return erroApi(`Erro ao criar pedido: ${erroPedido?.message}`, 500)
  }

  await moverPipeline({
    pedidoId: pedido.id,
    etapaCodigo: 'AGUARDANDO_PAGAMENTO',
  })

  const cobranca = await criarCobrancaPix({
    pedidoId: pedido.id,
    valor: valorPago,
    devedor: { nome: dados_cliente.nome, cpfCnpj: dados_cliente.cpf_cnpj },
  })

  await supabase
    .from('pedidos')
    .update({ sicoob_txid: cobranca.txid, pix_copia_e_cola: cobranca.pixCopiaECola })
    .eq('id', pedido.id)

  if (cupom) {
    await supabase
      .from('cupons')
      .update({ usos_realizados: cupom.usos_realizados + 1 })
      .eq('id', cupom.id)
  }

  return sucessoApi({
    pedidoId: pedido.id,
    pixCopiaECola: cobranca.pixCopiaECola,
    valor: valorPago,
  }, 201)
}
