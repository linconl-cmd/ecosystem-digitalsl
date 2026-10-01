import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { NextResponse } from 'next/server'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarData(data: string | Date, formato = "dd/MM/yyyy"): string {
  return format(new Date(data), formato, { locale: ptBR })
}

export function formatarCpfOuCnpj(valor: string): string {
  const limpo = valor.replace(/\D/g, '')
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return valor
}

// Comissão só é registrada em ledger (o repasse é feito depois via Pix), então
// o cálculo é em reais com arredondamento de centavos.
export function calcularSplit(valorPago: number, percentualComissao: number) {
  const comissaoValor = Math.round(valorPago * percentualComissao) / 100
  const liquidoValor = Math.round((valorPago - comissaoValor) * 100) / 100

  return { comissaoValor, liquidoValor }
}

export function erroApi(mensagem: string, status = 400) {
  return NextResponse.json({ erro: mensagem }, { status })
}

export function sucessoApi<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}
