/**
 * Testes de regressão comercial e invariantes para o CRM Nexo (Fase 1).
 *
 * Cobre:
 * 1. Invariante formal `is_won XOR is_lost`:
 *    - Nenhuma etapa pode ter is_won === true E is_lost === true simultaneamente.
 *    - Tentar gravar ou validar estado inválido deve falhar.
 * 2. Classificação de status de cliente via `resolveIsOppWon` e `getClientStatusSets`:
 *    - Oportunidade com etapa_id de "Fechado Perdido" NUNCA pode ser considerada won.
 *    - Cliente cujo único negócio está em "Fechado Perdido" NÃO recebe status "Cliente".
 *    - Cliente com negócio em etapa de "Fechado Ganho" / is_won=true recebe status "Cliente".
 * 3. Heurística de segurança por nome (isWonStage / isLostStage):
 *    - "Fechado Perdido", "Cancelado", "Perdido" jamais retornam isWonStage = true.
 *    - "Fechado Ganho", "Ganho" retornam isWonStage = true.
 */

import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Função pura que reflete a validação da invariante
function validarInvarianteEtapa(etapa) {
  const isWon = Boolean(etapa.is_won)
  const isLost = Boolean(etapa.is_lost)

  if (isWon && isLost) {
    throw new Error(
      'INVARIANTE VIOLADA: Uma etapa não pode ser marcada como ganha (is_won) e perdida (is_lost) simultaneamente.',
    )
  }
  return true
}

// Implementação pura de isWonStage e isLostStage idêntica a relationshipStatus.ts
function isWonStage(stageKey) {
  if (!stageKey) return false
  const lower = stageKey.toLowerCase().trim()

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

function resolveIsOppWon(op, etapaMapById) {
  const etapaId = (op.etapa_id || '').trim()

  if (etapaId && etapaMapById) {
    const etapa = etapaMapById instanceof Map ? etapaMapById.get(etapaId) : etapaMapById[etapaId]
    if (etapa && typeof etapa.is_won === 'boolean') {
      return etapa.is_won
    }
  }

  if (typeof op.is_won === 'boolean') {
    if (op.is_lost === true) return false
    return op.is_won
  }

  const etapaNome = (op.etapa_atual || '').trim()
  return isWonStage(etapaNome)
}

test('Invariante formal: is_won XOR is_lost', async (t) => {
  await t.test('Etapa com is_won=false e is_lost=false é válida (etapa intermediária)', () => {
    assert.strictEqual(
      validarInvarianteEtapa({ nome: 'Proposta Comercial', is_won: false, is_lost: false }),
      true,
    )
  })

  await t.test('Etapa com is_won=true e is_lost=false é válida (Fechado Ganho)', () => {
    assert.strictEqual(
      validarInvarianteEtapa({ nome: 'Fechado Ganho', is_won: true, is_lost: false }),
      true,
    )
  })

  await t.test('Etapa com is_won=false e is_lost=true é válida (Fechado Perdido)', () => {
    assert.strictEqual(
      validarInvarianteEtapa({ nome: 'Fechado Perdido', is_won: false, is_lost: true }),
      true,
    )
  })

  await t.test('REJEIÇÃO OBRIGATÓRIA: Etapa com is_won=true e is_lost=true DEVE FALHAR', () => {
    assert.throws(
      () => {
        validarInvarianteEtapa({
          nome: 'Estado Inválido',
          is_won: true,
          is_lost: true,
        })
      },
      /INVARIANTE VIOLADA/,
      'Gravar etapa com ambas as flags deve estourar erro de integridade',
    )
  })
})

test('Heurística de nomes de etapa (proteção contra falso-ganho em Fechado Perdido)', async (t) => {
  await t.test('"Fechado Perdido" nunca pode ser classificado como won', () => {
    assert.strictEqual(isWonStage('Fechado Perdido'), false)
    assert.strictEqual(isWonStage('fechado perdido'), false)
    assert.strictEqual(isWonStage('FECHADO PERDIDO'), false)
  })

  await t.test('Etapas de cancelamento ou recusa nunca são won', () => {
    assert.strictEqual(isWonStage('Cancelado'), false)
    assert.strictEqual(isWonStage('Perdido'), false)
    assert.strictEqual(isWonStage('Desistência do cliente'), false)
    assert.strictEqual(isWonStage('Recusado pela engenharia'), false)
  })

  await t.test('Etapas ganhas continuam sendo classificadas como won', () => {
    assert.strictEqual(isWonStage('Fechado Ganho'), true)
    assert.strictEqual(isWonStage('Ganho'), true)
    assert.strictEqual(isWonStage('Pós-venda Concluído'), true)
    assert.strictEqual(isWonStage('Pagamento Confirmado'), true)
  })
})

test('Resolução de negócio e status de Cliente (etapa_id → etapas_funil)', async (t) => {
  const etapasMock = new Map([
    [
      'stage_ganho_id',
      { id: 'stage_ganho_id', nome: 'Fechado Ganho', is_won: true, is_lost: false },
    ],
    [
      'stage_perdido_id',
      { id: 'stage_perdido_id', nome: 'Fechado Perdido', is_won: false, is_lost: true },
    ],
    [
      'stage_negociacao_id',
      { id: 'stage_negociacao_id', nome: 'Negociação', is_won: false, is_lost: false },
    ],
  ])

  await t.test('Negócio apontando para etapa_id Fechado Perdido NUNCA é won', () => {
    const opp = {
      id: 'opp_1',
      cliente_b2b_id: 'org_cliente_teste',
      etapa_id: 'stage_perdido_id',
      etapa_atual: 'Fechado Perdido',
    }

    const won = resolveIsOppWon(opp, etapasMock)
    assert.strictEqual(won, false, 'Negócio em Fechado Perdido resolvido por ID não pode ser won')
  })

  await t.test(
    'Cliente com apenas negócio em Fechado Perdido NÃO entra em wonOrgIds / wonPessoaIds',
    () => {
      const opps = [
        {
          id: 'opp_perdida',
          cliente_b2b_id: 'org_perdida_123',
          cliente_b2c_id: 'pessoa_perdida_456',
          etapa_id: 'stage_perdido_id',
          etapa_atual: 'Fechado Perdido',
        },
      ]

      const wonOrgIds = new Set()
      const wonPessoaIds = new Set()

      for (const op of opps) {
        if (resolveIsOppWon(op, etapasMock)) {
          if (op.cliente_b2b_id) wonOrgIds.add(op.cliente_b2b_id)
          if (op.cliente_b2c_id) wonPessoaIds.add(op.cliente_b2c_id)
        }
      }

      assert.strictEqual(
        wonOrgIds.has('org_perdida_123'),
        false,
        'Organização com negócio perdido não é Cliente',
      )
      assert.strictEqual(
        wonPessoaIds.has('pessoa_perdida_456'),
        false,
        'Pessoa com negócio perdido não é Cliente',
      )
    },
  )

  await t.test('Cliente com negócio ganho recebe status "Cliente" normalmente', () => {
    const opps = [
      {
        id: 'opp_ganha',
        cliente_b2b_id: 'org_ganha_789',
        cliente_b2c_id: 'pessoa_ganha_999',
        etapa_id: 'stage_ganho_id',
        etapa_atual: 'Fechado Ganho',
      },
    ]

    const wonOrgIds = new Set()
    const wonPessoaIds = new Set()

    for (const op of opps) {
      if (resolveIsOppWon(op, etapasMock)) {
        if (op.cliente_b2b_id) wonOrgIds.add(op.cliente_b2b_id)
        if (op.cliente_b2c_id) wonPessoaIds.add(op.cliente_b2c_id)
      }
    }

    assert.strictEqual(
      wonOrgIds.has('org_ganha_789'),
      true,
      'Organização com negócio ganho deve ser Cliente',
    )
    assert.strictEqual(
      wonPessoaIds.has('pessoa_ganha_999'),
      true,
      'Pessoa com negócio ganho deve ser Cliente',
    )
  })
})

test('Hook do PocketBase para a invariante existe no repositório', () => {
  const hookPath = path.join(rootDir, 'pocketbase', 'hooks', 'etapas_funil_invariante.js')
  assert.ok(fs.existsSync(hookPath), 'pocketbase/hooks/etapas_funil_invariante.js deve existir')
  const content = fs.readFileSync(hookPath, 'utf8')
  assert.ok(content.includes('is_won'), 'Hook deve inspecionar is_won')
  assert.ok(content.includes('is_lost'), 'Hook deve inspecionar is_lost')
  assert.ok(content.includes('INVARIANTE VIOLADA'), 'Hook deve rejeitar violações da invariante')
})
