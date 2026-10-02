// pocketbase/hooks/auditoria_log.js
// Grava logs imutáveis na collection logs_auditoria para entidades sensíveis:
// organizacoes, pessoas, oportunidades, preferencias_comunicacao

onRecordAfterCreateSuccess(
  (e) => {
    try {
      const colName = e.record.collection().name
      const logsCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(logsCol)

      // Leitura segura sem usar .has()
      const rawMarca = e.record.get('marca_id') || e.record.get('marca_captura_id')
      const marcaId = rawMarca ? String(rawMarca) : null

      const rawUser = e.record.get('criado_por_id') || e.record.get('vendedor_id')
      let usuarioId = rawUser ? String(rawUser) : null

      // Fallback para o authRecord se disponível
      if (!usuarioId) {
        try {
          const authRec = $app.findAuthRecordByEmail('_pb_users_auth_', 'skip.adm@ntc.ind.br')
          if (authRec) usuarioId = authRec.id
        } catch (_) {}
      }

      logRec.set('marca_id', marcaId)
      logRec.set('usuario_id', usuarioId)
      logRec.set('entidade', colName)
      logRec.set('entidade_id', e.record.id)
      logRec.set('dados_anteriores', null)
      logRec.set('dados_novos', e.record.publicExport())
      logRec.set('timestamp', new Date().toISOString())

      $app.save(logRec)
    } catch (err) {
      console.error('Erro ao registrar log de auditoria (create):', err)
    }

    return e.next()
  },
  'organizacoes',
  'pessoas',
  'oportunidades',
  'preferencias_comunicacao',
)

onRecordAfterUpdateSuccess(
  (e) => {
    try {
      const colName = e.record.collection().name
      const logsCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(logsCol)

      // Leitura segura sem usar .has()
      const rawMarca = e.record.get('marca_id') || e.record.get('marca_captura_id')
      const marcaId = rawMarca ? String(rawMarca) : null

      const rawUser = e.record.get('criado_por_id') || e.record.get('vendedor_id')
      let usuarioId = rawUser ? String(rawUser) : null

      // Fallback para o authRecord se disponível
      if (!usuarioId) {
        try {
          const authRec = $app.findAuthRecordByEmail('_pb_users_auth_', 'skip.adm@ntc.ind.br')
          if (authRec) usuarioId = authRec.id
        } catch (_) {}
      }

      logRec.set('marca_id', marcaId)
      logRec.set('usuario_id', usuarioId)
      logRec.set('entidade', colName)
      logRec.set('entidade_id', e.record.id)
      logRec.set(
        'dados_anteriores',
        e.record.original() ? e.record.original().publicExport() : null,
      )
      logRec.set('dados_novos', e.record.publicExport())
      logRec.set('timestamp', new Date().toISOString())

      $app.save(logRec)
    } catch (err) {
      console.error('Erro ao registrar log de auditoria (update):', err)
    }

    return e.next()
  },
  'organizacoes',
  'pessoas',
  'oportunidades',
  'preferencias_comunicacao',
)

onRecordAfterDeleteSuccess(
  (e) => {
    try {
      const colName = e.record.collection().name
      const logsCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(logsCol)

      // Leitura segura sem usar .has()
      const rawMarca = e.record.get('marca_id') || e.record.get('marca_captura_id')
      const marcaId = rawMarca ? String(rawMarca) : null

      const rawUser = e.record.get('criado_por_id') || e.record.get('vendedor_id')
      let usuarioId = rawUser ? String(rawUser) : null

      // Fallback para o authRecord se disponível
      if (!usuarioId) {
        try {
          const authRec = $app.findAuthRecordByEmail('_pb_users_auth_', 'skip.adm@ntc.ind.br')
          if (authRec) usuarioId = authRec.id
        } catch (_) {}
      }

      logRec.set('marca_id', marcaId)
      logRec.set('usuario_id', usuarioId)
      logRec.set('entidade', colName)
      logRec.set('entidade_id', e.record.id)
      logRec.set('dados_anteriores', e.record.publicExport())
      logRec.set('dados_novos', null)
      logRec.set('timestamp', new Date().toISOString())

      $app.save(logRec)
    } catch (err) {
      console.error('Erro ao registrar log de auditoria (delete):', err)
    }

    return e.next()
  },
  'organizacoes',
  'pessoas',
  'oportunidades',
  'preferencias_comunicacao',
)
