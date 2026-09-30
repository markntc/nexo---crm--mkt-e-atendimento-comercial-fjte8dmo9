// pocketbase/hooks/oportunidades_trava.js
// Trava de Follow-up (padrão Pipedrive exigido no documento):
// Bloqueia avanço de etapa se proxima_acao_data não estiver preenchida.

onRecordUpdateRequest((e) => {
  const rec = e.record
  const originalEtapa = rec.original() ? rec.original().getString('etapa_atual') : ''
  const novaEtapa = rec.getString('etapa_atual')
  const proximaAcao = rec.getString('proxima_acao_data')

  // Se a etapa mudou e não há follow-up agendado, rejeita a requisição com ValidationError
  if (originalEtapa && novaEtapa && originalEtapa !== novaEtapa && !proximaAcao) {
    throw new ValidationError(
      'proxima_acao_data',
      'TRAVA DE FOLLOW-UP ATIVA: Não é permitido avançar a oportunidade de etapa sem agendar uma próxima ação de follow-up com data.',
    )
  }

  return e.next()
}, 'oportunidades')
