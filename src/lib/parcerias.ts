import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase-server'
import { enviarConviteParceria } from '@/lib/email'

export async function criarConviteParceria(params: {
  emailContador: string
  nomeContador: string
  percentualComissao: number
  percentualDescontoCupom: number
  codigoCupom: string
  prazoValidadeParceria?: string | null
  observacoes?: string | null
  modeloContratoId: string
  criadoPor?: string | null
  origem?: 'admin' | 'contador'
}) {
  const supabase = createAdminClient()

  const { data: modelo, error: erroModelo } = await supabase
    .from('modelos_contrato')
    .select('versao')
    .eq('id', params.modeloContratoId)
    .single()

  if (erroModelo || !modelo) {
    throw new Error('Modelo de contrato não encontrado')
  }

  const token = randomUUID()
  const tokenExpiraEm = new Date()
  tokenExpiraEm.setDate(tokenExpiraEm.getDate() + 7)

  const { data: convite, error } = await supabase
    .from('convites_parceria')
    .insert({
      email_contador: params.emailContador,
      nome_contador: params.nomeContador,
      percentual_comissao: params.percentualComissao,
      percentual_desconto_cupom: params.percentualDescontoCupom,
      codigo_cupom: params.codigoCupom.toUpperCase(),
      prazo_validade_parceria: params.prazoValidadeParceria ?? null,
      observacoes: params.observacoes ?? null,
      modelo_contrato_id: params.modeloContratoId,
      versao_contrato: modelo.versao,
      token,
      token_expira_em: tokenExpiraEm.toISOString(),
      status: 'pendente',
      origem: params.origem ?? 'admin',
      criado_por: params.criadoPor ?? null,
    })
    .select()
    .single()

  if (error || !convite) {
    throw new Error(`Erro ao criar convite: ${error?.message}`)
  }

  await enviarConviteParceria({
    email: params.emailContador,
    nomeContador: params.nomeContador,
    token,
  })

  return convite
}

export async function buscarContratoPorToken(token: string) {
  const supabase = createAdminClient()

  const { data: convite, error } = await supabase
    .from('convites_parceria')
    .select('*, modelos_contrato(*)')
    .eq('token', token)
    .single()

  if (error || !convite) {
    throw new Error('Convite não encontrado')
  }

  if (new Date(convite.token_expira_em) < new Date()) {
    await supabase
      .from('convites_parceria')
      .update({ status: 'expirado' })
      .eq('id', convite.id)

    throw new Error('Token expirado')
  }

  if (convite.status === 'pendente') {
    await supabase
      .from('convites_parceria')
      .update({ status: 'visualizado' })
      .eq('id', convite.id)
  }

  const modelo = convite.modelos_contrato as { conteudo: string }
  const conteudoRenderizado = modelo.conteudo
    .replace(/\{\{nome_contador\}\}/g, convite.nome_contador)
    .replace(/\{\{percentual_comissao\}\}/g, String(convite.percentual_comissao))
    .replace(/\{\{codigo_cupom\}\}/g, convite.codigo_cupom)
    .replace(/\{\{percentual_desconto\}\}/g, String(convite.percentual_desconto_cupom))
    .replace(/\{\{prazo_validade\}\}/g, convite.prazo_validade_parceria ?? 'Indeterminado')
    .replace(/\{\{nome_empresa\}\}/g, process.env.NEXT_PUBLIC_APP_NAME ?? 'Digital Solutions')
    .replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'))
    .replace(/\{\{observacoes\}\}/g, convite.observacoes ?? '')

  return {
    convite,
    conteudoRenderizado,
  }
}

export async function registrarAssinatura(params: {
  token: string
  nomeCompleto: string
  cpf: string
  email: string
  ipAddress: string
  userAgent: string
}) {
  const supabase = createAdminClient()

  const { convite, conteudoRenderizado } = await buscarContratoPorToken(params.token)

  if (convite.status === 'assinado') {
    throw new Error('Este contrato já foi assinado')
  }

  if (convite.status === 'recusado' || convite.status === 'expirado') {
    throw new Error('Este convite não está mais disponível')
  }

  // Gerar hash SHA-256 para validade jurídica
  const encoder = new TextEncoder()
  const data = encoder.encode(
    `${conteudoRenderizado}|${params.nomeCompleto}|${params.cpf}|${params.ipAddress}|${new Date().toISOString()}`
  )
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  // Criar usuário do tipo contador
  const { data: usuario, error: erroUsuario } = await supabase
    .from('usuarios')
    .upsert(
      {
        nome: params.nomeCompleto,
        email: params.email,
        cpf_cnpj: params.cpf.replace(/\D/g, ''),
        tipo: 'contador',
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (erroUsuario || !usuario) {
    throw new Error(`Erro ao criar usuário: ${erroUsuario?.message}`)
  }

  // Criar cupom
  const { data: cupom } = await supabase
    .from('cupons')
    .insert({
      codigo: convite.codigo_cupom,
      percentual_desconto: convite.percentual_desconto_cupom,
      contador_id: usuario.id,
      ativo: true,
    })
    .select()
    .single()

  // Criar registro de contador parceiro
  const { data: contadorParceiro, error: erroContador } = await supabase
    .from('contadores_parceiros')
    .insert({
      usuario_id: usuario.id,
      percentual_comissao: convite.percentual_comissao,
      percentual_desconto_cupom: convite.percentual_desconto_cupom,
      cupom_id: cupom?.id ?? null,
      ativo: true,
    })
    .select()
    .single()

  if (erroContador || !contadorParceiro) {
    throw new Error(`Erro ao criar contador parceiro: ${erroContador?.message}`)
  }

  // Registrar assinatura
  const { data: assinatura, error: erroAssinatura } = await supabase
    .from('assinaturas_contrato')
    .insert({
      convite_id: convite.id,
      contador_parceiro_id: contadorParceiro.id,
      nome_completo: params.nomeCompleto,
      cpf: params.cpf.replace(/\D/g, ''),
      email: params.email,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      conteudo_contrato_assinado: conteudoRenderizado,
      versao_contrato: convite.versao_contrato,
      percentual_comissao_acordado: convite.percentual_comissao,
      percentual_desconto_acordado: convite.percentual_desconto_cupom,
      codigo_cupom_acordado: convite.codigo_cupom,
      prazo_validade_acordado: convite.prazo_validade_parceria,
      hash_integridade: hashHex,
    })
    .select()
    .single()

  if (erroAssinatura) {
    throw new Error(`Erro ao registrar assinatura: ${erroAssinatura.message}`)
  }

  // Atualizar convite
  await supabase
    .from('convites_parceria')
    .update({ status: 'assinado' })
    .eq('id', convite.id)

  return assinatura
}

export async function solicitarParceria(params: {
  nome: string
  email: string
  cpf: string
  telefone?: string | null
  nomeEscritorio?: string | null
  crc?: string | null
  mensagem?: string | null
}) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('solicitacoes_parceria')
    .insert({
      nome: params.nome,
      email: params.email,
      cpf: params.cpf.replace(/\D/g, ''),
      telefone: params.telefone ?? null,
      nome_escritorio: params.nomeEscritorio ?? null,
      crc: params.crc ?? null,
      mensagem: params.mensagem ?? null,
      status: 'aguardando',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao salvar solicitação: ${error.message}`)
  }

  return data
}

export async function aprovarSolicitacao(params: {
  solicitacaoId: string
  percentualComissao: number
  percentualDescontoCupom: number
  codigoCupom: string
  modeloContratoId: string
  criadoPor?: string | null
}) {
  const supabase = createAdminClient()

  const { data: solicitacao, error: erroSolicitacao } = await supabase
    .from('solicitacoes_parceria')
    .select('*')
    .eq('id', params.solicitacaoId)
    .single()

  if (erroSolicitacao || !solicitacao) {
    throw new Error('Solicitação não encontrada')
  }

  if (solicitacao.status !== 'aguardando') {
    throw new Error('Solicitação já foi processada')
  }

  const convite = await criarConviteParceria({
    emailContador: solicitacao.email,
    nomeContador: solicitacao.nome,
    percentualComissao: params.percentualComissao,
    percentualDescontoCupom: params.percentualDescontoCupom,
    codigoCupom: params.codigoCupom,
    modeloContratoId: params.modeloContratoId,
    criadoPor: params.criadoPor,
    origem: 'contador',
  })

  await supabase
    .from('solicitacoes_parceria')
    .update({
      status: 'aprovado',
      convite_id: convite.id,
    })
    .eq('id', params.solicitacaoId)

  return convite
}
