import { z } from 'zod'

// Validadores auxiliares
const cpfRegex = /^\d{11}$/
const cnpjRegex = /^\d{14}$/

export const cpfOuCnpjSchema = z.string().refine(
  (val) => {
    const limpo = val.replace(/\D/g, '')
    return cpfRegex.test(limpo) || cnpjRegex.test(limpo)
  },
  { message: 'CPF ou CNPJ inválido' }
)

// Usuarios
export const criarUsuarioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  cpf_cnpj: cpfOuCnpjSchema,
  telefone: z.string().nullable().optional(),
  tipo: z.enum(['cliente', 'contador', 'admin']).default('cliente'),
  contador_indicador_id: z.string().uuid().nullable().optional(),
})

// Produtos
export const criarProdutoSchema = z.object({
  nome: z.string().min(2, 'Nome do produto é obrigatório'),
  descricao: z.string().nullable().optional(),
  preco: z.number().positive('Preço deve ser positivo'),
  validade_meses: z.number().int().positive('Validade deve ser positiva'),
  imagem_url: z.string().url().nullable().optional(),
  ativo: z.boolean().default(true),
  stripe_price_id: z.string().nullable().optional(),
})

export const atualizarProdutoSchema = criarProdutoSchema.partial()

// Cupons
export const criarCupomSchema = z.object({
  codigo: z.string().min(3, 'Código deve ter ao menos 3 caracteres').toUpperCase(),
  percentual_desconto: z.number().min(1).max(100),
  contador_id: z.string().uuid().nullable().optional(),
  validade: z.string().datetime().nullable().optional(),
  limite_usos: z.number().int().positive().nullable().optional(),
  ativo: z.boolean().default(true),
})

// Pedidos
export const criarPedidoSchema = z.object({
  usuario_id: z.string().uuid(),
  produto_id: z.string().uuid(),
  contador_id: z.string().uuid().nullable().optional(),
  cupom_id: z.string().uuid().nullable().optional(),
  valor_bruto: z.number().positive(),
  valor_desconto: z.number().min(0).default(0),
  valor_pago: z.number().positive(),
  comissao_percentual: z.number().min(0).max(100).default(0),
  comissao_valor: z.number().min(0).default(0),
  valor_liquido: z.number().positive(),
  stripe_session_id: z.string().nullable().optional(),
})

// Agendamentos
export const criarAgendamentoSchema = z.object({
  certificado_id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  data_hora: z.string().datetime(),
  duracao_minutos: z.number().int().positive().default(60),
  observacoes_cliente: z.string().nullable().optional(),
})

export const atualizarAgendamentoSchema = z.object({
  data_hora: z.string().datetime().optional(),
  status: z.enum(['agendado', 'confirmado', 'realizado', 'cancelado', 'reagendado']).optional(),
  observacoes_admin: z.string().nullable().optional(),
})

// Disponibilidade
export const criarDisponibilidadeSchema = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  intervalo_minutos: z.number().int().positive().default(30),
  max_por_horario: z.number().int().positive().default(1),
  ativo: z.boolean().default(true),
})

// Bloqueios
export const criarBloqueioSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  motivo: z.string().nullable().optional(),
})

// Pipeline
export const moverPipelineSchema = z.object({
  pedido_id: z.string().uuid(),
  etapa_codigo: z.enum([
    'AGUARDANDO_PAGAMENTO',
    'PAGO_AGUARDANDO_ATENDIMENTO',
    'EM_ATENDIMENTO',
    'AGUARDANDO_EMISSAO',
    'CERTIFICADO_EMITIDO',
    'ENVIADO_CLIENTE',
    'ENVIADO_CONTABILIDADE',
    'FINALIZADO',
    'CANCELADO',
  ]),
  observacao: z.string().nullable().optional(),
  criado_por: z.string().uuid().nullable().optional(),
})

// Correções
export const criarCorrecaoSchema = z.object({
  pedido_id: z.string().uuid(),
  motivo: z.string().min(5, 'Motivo deve ter ao menos 5 caracteres'),
})

// Parcerias - Convite
export const criarConviteSchema = z.object({
  email_contador: z.string().email('E-mail inválido'),
  nome_contador: z.string().min(2),
  percentual_comissao: z.number().min(1).max(50),
  percentual_desconto_cupom: z.number().min(1).max(50),
  codigo_cupom: z.string().min(3).toUpperCase(),
  prazo_validade_parceria: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  modelo_contrato_id: z.string().uuid(),
})

// Parcerias - Assinatura
export const assinarContratoSchema = z.object({
  token: z.string().min(1),
  nome_completo: z.string().min(5, 'Nome completo é obrigatório'),
  cpf: cpfOuCnpjSchema,
  email: z.string().email('E-mail inválido'),
})

// Parcerias - Solicitação
export const solicitarParceriaSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cpf: cpfOuCnpjSchema,
  telefone: z.string().nullable().optional(),
  nome_escritorio: z.string().nullable().optional(),
  crc: z.string().nullable().optional(),
  mensagem: z.string().nullable().optional(),
})

// Checkout
export const criarCheckoutSchema = z.object({
  produto_id: z.string().uuid(),
  cupom_codigo: z.string().optional(),
  dados_cliente: z.object({
    nome: z.string().min(2),
    email: z.string().email(),
    cpf_cnpj: cpfOuCnpjSchema,
    telefone: z.string().nullable().optional(),
  }),
})

// Consulta
export const consultaClienteSchema = z.object({
  busca: z.string().min(2, 'Busca deve ter ao menos 2 caracteres'),
})

// Contador - Gerar link de venda
export const gerarVendaSchema = z.object({
  produto_id: z.string().uuid(),
})

// Contador - Extrato
export const extratoSchema = z.object({
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
