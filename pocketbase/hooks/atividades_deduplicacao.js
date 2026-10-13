// pocketbase/hooks/atividades_deduplicacao.js
// Hook server-side de deduplicação de atividades em janela curta (~60 segundos).
// Rejeita criação idêntica (oportunidade_id + tipo + descricao + data_vencimento)
// dentro de 60 segundos da atividade existente, evitando flood/duplo clique acidental.

onRecordCreateRequest((e) => {
  const rec = e.record
  const oppId = (rec.getString('oportunidade_id') || '').trim()
  const tipo = (rec.getString('tipo') || '').trim()
  const descricao = (rec.getString('descricao') || '').trim()
  const dataVencimento = (rec.getString('data_vencimento') || '').trim()

  // Se não tem oportunidade vinculada, permite normalmente
  if (!oppId) {
    return e.next()
  }

  try {
    // Janela curta de 60 segundos
    const windowStart = new Date(Date.now() - 60 * 1000).toISOString().replace('T', ' ')
    // PocketBase filtra strings com aspas simples escapadas
    const safeDesc = descricao.replace(/'/g, "\\'")

    let filter = `oportunidade_id = '${oppId}' && tipo = '${tipo}' && created >= '${windowStart}'`
    if (descricao) {
      filter += ` && descricao = '${safeDesc}'`
    }
    if (dataVencimento) {
      filter += ` && data_vencimento = '${dataVencimento}'`
    }

    const recentes = $app.findRecordsByFilter('atividades', filter, '-created', 1, 0)
    if (recentes && recentes.length > 0) {
      console.log(
        `[atividades_deduplicacao] Bloqueando atividade duplicada idêntica para oportunidade ${oppId} criada há menos de 60s (atividade existente: ${recentes[0].id})`,
      )
      // Lança BadRequestError para informar duplicação em janela curta
      throw new BadRequestError(
        'Atividade idêntica já foi registrada recentemente para este negócio.',
      )
    }
  } catch (err) {
    if (err instanceof BadRequestError) {
      throw err
    }
    // Erros não-fatais de query no hook não travam o fluxo
    console.warn(
      '[atividades_deduplicacao] Erro defensivo ao checar duplicidade de atividade:',
      err,
    )
  }

  return e.next()
}, 'atividades')
