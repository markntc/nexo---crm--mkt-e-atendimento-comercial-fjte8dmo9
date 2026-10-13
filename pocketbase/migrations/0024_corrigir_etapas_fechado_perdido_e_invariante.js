/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    console.log(
      '[migracao_0024] Iniciando correção das etapas Fechado Perdido e validação de invariante...',
    )

    // 1. Atualizar cirurgicamente os 3 registros afetados em etapas_funil
    // IDs identificados na auditoria:
    // - or199qm06labuei (funil: 00j145nxxd3icvc - Pierplas / Plataformas e Módulos Náuticos)
    // - ntbjmut2lw73m4t (funil: 0xrk52g6tab8b2s - NTC Serviços / Injeção e Moldes Sob Encomenda)
    // - bsgx5v1243xqmh9 (funil: yqao74mwrz3746r - Udê / Udê B2B Atacado)
    const targetIds = ['or199qm06labuei', 'ntbjmut2lw73m4t', 'bsgx5v1243xqmh9']

    for (let id of targetIds) {
      try {
        const etapa = app.findRecordById('etapas_funil', id)
        const nome = etapa.getString('nome')
        console.log(`[migracao_0024] Corrigindo etapa ${id} ("${nome}")...`)
        etapa.set('is_won', false)
        etapa.set('is_lost', true)
        app.save(etapa)
      } catch (err) {
        console.warn(`[migracao_0024] Registro ${id} não localizado diretamente por ID:`, err)
      }
    }

    // Também corrigir qualquer outra etapa cujo nome seja "fechado perdido" ou "perdido" com is_won = true
    const etapasPerdidas = app.findRecordsByFilter(
      'etapas_funil',
      "nome ~ 'Perdido' || nome ~ 'perdido'",
      'ordem',
      100,
      0,
    )
    for (let ep of etapasPerdidas) {
      if (ep.getBool('is_won')) {
        console.log(
          `[migracao_0024] Corrigindo etapa com nome perdido e is_won=true: ${ep.id} ("${ep.getString('nome')}")`,
        )
        ep.set('is_won', false)
        ep.set('is_lost', true)
        app.save(ep)
      }
    }

    // 2. Sincronizar o JSON etapas_ordenadas nos 3 funis correspondentes
    const funisAfetados = ['00j145nxxd3icvc', '0xrk52g6tab8b2s', 'yqao74mwrz3746r']
    for (let fId of funisAfetados) {
      try {
        const funil = app.findRecordById('funis', fId)
        let rawEtapas = []
        try {
          rawEtapas = JSON.parse(funil.getString('etapas_ordenadas'))
        } catch (_) {
          rawEtapas = []
        }

        if (Array.isArray(rawEtapas)) {
          let updated = false
          for (let item of rawEtapas) {
            if (typeof item === 'object' && item) {
              const itemNome = String(item.nome || '')
                .toLowerCase()
                .trim()
              if (itemNome === 'fechado perdido' || targetIds.includes(item.id)) {
                item.is_won = false
                item.is_lost = true
                updated = true
              }
            }
          }
          if (updated) {
            funil.set('etapas_ordenadas', rawEtapas)
            app.save(funil)
            console.log(`[migracao_0024] etapas_ordenadas atualizadas no funil ${fId}`)
          }
        }
      } catch (errF) {
        console.warn(`[migracao_0024] Erro ao sincronizar funil ${fId}:`, errF)
      }
    }

    // 3. Garantir consistência em oportunidades eventualmente vinculadas a essas etapas
    for (let tId of targetIds) {
      try {
        const oppsAfetadas = app.findRecordsByFilter(
          'oportunidades',
          `etapa_id = '${tId}'`,
          'created',
          100,
          0,
        )
        for (let op of oppsAfetadas) {
          op.set('is_won', false)
          op.set('is_lost', true)
          app.save(op)
          console.log(
            `[migracao_0024] Oportunidade ${op.id} vinculada à etapa ${tId} atualizada para is_won=false, is_lost=true`,
          )
        }
      } catch (_) {}
    }

    // 4. Invariante formal de integridade: checar todas as etapas em etapas_funil
    // Nenhuma etapa pode ter is_won === true E is_lost === true
    const todasEtapas = app.findAllRecords('etapas_funil')
    const invalidas = []
    for (let e of todasEtapas) {
      const won = e.getBool('is_won')
      const lost = e.getBool('is_lost')
      if (won && lost) {
        invalidas.push({ id: e.id, nome: e.getString('nome'), funil_id: e.getString('funil_id') })
      }
    }

    if (invalidas.length > 0) {
      throw new Error(
        `[migracao_0024] VIOLAÇÃO DA INVARIANTE is_won XOR is_lost! Encontradas etapas com ambas as flags ativas: ${JSON.stringify(invalidas)}`,
      )
    }

    console.log(
      `[migracao_0024] Auditoria finalizada: todas as ${todasEtapas.length} etapas respeitam a invariante is_won XOR is_lost.`,
    )
  },
  (app) => {
    console.log('[migracao_0024] Rollback...')
  },
)
