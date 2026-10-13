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

  // Se o nome contiver termos inequívocos de perda/cancelamento, NUNCA pode ser won
  if (
    lower.includes('perdido') ||
    lower.includes('perdida') ||
    lower.includes('cancelado') ||
    lower.includes('recusado') ||
    lower.includes('descartado') ||
    lower.includes('desistência') ||
    lower.includes('desistencia') ||
    lower.includes('arquivado')
  ) {
    return false
  }

  // "fechado ganho" ou "fechado" isolado sem perda
  return (
    lower.includes('ganho') ||
    lower.includes('ganha') ||
    lower.includes('fechado ganho') ||
    lower === 'fechado' ||
    lower.startsWith('fechado - ganho') ||
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

  // Se o nome for estritamente de ganho sem perda, não é lost
  if (
    (lower.includes('ganho') || lower.includes('ganha')) &&
    !lower.includes('perdido') &&
    !lower.includes('perdida')
  ) {
    return false
  }

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

export interface ResolveOppWonInput {
  etapa_id?: string | null
  etapa_atual?: string | null
  is_won?: boolean | null
  is_lost?: boolean | null
}

export interface EtapaFunilLookup {
  id: string
  nome?: string
  is_won?: boolean
  is_lost?: boolean
}

/**
 * Função pura e determinística que resolve se um negócio é "ganho" (is_won)
 * priorizando:
 * 1. A etapa resolvida por ID em `etapas_funil` (se etapaMap fornecido e etapa_id presente)
 * 2. As flags is_won / is_lost explícitas do próprio registro de oportunidade
 * 3. A etapa encontrada pelo nome em `etapas_funil`
 * 4. A heurística por nome (isWonStage) com proteção estrita contra etapas de perda/cancelamento
 */
export function resolveIsOppWon(
  op: ResolveOppWonInput,
  etapaMapById?: Map<string, EtapaFunilLookup> | Record<string, EtapaFunilLookup>,
): boolean {
  const etapaId = (op.etapa_id || '').trim()

  // 1. Resolução por ID na collection etapas_funil
  if (etapaId && etapaMapById) {
    const etapa = etapaMapById instanceof Map ? etapaMapById.get(etapaId) : etapaMapById[etapaId]
    if (etapa && typeof etapa.is_won === 'boolean') {
      return etapa.is_won
    }
  }

  // 2. Se a oportunidade tiver flag is_won booleana explícita gravada no registro
  if (typeof op.is_won === 'boolean') {
    // Invariante de sanidade: se is_lost for true, NUNCA é ganho
    if (op.is_lost === true) return false
    return op.is_won
  }

  // 3. Fallback para heurística protegida baseada no nome da etapa
  const etapaNome = (op.etapa_atual || '').trim()
  return isWonStage(etapaNome, undefined, {
    is_won: typeof op.is_won === 'boolean' ? op.is_won : undefined,
    is_lost: typeof op.is_lost === 'boolean' ? op.is_lost : undefined,
  })
}

/**
 * Cache ou busca de IDs de pessoas e organizações que possuem negócio ganho.
 * Retorna dois Sets contendo os IDs com status derivado de "Cliente".
 *
 * Arquitetura de Integridade:
 * - O status "Cliente" exige negócio ganho (`is_won` verdadeiro).
 * - Resolve `etapa_id` diretamente contra a collection `etapas_funil`,
 *   eliminando erros de heurística por nome.
 * - Um cliente com negócio apenas em "Fechado Perdido" NUNCA recebe o status "Cliente".
 */
export async function getClientStatusSets(): Promise<{
  wonOrgIds: Set<string>
  wonPessoaIds: Set<string>
}> {
  try {
    const [opps, etapasList] = await Promise.all([
      pb.collection('oportunidades').getFullList<Record<string, unknown>>({
        fields:
          'id,cliente_b2b_id,cliente_b2c_id,organizacao_id,pessoa_id,etapa_id,etapa_atual,is_won,is_lost',
      }),
      pb
        .collection('etapas_funil')
        .getFullList<EtapaFunilLookup>({
          fields: 'id,nome,is_won,is_lost',
        })
        .catch((err) => {
          console.warn('Aviso: falha ao buscar etapas_funil para cálculo de status:', err)
          return [] as EtapaFunilLookup[]
        }),
    ])

    // Mapa em memória id -> EtapaFunilLookup para resolução O(1)
    const etapaMapById = new Map<string, EtapaFunilLookup>()
    for (const et of etapasList) {
      if (et.id) {
        etapaMapById.set(et.id, et)
      }
    }

    const wonOrgIds = new Set<string>()
    const wonPessoaIds = new Set<string>()

    for (const op of opps) {
      const isWon = resolveIsOppWon(
        {
          etapa_id: (op.etapa_id as string) || null,
          etapa_atual: (op.etapa_atual as string) || null,
          is_won: typeof op.is_won === 'boolean' ? op.is_won : null,
          is_lost: typeof op.is_lost === 'boolean' ? op.is_lost : null,
        },
        etapaMapById,
      )

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
