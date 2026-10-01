import { exigirAdmin } from '@/lib/auth'
import { buscarPainelAtendimento } from '@/lib/pipeline'
import { erroApi, sucessoApi } from '@/lib/utils'

export async function GET() {
  const { erro } = await exigirAdmin()
  if (erro) return erro

  try {
    const dados = await buscarPainelAtendimento()
    return sucessoApi(dados)
  } catch (e) {
    return erroApi(e instanceof Error ? e.message : 'Erro ao buscar painel', 500)
  }
}
