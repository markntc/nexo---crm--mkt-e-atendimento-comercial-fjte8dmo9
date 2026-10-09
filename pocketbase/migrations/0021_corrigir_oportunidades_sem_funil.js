/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Identificar todas as oportunidades com funil_id vazio ou nulo
    const orfas = app.findRecordsByFilter(
      'oportunidades',
      'funil_id = "" || funil_id = null',
      '-created',
      500,
      0,
    )

    if (!orfas || orfas.length === 0) {
      console.log('[migracao_0021] Nenhuma oportunidade órfã sem funil_id encontrada.')
      return
    }

    console.log(
      `[migracao_0021] Encontradas ${orfas.length} oportunidades sem funil_id. Iniciando resolução de funil padrão...`,
    )

    // Cache de funil padrão por marca_id
    const funilPadraoPorMarca = {}

    for (let i = 0; i < orfas.length; i++) {
      const opp = orfas[i]
      const oppId = opp.id
      const titulo = opp.getString('titulo')
      const marcaId = opp.getString('marca_id')

      if (!marcaId) {
        console.warn(
          `[migracao_0021] Oportunidade ${oppId} ("${titulo}") não possui marca_id vinculada. Impossível inferir funil padrão.`,
        )
        continue
      }

      let funilPadrao = funilPadraoPorMarca[marcaId]
      if (funilPadrao === undefined) {
        try {
          const funis = app.findRecordsByFilter('funis', `marca_id = "${marcaId}"`, 'created', 1, 0)
          if (funis && funis.length > 0) {
            funilPadrao = funis[0]
            funilPadraoPorMarca[marcaId] = funilPadrao
          } else {
            funilPadrao = null
            funilPadraoPorMarca[marcaId] = null
            console.warn(`[migracao_0021] NTC Marca ${marcaId} não possui nenhum funil cadastrado.`)
          }
        } catch (err) {
          console.error(`[migracao_0021] Erro ao buscar funil da marca ${marcaId}:`, err)
          funilPadraoPorMarca[marcaId] = null
          funilPadrao = null
        }
      }

      if (!funilPadrao) {
        console.warn(
          `[migracao_0021] Mantendo funil_id vazio para oportunidade ${oppId} ("${titulo}") pois marca não tem funil.`,
        )
        continue
      }

      // Preenche funil_id
      opp.set('funil_id', funilPadrao.id)

      // Se a equipe estiver vazia e o funil tiver equipe_id, preenche também
      const funilEquipeId = funilPadrao.getString('equipe_id')
      if (funilEquipeId && !opp.getString('equipe_id')) {
        opp.set('equipe_id', funilEquipeId)
      }

      // Se etapa_atual estiver vazia, preencher com primeira etapa do funil
      const etapaAtual = opp.getString('etapa_atual')
      if (!etapaAtual) {
        try {
          let etapas = []
          try {
            etapas = JSON.parse(funilPadrao.getString('etapas_ordenadas')) ?? []
          } catch (_) {}
          if (Array.isArray(etapas) && etapas.length > 0) {
            const primeira = typeof etapas[0] === 'string' ? etapas[0] : etapas[0]?.nome || ''
            if (primeira) {
              opp.set('etapa_atual', primeira)
            }
          }
        } catch (errEtapa) {
          console.warn(
            `[migracao_0021] Falha ao extrair primeira etapa para oportunidade ${oppId}:`,
            errEtapa,
          )
        }
      }

      try {
        app.save(opp)
        console.log(
          `[migracao_0021] Sucesso: Oportunidade ${oppId} ("${titulo}") vinculada ao funil ${funilPadrao.id} ("${funilPadrao.getString('nome_funil')}").`,
        )
      } catch (errSave) {
        console.error(`[migracao_0021] Erro ao salvar oportunidade ${oppId}:`, errSave)
      }
    }
  },
  (app) => {
    // Reversão não necessária para preenchimento de integridade de dados nulos
    console.log('[migracao_0021] Reversão executada.')
  },
)
