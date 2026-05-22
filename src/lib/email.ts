import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

const from = process.env.EMAIL_FROM ?? 'contato@seudominio.com.br'
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Digital Solutions'
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function enviarReciboPagamento(params: {
  email: string
  nomeCliente: string
  nomeProduto: string
  valorPago: number
  pedidoId: string
}) {
  const { email, nomeCliente, nomeProduto, valorPago, pedidoId } = params

  await resend.emails.send({
    from: `${appName} <${from}>`,
    to: email,
    subject: `Recibo de pagamento - Pedido #${pedidoId.slice(0, 8)}`,
    html: `
      <h2>Olá, ${nomeCliente}!</h2>
      <p>Seu pagamento foi confirmado com sucesso.</p>
      <table>
        <tr><td><strong>Produto:</strong></td><td>${nomeProduto}</td></tr>
        <tr><td><strong>Valor:</strong></td><td>R$ ${valorPago.toFixed(2)}</td></tr>
        <tr><td><strong>Pedido:</strong></td><td>#${pedidoId.slice(0, 8)}</td></tr>
      </table>
      <p>Obrigado pela confiança!</p>
    `,
  })
}

export async function enviarLinkAgendamento(params: {
  email: string
  nomeCliente: string
  certificadoId: string
}) {
  const { email, nomeCliente, certificadoId } = params
  const link = `${appUrl}/agendamento?certificado=${certificadoId}`

  await resend.emails.send({
    from: `${appName} <${from}>`,
    to: email,
    subject: 'Agende a emissão do seu certificado digital',
    html: `
      <h2>Olá, ${nomeCliente}!</h2>
      <p>Seu pagamento foi confirmado. Agora você precisa agendar a emissão do seu certificado digital.</p>
      <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Agendar emissão</a></p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p>${link}</p>
    `,
  })
}

export async function enviarConfirmacaoAgendamento(params: {
  email: string
  nomeCliente: string
  dataHora: string
}) {
  const { email, nomeCliente, dataHora } = params

  await resend.emails.send({
    from: `${appName} <${from}>`,
    to: email,
    subject: 'Agendamento confirmado',
    html: `
      <h2>Olá, ${nomeCliente}!</h2>
      <p>Seu agendamento foi confirmado para <strong>${dataHora}</strong>.</p>
      <p>Se precisar reagendar, entre em contato conosco.</p>
    `,
  })
}

export async function enviarComprovanteEstorno(params: {
  email: string
  nomeCliente: string
  valorEstornado: number
  motivo: string
}) {
  const { email, nomeCliente, valorEstornado, motivo } = params

  await resend.emails.send({
    from: `${appName} <${from}>`,
    to: email,
    subject: 'Comprovante de estorno',
    html: `
      <h2>Olá, ${nomeCliente}!</h2>
      <p>Informamos que seu pagamento de <strong>R$ ${valorEstornado.toFixed(2)}</strong> foi estornado.</p>
      <p><strong>Motivo:</strong> ${motivo}</p>
      <p>O valor será devolvido conforme o prazo da sua operadora de cartão.</p>
    `,
  })
}

export async function enviarNovoLinkPagamento(params: {
  email: string
  nomeCliente: string
  checkoutUrl: string
}) {
  const { email, nomeCliente, checkoutUrl } = params

  await resend.emails.send({
    from: `${appName} <${from}>`,
    to: email,
    subject: 'Novo link de pagamento',
    html: `
      <h2>Olá, ${nomeCliente}!</h2>
      <p>Um novo link de pagamento foi gerado para você.</p>
      <p><a href="${checkoutUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Realizar pagamento</a></p>
      <p>Este link expira em 24 horas.</p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p>${checkoutUrl}</p>
    `,
  })
}

export async function enviarConviteParceria(params: {
  email: string
  nomeContador: string
  token: string
}) {
  const { email, nomeContador, token } = params
  const link = `${appUrl}/parceria/assinar?token=${token}`

  await resend.emails.send({
    from: `${appName} <${from}>`,
    to: email,
    subject: `Convite de parceria - ${appName}`,
    html: `
      <h2>Olá, ${nomeContador}!</h2>
      <p>Você foi convidado(a) para ser um parceiro(a) ${appName}.</p>
      <p>Clique no link abaixo para visualizar e assinar o contrato de parceria:</p>
      <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Ver contrato de parceria</a></p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p>${link}</p>
    `,
  })
}

export async function enviarNotificacaoEtapa(params: {
  email: string
  nomeCliente: string
  etapaNome: string
  observacao?: string
}) {
  const { email, nomeCliente, etapaNome, observacao } = params

  await resend.emails.send({
    from: `${appName} <${from}>`,
    to: email,
    subject: `Atualização do seu pedido - ${etapaNome}`,
    html: `
      <h2>Olá, ${nomeCliente}!</h2>
      <p>Seu pedido foi atualizado para: <strong>${etapaNome}</strong></p>
      ${observacao ? `<p><strong>Observação:</strong> ${observacao}</p>` : ''}
      <p>Obrigado pela confiança!</p>
    `,
  })
}
