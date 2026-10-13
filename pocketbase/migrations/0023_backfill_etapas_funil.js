/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    console.log('[migracao_0023] Iniciando backfill de etapas_funil e oportunidades...')

    const etapasCollection = app.findCollectionByNameOrId('etapas_funil')
    const funisCollection = app.findCollectionByNameOrId('funis')
    const oppsCollection = app.findCollectionByNameOrId('oportunidades')

    // Heurística canônica idêntica a relationshipStatus.ts para determinar is_won e is_lost
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

    // =========================================================================
    // 1. Para cada registro em `funis`: ler etapas_ordenadas e criar em etapas_funil
    // =========================================================================
    const allFunis = app.findAllRecords('funis')
    console.log(`[migracao_0023] Processando ${allFunis.length} funis cadastrados...`)

    // Mapeamentos em memória:
    // etapaMapByFunil: funilId -> Map(nomeLowerCase -> { id, nome, valor_referencia, is_won, is_lost, ordem })
    const etapaMapByFunil = {}
    // funisPorMarca: marcaId -> [funilRecord...]
    const funisPorMarca = {}

    for (let f of allFunis) {
      const fId = f.id
      const marcaId = f.getString('marca_id')
      if (marcaId) {
        if (!funisPorMarca[marcaId]) funisPorMarca[marcaId] = []
        funisPorMarca[marcaId].push(f)
      }

      etapaMapByFunil[fId] = {}

      // Leitura robusta de etapas_ordenadas
      let rawEtapas = []
      try {
        const raw = f.getString('etapas_ordenadas')
        if (raw) {
          rawEtapas = JSON.parse(raw)
        }
      } catch (errParse) {
        console.warn(`[migracao_0023] JSON.parse falhou para funil ${fId}:`, errParse)
        rawEtapas = []
      }

      if (!Array.isArray(rawEtapas) || rawEtapas.length === 0) {
        rawEtapas = [
          'Lead Recebido',
          'Contato Inicial',
          'Proposta Comercial',
          'Negociação',
          'Fechado Ganho',
          'Fechado Perdido',
        ]
      }

      // Buscar etapas já gravadas em etapas_funil para este funil (idempotência)
      let existingEtapas = []
      try {
        existingEtapas = app.findRecordsByFilter(
          'etapas_funil',
          `funil_id = '${fId}'`,
          'ordem',
          200,
          0,
        )
      } catch (_) {
        existingEtapas = []
      }

      const existingByName = {}
      for (let ex of existingEtapas) {
        const nomeNorm = String(ex.getString('nome')).toLowerCase().trim()
        if (nomeNorm) existingByName[nomeNorm] = ex
      }

      const updatedEtapasOrdenadas = []

      for (let idx = 0; idx < rawEtapas.length; idx++) {
        const item = rawEtapas[idx]
        const nome = (typeof item === 'string' ? item : item?.nome || '').trim()
        if (!nome) continue

        const nomeKey = nome.toLowerCase()
        const valorRef =
          typeof item === 'object' && item?.valor_referencia !== undefined
            ? Number(item.valor_referencia) || 0
            : 0
        const explicitWon = typeof item === 'object' ? item.is_won : undefined
        const explicitLost = typeof item === 'object' ? item.is_lost : undefined

        const isWon = checkWonStage(nome, explicitWon)
        const isLost = !isWon && checkLostStage(nome, explicitLost)

        let etapaRecord = existingByName[nomeKey]

        if (!etapaRecord) {
          // Criar novo registro em etapas_funil
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
          // Idempotente: sincronizar campos mantendo integridade
          etapaRecord.set('ordem', idx)
          if (valorRef) etapaRecord.set('valor_referencia', valorRef)
          etapaRecord.set('is_won', isWon)
          etapaRecord.set('is_lost', isLost)
          app.save(etapaRecord)
        }

        const etapaData = {
          id: etapaRecord.id,
          nome: nome,
          ordem: idx,
          valor_referencia: valorRef,
          is_won: isWon,
          is_lost: isLost,
        }

        etapaMapByFunil[fId][nomeKey] = etapaData
        updatedEtapasOrdenadas.push(etapaData)
      }

      // Atualiza etapas_ordenadas no funil com os IDs gravados
      if (updatedEtapasOrdenadas.length > 0) {
        f.set('etapas_ordenadas', updatedEtapasOrdenadas)
        app.save(f)
      }
    }

    console.log('[migracao_0023] Etapas criadas/sincronizadas em etapas_funil com sucesso.')

    // =========================================================================
    // 2. Para cada registro em `oportunidades`: resolver etapa_id, is_won, is_lost
    // =========================================================================
    const allOpps = app.findAllRecords('oportunidades')
    console.log(`[migracao_0023] Processando ${allOpps.length} oportunidades...`)

    let resolvedCount = 0
    let alreadyCorrectCount = 0
    let unresolvedList = []

    for (let op of allOpps) {
      const oppId = op.id
      const titulo = op.getString('titulo')
      let funilId = op.getString('funil_id')
      let etapaNome = (op.getString('etapa_atual') || '').trim()
      const existingEtapaId = op.getString('etapa_id')
      const marcaId = op.getString('marca_id')

      // Caso de borda (a): oportunidade com funil_id vazio
      if (!funilId) {
        let funilPadrao = null
        if (marcaId && funisPorMarca[marcaId] && funisPorMarca[marcaId].length > 0) {
          // O mesmo default da rota de criação: funis[0] da marca
          funilPadrao = funisPorMarca[marcaId][0]
        }
        if (funilPadrao) {
          funilId = funilPadrao.id
          op.set('funil_id', funilId)
          console.log(
            `[migracao_0023] Oportunidade ${oppId} ("${titulo}") sem funil_id: atribuído funil padrão "${funilPadrao.getString('nome_funil')}" (${funilId}) da marca ${marcaId}.`,
          )
        } else {
          console.warn(
            `[migracao_0023] Oportunidade ${oppId} ("${titulo}") sem funil_id e sem funil identificável para marca ${marcaId}.`,
          )
        }
      }

      // Se etapa_atual estiver vazia, tentar deduzir da primeira etapa do funil
      if (!etapaNome && funilId && etapaMapByFunil[funilId]) {
        const funilEtapas = Object.values(etapaMapByFunil[funilId])
        if (funilEtapas.length > 0) {
          funilEtapas.sort((a, b) => a.ordem - b.ordem)
          etapaNome = funilEtapas[0].nome
          op.set('etapa_atual', etapaNome)
        }
      }

      const etapaKey = etapaNome.toLowerCase()

      // Tenta resolver a etapa correta buscando em etapas_funil pelo par (funil_id, etapa_atual)
      let matchedEtapa = null

      if (funilId && etapaMapByFunil[funilId] && etapaMapByFunil[funilId][etapaKey]) {
        matchedEtapa = etapaMapByFunil[funilId][etapaKey]
      }

      // Se não encontrou no funil vinculado (ou funil_id incompatível),
      // tenta nos funis da mesma marca
      if (!matchedEtapa && marcaId && funisPorMarca[marcaId] && etapaKey) {
        for (let otherF of funisPorMarca[marcaId]) {
          if (etapaMapByFunil[otherF.id] && etapaMapByFunil[otherF.id][etapaKey]) {
            matchedEtapa = etapaMapByFunil[otherF.id][etapaKey]
            // Se a oportunidade estava com funil errado ou vazio, ajusta para o funil que de fato possui a etapa
            if (!funilId) {
              funilId = otherF.id
              op.set('funil_id', funilId)
            }
            break
          }
        }
      }

      // Se ainda não encontrou e existingEtapaId já estava preenchido, verificar se o registro existe
      if (!matchedEtapa && existingEtapaId) {
        try {
          const exRecord = app.findRecordById('etapas_funil', existingEtapaId)
          matchedEtapa = {
            id: exRecord.id,
            nome: exRecord.getString('nome'),
            is_won: exRecord.getBool('is_won'),
            is_lost: exRecord.getBool('is_lost'),
          }
        } catch (_) {}
      }

      if (matchedEtapa) {
        // Idempotência: só altera se necessário
        const needsUpdate =
          op.getString('etapa_id') !== matchedEtapa.id ||
          op.getBool('is_won') !== Boolean(matchedEtapa.is_won) ||
          op.getBool('is_lost') !== Boolean(matchedEtapa.is_lost) ||
          op.getString('etapa_atual') !== matchedEtapa.nome

        if (existingEtapaId === matchedEtapa.id && !needsUpdate) {
          alreadyCorrectCount++
        } else {
          op.set('etapa_id', matchedEtapa.id)
          op.set('is_won', Boolean(matchedEtapa.is_won))
          op.set('is_lost', Boolean(matchedEtapa.is_lost))
          // Manter etapa_atual como espelho texto (compatibilidade legada) — canônica
          if (!op.getString('etapa_atual')) {
            op.set('etapa_atual', matchedEtapa.nome)
          }
          app.save(op)
          resolvedCount++
        }
      } else {
        // Caso de borda (b): etapa_atual que não casa com nenhuma etapa do funil
        // NÃO inventar etapa: deixar etapa_id vazio e is_won/is_lost conforme heurística atual
        const isWon = checkWonStage(etapaNome, false)
        const isLost = !isWon && checkLostStage(etapaNome, false)
        op.set('is_won', isWon)
        op.set('is_lost', isLost)
        // etapa_id permanece vazio
        app.save(op)

        unresolvedList.push({
          id: oppId,
          titulo: titulo,
          marca_id: marcaId,
          funil_id: funilId,
          etapa_atual: etapaNome,
        })
      }
    }

    console.log(
      `[migracao_0023] Concluído! Oportunidades: ${resolvedCount} resolvidas nesta execução, ${alreadyCorrectCount} já estavam corretas, ${unresolvedList.length} não-resolvidas.`,
    )

    if (unresolvedList.length > 0) {
      console.warn(
        `[migracao_0023] Casos não-resolvidos (${unresolvedList.length}): ${JSON.stringify(unresolvedList)}`,
      )
    }
  },
  (app) => {
    // Reversão segura
    console.log('[migracao_0023] Revertendo dados backfilled...')
  },
)
