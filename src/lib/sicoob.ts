import https from 'node:https'
import { randomUUID } from 'node:crypto'

// ATENÇÃO: endpoints e payloads reconstruídos a partir da documentação pública
// da Sicoob (developers.sicoob.com.br) e do padrão Bacen da API Pix. Validar
// contra o sandbox real antes de usar em produção — path base, escopos e o
// endpoint de transferência (repasse) podem divergir.
const SICOOB_AUTH_URL = 'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token'
const SICOOB_API_URL = 'https://api.sicoob.com.br'
const SICOOB_PIX_URL = `${SICOOB_API_URL}/pix/api/v2`

function criarAgenteMtls(): https.Agent {
  return new https.Agent({
    pfx: Buffer.from(process.env.SICOOB_CERTIFICADO_BASE64!, 'base64'),
    passphrase: process.env.SICOOB_CERTIFICADO_SENHA!,
  })
}

function requisitar(
  url: string,
  options: https.RequestOptions,
  body?: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function obterToken(scope: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SICOOB_CLIENT_ID!,
    scope,
  })

  const resposta = await requisitar(SICOOB_AUTH_URL, {
    method: 'POST',
    agent: criarAgenteMtls(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, params.toString())

  if (resposta.status !== 200) {
    throw new Error(`Erro ao autenticar na Sicoob: ${resposta.body}`)
  }

  const dados = JSON.parse(resposta.body) as { access_token: string }
  return dados.access_token
}

async function chamarApi(params: {
  url: string
  method: 'GET' | 'PUT' | 'POST'
  scope: string
  body?: unknown
}): Promise<string> {
  const token = await obterToken(params.scope)

  const resposta = await requisitar(params.url, {
    method: params.method,
    agent: criarAgenteMtls(),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      client_id: process.env.SICOOB_CLIENT_ID!,
    },
  }, params.body ? JSON.stringify(params.body) : undefined)

  if (resposta.status < 200 || resposta.status >= 300) {
    throw new Error(`Sicoob respondeu ${resposta.status} em ${params.method} ${params.url}: ${resposta.body}`)
  }

  return resposta.body
}

// O txid da cobrança é derivado do id do pedido (32 caracteres alfanuméricos,
// dentro do limite de 26–35 do Bacen) para localizar o pedido no webhook.
export function txidDoPedido(pedidoId: string): string {
  return pedidoId.replace(/-/g, '')
}

export async function criarCobrancaPix(params: {
  pedidoId: string
  valor: number
  devedor: { nome: string; cpfCnpj: string }
}): Promise<{ txid: string; pixCopiaECola: string }> {
  const { pedidoId, valor, devedor } = params
  const txid = txidDoPedido(pedidoId)
  const documento = devedor.cpfCnpj.replace(/\D/g, '')

  const corpo = await chamarApi({
    url: `${SICOOB_PIX_URL}/cob/${txid}`,
    method: 'PUT',
    scope: 'cob.write cob.read',
    body: {
      calendario: { expiracao: 86400 },
      devedor: documento.length === 11
        ? { cpf: documento, nome: devedor.nome }
        : { cnpj: documento, nome: devedor.nome },
      valor: { original: valor.toFixed(2) },
      chave: process.env.SICOOB_CHAVE_PIX!,
      solicitacaoPagador: 'Certificado digital',
    },
  })

  const dados = JSON.parse(corpo) as { txid: string; pixCopiaECola: string }
  return { txid: dados.txid, pixCopiaECola: dados.pixCopiaECola }
}

// O webhook não é confiável por si só (o padrão Pix não assina o payload), então
// a confirmação de pagamento sempre passa por esta consulta direta à Sicoob.
export async function consultarCobrancaPix(txid: string): Promise<{
  status: string
  valorOriginal: number
  e2eId: string | null
}> {
  const corpo = await chamarApi({
    url: `${SICOOB_PIX_URL}/cob/${txid}`,
    method: 'GET',
    scope: 'cob.read',
  })

  const dados = JSON.parse(corpo) as {
    status: string
    valor: { original: string }
    pix?: { endToEndId: string }[]
  }

  return {
    status: dados.status,
    valorOriginal: Number(dados.valor.original),
    e2eId: dados.pix?.[0]?.endToEndId ?? null,
  }
}

// Devolução total de um Pix recebido (estorno): PUT /pix/{e2eId}/devolucao/{id}
export async function devolverPix(params: {
  e2eId: string
  valor: number
}): Promise<{ id: string }> {
  const idDevolucao = randomUUID().replace(/-/g, '')

  await chamarApi({
    url: `${SICOOB_PIX_URL}/pix/${params.e2eId}/devolucao/${idDevolucao}`,
    method: 'PUT',
    scope: 'pix.write pix.read',
    body: { valor: params.valor.toFixed(2) },
  })

  return { id: idDevolucao }
}

// Transferência Pix avulsa para a chave do contador (repasse de comissão)
export async function enviarPixTransferencia(params: {
  chavePix: string
  valor: number
  identificador: string
}): Promise<{ transacaoId: string }> {
  const { chavePix, valor, identificador } = params

  const corpo = await chamarApi({
    url: `${SICOOB_API_URL}/pagamentos/v3/pix`,
    method: 'POST',
    scope: 'cco_transferencias.write pagamentos_pix.write',
    body: {
      valor: valor.toFixed(2),
      chave: chavePix,
      numeroIdentificacaoTransferencia: identificador,
    },
  })

  const dados = JSON.parse(corpo) as { e2eId?: string; transacaoId?: string }
  return { transacaoId: dados.e2eId ?? dados.transacaoId ?? identificador }
}
