// pocketbase/hooks/oportunidades_defaults.js
// Preenchimento de defaults inteligentes na collection oportunidades:
// Se funil_id, marca_id ou etapa_atual vierem vazios, aplica os valores padrão contextuais
// antes de persistir, evitando que qualquer oportunidade fique órfã ou invisível no Kanban.
// Decisão de produto: nada obrigatório nem rejeitado — defaults inteligentes com log.

onRecordCreateRequest((e) => {
  const rec = e.record
  const authUser = e.auth

  // 1. Marca: se vazia, resolve a partir do contexto do usuário ou da primeira marca ativa
  let marcaId = rec.getString('marca_id')
  if (!marcaId) {
    if (authUser) {
      try {
        const rawPerms = authUser.get('permissoes')
        if (
          rawPerms &&
          typeof rawPerms === 'object' &&
          Array.isArray(rawPerms.marcas_permitidas) &&
          rawPerms.marcas_permitidas.length > 0
        ) {
          marcaId = String(rawPerms.marcas_permitidas[0] || '').trim()
        }
      } catch (_) {}
    }

    if (!marcaId) {
      try {
        const marcasAtivas = $app.findRecordsByFilter('marcas', 'ativo = true', 'created', 1, 0)
        if (marcasAtivas && marcasAtivas.length > 0) {
          marcaId = marcasAtivas[0].id
        }
      } catch (_) {}
    }

    if (marcaId) {
      rec.set('marca_id', marcaId)
      console.log(
        `[oportunidades_defaults] marca_id ausente: preenchido com default "${marcaId}" para oportunidade "${rec.getString('titulo') || 'sem título'}"`,
      )
    }
  }

  // 2. Funil: se vazio, busca o funil ativo/padrão vinculado à marca
  let funilId = rec.getString('funil_id')
  let targetFunilRec = null

  if (funilId) {
    try {
      targetFunilRec = $app.findRecordById('funis', funilId)
    } catch (_) {}
  }

  if (!targetFunilRec && marcaId) {
    try {
      const funisMarca = $app.findRecordsByFilter(
        'funis',
        `marca_id = "${marcaId}"`,
        'created',
        1,
        0,
      )
      if (funisMarca && funisMarca.length > 0) {
        targetFunilRec = funisMarca[0]
        funilId = targetFunilRec.id
        rec.set('funil_id', funilId)
        console.log(
          `[oportunidades_defaults] funil_id ausente: preenchido com funil padrão "${funilId}" (${targetFunilRec.getString('nome_funil')}) para oportunidade "${rec.getString('titulo') || 'sem título'}"`,
        )
      }
    } catch (errSearchFunil) {
      console.warn('[oportunidades_defaults] Erro ao buscar funil padrão da marca:', errSearchFunil)
    }
  }

  // 3. Equipe: se vazia e o funil tiver equipe_id, vincula
  if (!rec.getString('equipe_id') && targetFunilRec) {
    const equipeId = targetFunilRec.getString('equipe_id')
    if (equipeId) {
      rec.set('equipe_id', equipeId)
    }
  }

  // 4. Etapa Atual: se vazia, preenche com a primeira etapa do funil resolvido
  let etapaAtual = rec.getString('etapa_atual')
  if (!etapaAtual && targetFunilRec) {
    try {
      let etapasRaw = []
      try {
        etapasRaw = JSON.parse(targetFunilRec.getString('etapas_ordenadas')) ?? []
      } catch (_) {}
      if (Array.isArray(etapasRaw) && etapasRaw.length > 0) {
        const primeira = typeof etapasRaw[0] === 'string' ? etapasRaw[0] : etapasRaw[0]?.nome || ''
        if (primeira) {
          etapaAtual = primeira
          rec.set('etapa_atual', etapaAtual)
          console.log(
            `[oportunidades_defaults] etapa_atual ausente: preenchida com a primeira etapa "${etapaAtual}" do funil "${funilId}"`,
          )
        }
      }
    } catch (errEtapa) {
      console.warn('[oportunidades_defaults] Erro ao inferir etapa inicial:', errEtapa)
    }
  }

  if (!rec.getString('etapa_atual')) {
    rec.set('etapa_atual', 'Primeiro contato')
  }

  return e.next()
}, 'oportunidades')

onRecordUpdateRequest((e) => {
  const rec = e.record
  const marcaId = rec.getString('marca_id')
  let funilId = rec.getString('funil_id')

  // Se em update o funil_id foi limpo/ficou vazio mas a oportunidade tem marca, preenche com o padrão da marca
  if (!funilId && marcaId) {
    try {
      const funisMarca = $app.findRecordsByFilter(
        'funis',
        `marca_id = "${marcaId}"`,
        'created',
        1,
        0,
      )
      if (funisMarca && funisMarca.length > 0) {
        rec.set('funil_id', funisMarca[0].id)
        console.log(
          `[oportunidades_defaults] onRecordUpdateRequest: funil_id vazio preenchido com funil padrão "${funisMarca[0].id}"`,
        )
      }
    } catch (_) {}
  }

  return e.next()
}, 'oportunidades')
