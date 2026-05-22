import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

export function paraCentavos(reais: number): number {
  return Math.round(reais * 100)
}

export function paraReais(centavos: number): number {
  return centavos / 100
}

export function calcularSplit(valorPagoCentavos: number, percentualComissao: number) {
  const comissaoCentavos = Math.round(valorPagoCentavos * percentualComissao / 100)
  const liquidoCentavos = valorPagoCentavos - comissaoCentavos

  return {
    comissaoCentavos,
    liquidoCentavos,
    comissaoReais: paraReais(comissaoCentavos),
    liquidoReais: paraReais(liquidoCentavos),
  }
}
