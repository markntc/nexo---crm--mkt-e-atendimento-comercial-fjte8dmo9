// pocketbase/hooks/auditoria_log.js
// Grava logs imutáveis na collection logs_auditoria para entidades sensíveis:
// clientes_b2b, clientes_b2c, oportunidades, preferencias_comunicacao

onRecordAfterCreateSuccess(
  (e) => {
    try {
      const colName = e.record.collection().name
      const logsCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(logsCol)

      let marcaId = ''
      if (e.record.has('marca_id')) {
        marcaId = e.record.getString('marca_id')
      } else if (e.record.has('marca_captura_id')) {
        marcaId = e.record.getString('marca_captura_id')
      }

      let usuarioId = ''
      if (e.record.has('criado_por_id')) {
        usuarioId = e.record.getString('criado_por_id')
      } else if (e.record.has('vendedor_id')) {
        usuarioId = e.record.getString('vendedor_id')
      }

      logRec.set('marca_id', marcaId || null)
      logRec.set('usuario_id', usuarioId || null)
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
  'clientes_b2b',
  'clientes_b2c',
  'oportunidades',
  'preferencias_comunicacao',
)

onRecordAfterUpdateSuccess(
  (e) => {
    try {
      const colName = e.record.collection().name
      const logsCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(logsCol)

      let marcaId = ''
      if (e.record.has('marca_id')) {
        marcaId = e.record.getString('marca_id')
      } else if (e.record.has('marca_captura_id')) {
        marcaId = e.record.getString('marca_captura_id')
      }

      let usuarioId = ''
      if (e.record.has('criado_por_id')) {
        usuarioId = e.record.getString('criado_por_id')
      } else if (e.record.has('vendedor_id')) {
        usuarioId = e.record.getString('vendedor_id')
      }

      logRec.set('marca_id', marcaId || null)
      logRec.set('usuario_id', usuarioId || null)
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
  'clientes_b2b',
  'clientes_b2c',
  'oportunidades',
  'preferencias_comunicacao',
)

onRecordAfterDeleteSuccess(
  (e) => {
    try {
      const colName = e.record.collection().name
      const logsCol = $app.findCollectionByNameOrId('logs_auditoria')
      const logRec = new Record(logsCol)

      let marcaId = ''
      if (e.record.has('marca_id')) {
        marcaId = e.record.getString('marca_id')
      } else if (e.record.has('marca_captura_id')) {
        marcaId = e.record.getString('marca_captura_id')
      }

      logRec.set('marca_id', marcaId || null)
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
  'clientes_b2b',
  'clientes_b2c',
  'oportunidades',
  'preferencias_comunicacao',
)
