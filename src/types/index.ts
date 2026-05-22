export type TipoUsuario = 'cliente' | 'contador' | 'admin'

export type StatusPagamento = 'aguardando' | 'pago' | 'estornado' | 'falhou'

export type StatusCertificado = 'pendente' | 'ativo' | 'expirado' | 'cancelado'

export type StatusAgendamento = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'reagendado'

export type EtapaCodigo =
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGO_AGUARDANDO_ATENDIMENTO'
  | 'EM_ATENDIMENTO'
  | 'AGUARDANDO_EMISSAO'
  | 'CERTIFICADO_EMITIDO'
  | 'ENVIADO_CLIENTE'
  | 'ENVIADO_CONTABILIDADE'
  | 'FINALIZADO'
  | 'CANCELADO'

export type StatusConvite = 'pendente' | 'visualizado' | 'assinado' | 'recusado' | 'expirado'

export type OrigemConvite = 'admin' | 'contador'

export type StatusSolicitacao = 'aguardando' | 'aprovado' | 'recusado'

export type TipoCorrecao = 'estorno_total'

export interface Usuario {
  id: string
  nome: string
  email: string
  cpf_cnpj: string
  telefone: string | null
  tipo: TipoUsuario
  contador_indicador_id: string | null
  created_at: string
}

export interface Produto {
  id: string
  nome: string
  descricao: string | null
  preco: number
  validade_meses: number
  imagem_url: string | null
  ativo: boolean
  stripe_price_id: string | null
  created_at: string
}

export interface Cupom {
  id: string
  codigo: string
  percentual_desconto: number
  contador_id: string | null
  validade: string | null
  limite_usos: number | null
  usos_realizados: number
  ativo: boolean
  created_at: string
}

export interface ContadorParceiro {
  id: string
  usuario_id: string
  percentual_comissao: number
  percentual_desconto_cupom: number
  chave_pix: string | null
  dados_bancarios: Record<string, unknown> | null
  stripe_account_id: string | null
  cupom_id: string | null
  total_vendas: number
  total_comissoes: number
  ativo: boolean
  created_at: string
}

export interface Pedido {
  id: string
  usuario_id: string
  produto_id: string
  contador_id: string | null
  cupom_id: string | null
  valor_bruto: number
  valor_desconto: number
  valor_pago: number
  comissao_percentual: number
  comissao_valor: number
  valor_liquido: number
  status_pagamento: StatusPagamento
  etapa_atual: EtapaCodigo | null
  stripe_session_id: string | null
  stripe_payment_id: string | null
  tem_correcao_pendente: boolean
  novo_pedido_id: string | null
  created_at: string
}

export interface Certificado {
  id: string
  pedido_id: string
  usuario_id: string
  produto_id: string
  data_compra: string
  data_validacao: string | null
  data_expiracao: string | null
  status: StatusCertificado
  numero_serie: string | null
  contador_indicador_id: string | null
  created_at: string
}

export interface Disponibilidade {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  intervalo_minutos: number
  max_por_horario: number
  ativo: boolean
}

export interface Bloqueio {
  id: string
  data: string
  hora_inicio: string | null
  hora_fim: string | null
  motivo: string | null
  created_at: string
}

export interface Agendamento {
  id: string
  certificado_id: string
  usuario_id: string
  data_hora: string
  duracao_minutos: number
  status: StatusAgendamento
  observacoes_cliente: string | null
  observacoes_admin: string | null
  notificacao_enviada: boolean
  created_at: string
}

export interface EtapaPipeline {
  id: string
  codigo: EtapaCodigo
  nome: string
  descricao: string | null
  cor: string
  icone: string | null
  ordem: number
  notificar_cliente: boolean
  ativo: boolean
}

export interface PedidoPipelineHistorico {
  id: string
  pedido_id: string
  etapa_codigo: EtapaCodigo
  observacao: string | null
  criado_por: string | null
  created_at: string
}

export interface CorrecaoPedido {
  id: string
  pedido_id: string
  tipo: TipoCorrecao
  motivo: string
  dados_anteriores: Record<string, unknown>
  stripe_refund_id: string | null
  valor_estornado: number
  nova_session_id: string | null
  criado_por: string | null
  created_at: string
}

export interface ModeloContrato {
  id: string
  nome: string
  versao: number
  conteudo: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface ConviteParceria {
  id: string
  email_contador: string
  nome_contador: string
  percentual_comissao: number
  percentual_desconto_cupom: number
  codigo_cupom: string
  prazo_validade_parceria: string | null
  observacoes: string | null
  modelo_contrato_id: string
  versao_contrato: number
  token: string
  token_expira_em: string
  status: StatusConvite
  origem: OrigemConvite
  criado_por: string | null
  criado_em: string
}

export interface AssinaturaContrato {
  id: string
  convite_id: string
  contador_parceiro_id: string | null
  nome_completo: string
  cpf: string
  email: string
  ip_address: string
  user_agent: string
  assinado_em: string
  conteudo_contrato_assinado: string
  versao_contrato: number
  percentual_comissao_acordado: number
  percentual_desconto_acordado: number
  codigo_cupom_acordado: string
  prazo_validade_acordado: string | null
  hash_integridade: string
}

export interface SolicitacaoParceria {
  id: string
  nome: string
  email: string
  cpf: string
  telefone: string | null
  nome_escritorio: string | null
  crc: string | null
  mensagem: string | null
  status: StatusSolicitacao
  observacao_admin: string | null
  convite_id: string | null
  criado_em: string
}

export interface PainelAtendimento {
  id: string
  usuario_nome: string
  usuario_email: string
  produto_nome: string
  valor_pago: number
  status_pagamento: StatusPagamento
  etapa_atual: EtapaCodigo | null
  etapa_nome: string | null
  etapa_cor: string | null
  contador_nome: string | null
  certificado_status: StatusCertificado | null
  agendamento_data: string | null
  agendamento_status: StatusAgendamento | null
  horas_na_etapa_atual: number | null
  created_at: string
}

export interface ResumoMensal {
  mes: string
  total_pedidos: number
  finalizados: number
  cancelados: number
  em_andamento: number
  receita_bruta: number
  receita_liquida: number
  total_comissoes_pagas: number
  media_horas_para_finalizar: number | null
}
