'use client'

import { useState } from 'react'
import type { EtapaPipeline, EtapaCodigo, PainelAtendimento } from '@/types'

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

function formatarHoras(horas: number | null): string {
  if (horas === null) return '—'
  if (horas < 1) return '< 1h nesta etapa'
  if (horas < 24) return `${Math.floor(horas)}h nesta etapa`
  return `${Math.floor(horas / 24)}d nesta etapa`
}

export default function PipelineBoard({
  etapasIniciais,
  pedidosIniciais,
}: {
  etapasIniciais: EtapaPipeline[]
  pedidosIniciais: PainelAtendimento[]
}) {
  const [pedidos, setPedidos] = useState(pedidosIniciais)
  const [movendoId, setMovendoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function moverPedido(pedidoId: string, etapaCodigo: EtapaCodigo) {
    setMovendoId(pedidoId)
    setErro(null)

    try {
      const resposta = await fetch('/api/pipeline/mover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoId, etapa_codigo: etapaCodigo }),
      })

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        throw new Error(corpo?.erro ?? 'Erro ao mover pedido')
      }

      const etapa = etapasIniciais.find((e) => e.codigo === etapaCodigo)
      setPedidos((atual) =>
        atual.map((p) =>
          p.id === pedidoId
            ? { ...p, etapa_atual: etapaCodigo, etapa_nome: etapa?.nome ?? etapaCodigo, etapa_cor: etapa?.cor ?? null, horas_na_etapa_atual: 0 }
            : p
        )
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao mover pedido')
    } finally {
      setMovendoId(null)
    }
  }

  if (etapasIniciais.length === 0) {
    return (
      <p className="p-6 text-sm text-zinc-500">
        Nenhuma etapa de pipeline cadastrada — rode o supabase_pipeline.sql no banco.
      </p>
    )
  }

  return (
    <div className="p-6">
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {etapasIniciais.map((etapa) => {
          const pedidosDaEtapa = pedidos.filter((p) => p.etapa_atual === etapa.codigo)

          return (
            <div key={etapa.codigo} className="w-72 shrink-0">
              <div
                className="mb-3 flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: etapa.cor }}
              >
                <span>{etapa.nome}</span>
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">
                  {pedidosDaEtapa.length}
                </span>
              </div>

              <div className="space-y-3">
                {pedidosDaEtapa.length === 0 && (
                  <p className="rounded-md border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400">
                    Nenhum pedido
                  </p>
                )}

                {pedidosDaEtapa.map((pedido) => (
                  <div
                    key={pedido.id}
                    className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                  >
                    <p className="text-sm font-medium text-zinc-900">{pedido.usuario_nome}</p>
                    <p className="text-xs text-zinc-500">{pedido.produto_nome}</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                      {formatarMoeda(pedido.valor_pago)}
                    </p>
                    {pedido.contador_nome && (
                      <p className="mt-1 text-xs text-zinc-500">Indicado por {pedido.contador_nome}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-400">
                      {formatarHoras(pedido.horas_na_etapa_atual)}
                    </p>

                    <select
                      value={pedido.etapa_atual ?? ''}
                      disabled={movendoId === pedido.id}
                      onChange={(e) => moverPedido(pedido.id, e.target.value as EtapaCodigo)}
                      className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
                    >
                      {etapasIniciais.map((e) => (
                        <option key={e.codigo} value={e.codigo}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
