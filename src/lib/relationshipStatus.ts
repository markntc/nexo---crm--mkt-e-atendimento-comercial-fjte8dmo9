// src/lib/relationshipStatus.ts
import pb from '@/lib/pocketbase/client'

/**
 * Verifica se uma etapa de oportunidade/negócio representa ganho/fechamento efetivado.
 */
import type { EtapaItem } from '@/types'

/**
 * Normaliza qualquer item de etapa (string ou objeto EtapaConfig) para string de nome
 */
export function getEtapaNome(item: EtapaItem | undefined | null): string {
  if (!item) return ''
  if (typeof item === 'string') return item
  return item.nome || ''
}

export function getEtapaId(item: EtapaItem | undefined | null): string | undefined {
  if (!item || typeof item === 'string') return undefined
  return item.id
}

/**
 * Retorna o valor monetário de referência da etapa se configurado
 */
export function getEtapaValorReferencia(item: EtapaItem | undefined | null): number | undefined {
  if (!item || typeof item === 'string') return undefined
  return item.valor_referencia
}

/**
 * Verifica se uma etapa é explicitamente definida ou deduzida como etapa de "ganho".
 * Suporta consulta por flags do registro (is_won), objeto de etapa, etapa_id ou nome.
 */
export function isWonStage(
  stage?: string | EtapaItem,
  etapasOrdenadas?: EtapaItem[],
  oppFlags?: { is_won?: boolean; is_lost?: boolean },
): boolean {
  if (oppFlags && typeof oppFlags.is_won === 'boolean') {
    return oppFlags.is_won
  }
  if (!stage) return false
  if (typeof stage === 'object') {
    if (stage.is_won !== undefined) return Boolean(stage.is_won)
    stage = stage.nome
  }
  const stageKey = typeof stage === 'string' ? stage : getEtapaNome(stage)

  // Se houver lista de etapas configuradas do funil, prioriza matching por ID ou nome
  if (etapasOrdenadas && etapasOrdenadas.length > 0) {
    const found = etapasOrdenadas.find((e) => {
      if (typeof e === 'object' && e) {
        if (e.id && e.id === stageKey) return true
        return (e.nome || '').toLowerCase().trim() === stageKey.toLowerCase().trim()
      }
      return typeof e === 'string' && e.toLowerCase().trim() === stageKey.toLowerCase().trim()
    })
    if (found && typeof found === 'object' && found.is_won !== undefined) {
      return Boolean(found.is_won)
    }
  }

  const lower = stageKey.toLowerCase().trim()
  return (
    lower.includes('ganho') ||
    lower.includes('fechado') ||
    lower.includes('pagamento confirmado') ||
    lower.includes('pós-venda') ||
    lower.includes('pos-venda') ||
    lower.includes('concluído') ||
    lower.includes('concluido') ||
    lower.includes('efetivado')
  )
}

/**
 * Verifica se uma etapa é explicitamente definida ou deduzida como etapa de "perdido".
 * Suporta consulta por flags do registro (is_lost), objeto de etapa, etapa_id ou nome.
 */
export function isLostStage(
  stage?: string | EtapaItem,
  etapasOrdenadas?: EtapaItem[],
  oppFlags?: { is_won?: boolean; is_lost?: boolean },
): boolean {
  if (oppFlags && typeof oppFlags.is_lost === 'boolean') {
    return oppFlags.is_lost
  }
  if (!stage) return false
  if (typeof stage === 'object') {
    if (stage.is_lost !== undefined) return Boolean(stage.is_lost)
    stage = stage.nome
  }
  const stageKey = typeof stage === 'string' ? stage : getEtapaNome(stage)

  // Se houver lista de etapas configuradas do funil, prioriza matching por ID ou nome
  if (etapasOrdenadas && etapasOrdenadas.length > 0) {
    const found = etapasOrdenadas.find((e) => {
      if (typeof e === 'object' && e) {
        if (e.id && e.id === stageKey) return true
        return (e.nome || '').toLowerCase().trim() === stageKey.toLowerCase().trim()
      }
      return typeof e === 'string' && e.toLowerCase().trim() === stageKey.toLowerCase().trim()
    })
    if (found && typeof found === 'object' && found.is_lost !== undefined) {
      return Boolean(found.is_lost)
    }
  }

  const lower = stageKey.toLowerCase().trim()
  return (
    lower.includes('perdido') ||
    lower.includes('perdida') ||
    lower.includes('cancelado') ||
    lower.includes('recusado') ||
    lower.includes('descartado') ||
    lower.includes('desistência') ||
    lower.includes('desistencia') ||
    lower.includes('arquivado')
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
      fields:
        'id,cliente_b2b_id,cliente_b2c_id,organizacao_id,pessoa_id,etapa_id,etapa_atual,is_won,is_lost',
    })

    const wonOrgIds = new Set<string>()
    const wonPessoaIds = new Set<string>()

    for (const op of opps) {
      const isWon =
        typeof op.is_won === 'boolean' ? op.is_won : isWonStage((op.etapa_atual as string) || '')
      if (isWon) {
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
