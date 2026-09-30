// src/lib/relationshipStatus.ts
import pb from '@/lib/pocketbase/client'

/**
 * Verifica se uma etapa de oportunidade/negócio representa ganho/fechamento efetivado.
 */
export function isWonStage(stageName?: string): boolean {
  if (!stageName) return false
  const lower = stageName.toLowerCase().trim()
  return (
    lower.includes('ganho') ||
    lower.includes('fechado') ||
    lower.includes('pagamento confirmado') ||
    lower.includes('pós-venda') ||
    lower.includes('concluído') ||
    lower.includes('efetivado')
  )
}

/**
 * Cache ou busca de IDs de pessoas e organizações que possuem negócio ganho.
 * Retorna dois Sets contendo os IDs com status "Cliente".
 */
export async function getClientStatusSets(): Promise<{
  wonOrgIds: Set<string>
  wonPessoaIds: Set<string>
}> {
  try {
    const opps = await pb.collection('oportunidades').getFullList<Record<string, unknown>>({
      fields: 'id,cliente_b2b_id,cliente_b2c_id,organizacao_id,pessoa_id,etapa_atual',
    })

    const wonOrgIds = new Set<string>()
    const wonPessoaIds = new Set<string>()

    for (const op of opps) {
      const etapa = (op.etapa_atual as string) || ''
      if (isWonStage(etapa)) {
        const orgId = (op.cliente_b2b_id as string) || (op.organizacao_id as string)
        const pessoaId = (op.cliente_b2c_id as string) || (op.pessoa_id as string)
        if (orgId) wonOrgIds.add(orgId)
        if (pessoaId) wonPessoaIds.add(pessoaId)
      }
    }

    return { wonOrgIds, wonPessoaIds }
  } catch (err) {
    console.error('Erro ao calcular status de relacionamento de clientes:', err)
    return { wonOrgIds: new Set(), wonPessoaIds: new Set() }
  }
}
