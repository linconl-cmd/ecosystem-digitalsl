import { NextRequest } from 'next/server'
import { exigirAdmin } from '@/lib/auth'
import { moverPipeline } from '@/lib/pipeline'
import { moverPipelineSchema } from '@/schemas'
import { erroApi, sucessoApi } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const { usuario, erro } = await exigirAdmin()
  if (erro) return erro

  const body: unknown = await request.json()
  const resultado = moverPipelineSchema.safeParse(body)

  if (!resultado.success) {
    return erroApi(resultado.error.issues.map((e: { message: string }) => e.message).join(', '))
  }

  try {
    await moverPipeline({
      pedidoId: resultado.data.pedido_id,
      etapaCodigo: resultado.data.etapa_codigo,
      observacao: resultado.data.observacao,
      criadoPor: usuario.id,
    })
    return sucessoApi({ movido: true })
  } catch (e) {
    return erroApi(e instanceof Error ? e.message : 'Erro ao mover pedido', 500)
  }
}
