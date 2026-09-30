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
    const opps = await pb.collection('oportunidades').getFullList({
      fields: 'id,cliente_b2b_id,cliente_b2c_id,etapa_atual',
    })

    const wonOrgIds = new Set<string>()
    const wonPessoaIds = new Set<string>()

    for (const op of opps) {
      if (isWonStage(op.etapa_atual)) {
        if (op.cliente_b2b_id) wonOrgIds.add(op.cliente_b2b_id)
        if (op.cliente_b2c_id) wonPessoaIds.add(op.cliente_b2c_id)
      }
    }

    return { wonOrgIds, wonPessoaIds }
  } catch (err) {
    console.error('Erro ao calcular status de relacionamento de clientes:', err)
    return { wonOrgIds: new Set(), wonPessoaIds: new Set() }
  }
}
