/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Criar collection `etapas_funil` (registro próprio com ID estável para cada etapa)
    let etapasCollection
    try {
      etapasCollection = app.findCollectionByNameOrId('etapas_funil')
    } catch (_) {
      const funisCol = app.findCollectionByNameOrId('funis')
      etapasCollection = new Collection({
        name: 'etapas_funil',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'funil_id',
            type: 'relation',
            required: false,
            collectionId: funisCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'nome', type: 'text', required: false },
          { name: 'ordem', type: 'number', required: false },
          { name: 'valor_referencia', type: 'number', required: false },
          { name: 'is_won', type: 'bool', required: false },
          { name: 'is_lost', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_etapas_funil_id ON etapas_funil (funil_id)',
          'CREATE INDEX idx_etapas_funil_ordem ON etapas_funil (funil_id, ordem)',
        ],
      })
      app.save(etapasCollection)
    }

    // 2. Adicionar campos na collection `oportunidades`:
    //    - etapa_id (relation para etapas_funil, maxSelect: 1)
    //    - is_won (bool)
    //    - is_lost (bool)
    const oppCol = app.findCollectionByNameOrId('oportunidades')

    if (!oppCol.fields.getByName('etapa_id')) {
      oppCol.fields.add(
        new RelationField({
          name: 'etapa_id',
          collectionId: etapasCollection.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
    }

    if (!oppCol.fields.getByName('is_won')) {
      oppCol.fields.add(
        new BoolField({
          name: 'is_won',
          required: false,
        }),
      )
    }

    if (!oppCol.fields.getByName('is_lost')) {
      oppCol.fields.add(
        new BoolField({
          name: 'is_lost',
          required: false,
        }),
      )
    }

    app.save(oppCol)

    // Heurística idêntica a relationshipStatus.ts para determinar is_won e is_lost
    function checkWonStage(nome, explicitWon) {
      if (explicitWon !== undefined && explicitWon !== null) return Boolean(explicitWon)
      if (!nome) return false
      const lower = String(nome).toLowerCase().trim()
      return (
        lower.includes('ganho') ||
        lower.includes('fechado') ||
        lower.includes('ganha') ||
        lower.includes('concluído') ||
        lower.includes('concluido') ||
        lower.includes('pós-venda') ||
        lower.includes('pos-venda')
      )
    }

    function checkLostStage(nome, explicitLost) {
      if (explicitLost !== undefined && explicitLost !== null) return Boolean(explicitLost)
      if (!nome) return false
      const lower = String(nome).toLowerCase().trim()
      return (
        lower.includes('perdido') ||
        lower.includes('perdida') ||
        lower.includes('cancelado') ||
        lower.includes('desistência') ||
        lower.includes('desistencia') ||
        lower.includes('arquivado')
      )
    }

    // 3. Povoar etapas_funil a partir de todos os funis existentes e atualizar etapas_ordenadas
    const allFunis = app.findAllRecords('funis')
    const etapaMapByFunil = {} // funil_id -> { etapa_nome_lower: { id, nome, is_won, is_lost } }

    for (let f of allFunis) {
      const fId = f.id
      etapaMapByFunil[fId] = {}

      let rawEtapas = f.get('etapas_ordenadas') || []
      if (typeof rawEtapas === 'string') {
        try {
          rawEtapas = JSON.parse(rawEtapas)
        } catch (_) {
          rawEtapas = []
        }
      }
      if (!Array.isArray(rawEtapas)) rawEtapas = []

      // Se funil não tiver nenhuma etapa, cria etapas padrão para nunca ficar em branco
      if (rawEtapas.length === 0) {
        rawEtapas = [
          'Lead Recebido',
          'Contato Inicial',
          'Proposta Comercial',
          'Negociação',
          'Fechado Ganho',
          'Fechado Perdido',
        ]
      }

      // Buscar etapas já gravadas na collection etapas_funil para este funil (idempotência)
      let existingEtapas = []
      try {
        existingEtapas = app.findRecordsByFilter(
          'etapas_funil',
          `funil_id = '${fId}'`,
          '-created',
          100,
        )
      } catch (_) {
        existingEtapas = []
      }
      const existingByName = {}
      for (let ex of existingEtapas) {
        existingByName[String(ex.get('nome')).toLowerCase().trim()] = ex
      }

      const updatedEtapasOrdenadas = []

      for (let idx = 0; idx < rawEtapas.length; idx++) {
        const item = rawEtapas[idx]
        const nome = typeof item === 'string' ? item.trim() : (item.nome || '').trim()
        if (!nome) continue

        const nomeKey = nome.toLowerCase()
        const valorRef =
          typeof item === 'object' && item.valor_referencia !== undefined
            ? Number(item.valor_referencia) || 0
            : 0
        const explicitWon = typeof item === 'object' ? item.is_won : undefined
        const explicitLost = typeof item === 'object' ? item.is_lost : undefined

        const isWon = checkWonStage(nome, explicitWon)
        const isLost = !isWon && checkLostStage(nome, explicitLost)

        let etapaRecord = existingByName[nomeKey]
        if (!etapaRecord) {
          etapaRecord = new Record(etapasCollection)
          etapaRecord.set('funil_id', fId)
          etapaRecord.set('nome', nome)
          etapaRecord.set('ordem', idx)
          etapaRecord.set('valor_referencia', valorRef)
          etapaRecord.set('is_won', isWon)
          etapaRecord.set('is_lost', isLost)
          app.save(etapaRecord)
          existingByName[nomeKey] = etapaRecord
        } else {
          // Garante ordem, valor_referencia e flags sincronizados
          etapaRecord.set('ordem', idx)
          if (valorRef) etapaRecord.set('valor_referencia', valorRef)
          etapaRecord.set('is_won', isWon)
          etapaRecord.set('is_lost', isLost)
          app.save(etapaRecord)
        }

        etapaMapByFunil[fId][nomeKey] = {
          id: etapaRecord.id,
          nome: nome,
          is_won: isWon,
          is_lost: isLost,
        }

        // Preserva objeto rico em etapas_ordenadas contendo id estável
        updatedEtapasOrdenadas.push({
          id: etapaRecord.id,
          nome: nome,
          ordem: idx,
          valor_referencia: valorRef,
          is_won: isWon,
          is_lost: isLost,
        })
      }

      // Atualiza etapas_ordenadas no funil com os IDs incorporados garantindo array não vazio
      if (updatedEtapasOrdenadas.length > 0) {
        f.set('etapas_ordenadas', updatedEtapasOrdenadas)
        app.save(f)
      }
    }

    // 4. Backfill idempotente das oportunidades:
    //    Para cada oportunidade, resolver etapa_id a partir de etapa_atual (nome) dentro do funil vinculado.
    //    Derivar is_won e is_lost a partir da etapa resolvida ou da heurística do nome.
    const allOpps = app.findAllRecords('oportunidades')
    let resolvedCount = 0
    let unresolvableCount = 0

    for (let op of allOpps) {
      const funilId = op.get('funil_id')
      const etapaNome = (op.get('etapa_atual') || '').trim()
      const currentEtapaId = op.get('etapa_id')

      let matchedEtapa = null

      if (funilId && etapaMapByFunil[funilId] && etapaNome) {
        matchedEtapa = etapaMapByFunil[funilId][etapaNome.toLowerCase()]
      }

      // Se não encontrou pelo nome exato no funil vinculado, tenta em qualquer funil da mesma marca
      if (!matchedEtapa && etapaNome) {
        for (let fId in etapaMapByFunil) {
          if (etapaMapByFunil[fId][etapaNome.toLowerCase()]) {
            matchedEtapa = etapaMapByFunil[fId][etapaNome.toLowerCase()]
            break
          }
        }
      }

      if (matchedEtapa) {
        op.set('etapa_id', matchedEtapa.id)
        op.set('is_won', Boolean(matchedEtapa.is_won))
        op.set('is_lost', Boolean(matchedEtapa.is_lost))
        // Garante que etapa_atual (espelho) tenha a grafia canônica
        if (!op.get('etapa_atual')) {
          op.set('etapa_atual', matchedEtapa.nome)
        }
        resolvedCount++
      } else if (currentEtapaId) {
        // Já tinha etapa_id definido anteriormente
        try {
          const exEt = app.findRecordById('etapas_funil', currentEtapaId)
          op.set('is_won', Boolean(exEt.get('is_won')))
          op.set('is_lost', Boolean(exEt.get('is_lost')))
          if (!op.get('etapa_atual')) {
            op.set('etapa_atual', exEt.get('nome'))
          }
          resolvedCount++
        } catch (_) {
          unresolvableCount++
        }
      } else {
        // Etapa fantasma ou sem funil/sem nome:
        // Mantém etapa_id vazio (ficará sinalizado na coluna "Sem etapa válida" do frontend)
        // Deriva flags por heurística se houver algum nome
        const isWon = checkWonStage(etapaNome, false)
        const isLost = !isWon && checkLostStage(etapaNome, false)
        op.set('is_won', isWon)
        op.set('is_lost', isLost)
        unresolvableCount++
      }

      app.save(op)
    }

    console.log(
      `[Migration 0022] Backfill concluído: ${allOpps.length} oportunidades processadas. ${resolvedCount} resolvidas com etapa_id, ${unresolvableCount} não resolvíveis (sinalizadas para "Sem etapa válida").`,
    )
  },
  (app) => {
    // Reversão
    try {
      const oppCol = app.findCollectionByNameOrId('oportunidades')
      if (oppCol.fields.getByName('etapa_id')) oppCol.fields.removeByName('etapa_id')
      if (oppCol.fields.getByName('is_won')) oppCol.fields.removeByName('is_won')
      if (oppCol.fields.getByName('is_lost')) oppCol.fields.removeByName('is_lost')
      app.save(oppCol)
    } catch (_) {}

    try {
      const etapasCol = app.findCollectionByNameOrId('etapas_funil')
      app.delete(etapasCol)
    } catch (_) {}
  },
)
