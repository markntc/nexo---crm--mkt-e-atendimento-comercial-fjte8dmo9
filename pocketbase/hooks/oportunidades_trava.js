// pocketbase/hooks/oportunidades_trava.js
// Trava de Follow-up (padrão Pipedrive exigido no documento):
// Bloqueia avanço de etapa se proxima_acao_data não estiver preenchida.

onRecordUpdateRequest((e) => {
  const rec = e.record
  const original = rec.original()
  const originalEtapaId = original ? (original.getString('etapa_id') || '').trim() : ''
  const novaEtapaId = (rec.getString('etapa_id') || '').trim()
  const originalEtapaNome = original ? (original.getString('etapa_atual') || '').trim() : ''
  const novaEtapaNome = (rec.getString('etapa_atual') || '').trim()
  const proximaAcao = rec.getString('proxima_acao_data')

  // Se etapa_id mudou ou foi informado, sincroniza o espelho etapa_atual e as flags is_won/is_lost
  if (novaEtapaId && novaEtapaId !== originalEtapaId) {
    try {
      const etapaRec = e.app.findRecordById('etapas_funil', novaEtapaId)
      if (etapaRec) {
        rec.set('etapa_atual', etapaRec.getString('nome'))
        rec.set('is_won', etapaRec.getBool('is_won'))
        rec.set('is_lost', etapaRec.getBool('is_lost'))
      }
    } catch (_) {}
  } else if (!novaEtapaId && novaEtapaNome && novaEtapaNome !== originalEtapaNome) {
    // Compatibilidade caso venha apenas etapa_atual (nome)
    try {
      const funilId = rec.getString('funil_id')
      if (funilId) {
        const found = e.app.findRecordsByFilter(
          'etapas_funil',
          `funil_id = '${funilId}'`,
          '-created',
          50,
        )
        const match = found.find(
          (et) => et.getString('nome').toLowerCase().trim() === novaEtapaNome.toLowerCase().trim(),
        )
        if (match) {
          rec.set('etapa_id', match.id)
          rec.set('is_won', match.getBool('is_won'))
          rec.set('is_lost', match.getBool('is_lost'))
        }
      }
    } catch (_) {}
  }

  // Comparação para a trava de follow-up:
  // Se ambos tiverem etapa_id, compara estritamente por ID.
  let etapaMudou = false
  if (originalEtapaId && novaEtapaId) {
    etapaMudou = originalEtapaId !== novaEtapaId
  } else if (originalEtapaId !== novaEtapaId) {
    etapaMudou = true
  } else if (originalEtapaNome && novaEtapaNome) {
    etapaMudou = originalEtapaNome !== novaEtapaNome
  }

  // Se a etapa mudou e não há follow-up agendado, rejeita a requisição com ValidationError
  if (etapaMudou && !proximaAcao) {
    throw new ValidationError(
      'proxima_acao_data',
      'TRAVA DE FOLLOW-UP ATIVA: Não é permitido avançar a oportunidade de etapa sem agendar uma próxima ação de follow-up com data.',
    )
  }

  return e.next()
}, 'oportunidades')
