// pocketbase/hooks/etapas_funil_invariante.js
// Invariante formal de integridade comercial:
// Nenhuma etapa pode ter is_won === true e is_lost === true simultaneamente (is_won XOR is_lost ou ambas false).

onRecordCreateRequest((e) => {
  const isWon = Boolean(e.record.getBool('is_won'))
  const isLost = Boolean(e.record.getBool('is_lost'))

  if (isWon && isLost) {
    throw new ValidationError(
      'is_won',
      'INVARIANTE VIOLADA: Uma etapa não pode ser marcada como ganha (is_won) e perdida (is_lost) simultaneamente.',
    )
  }
  return e.next()
}, 'etapas_funil')

onRecordUpdateRequest((e) => {
  const isWon = Boolean(e.record.getBool('is_won'))
  const isLost = Boolean(e.record.getBool('is_lost'))

  if (isWon && isLost) {
    throw new ValidationError(
      'is_won',
      'INVARIANTE VIOLADA: Uma etapa não pode ser marcada como ganha (is_won) e perdida (is_lost) simultaneamente.',
    )
  }
  return e.next()
}, 'etapas_funil')
