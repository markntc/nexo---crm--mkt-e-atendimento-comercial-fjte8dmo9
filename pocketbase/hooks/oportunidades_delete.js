// pocketbase/hooks/oportunidades_delete.js
// Exclusão em cascata no backend para a collection oportunidades:
// Antes da exclusão da oportunidade, remove os registros dependentes com relação obrigatória,
// especialmente atividades (campo oportunidade_id com required: true).
// Também verifica e remove de forma segura eventuais vínculos com outras collections dependentes.

onRecordDelete((e) => {
  const oportunidadeId = e.record.id

  try {
    // 1. Remover atividades vinculadas (oportunidade_id é obrigatório em atividades)
    const atividades = $app.findRecordsByFilter(
      'atividades',
      `oportunidade_id = '${oportunidadeId}'`,
      '-created',
      500,
      0,
    )

    for (let i = 0; i < atividades.length; i++) {
      try {
        $app.delete(atividades[i])
      } catch (errAtiv) {
        console.error(
          `[Exclusão em Cascata] Erro ao excluir atividade ${atividades[i].id} da oportunidade ${oportunidadeId}:`,
          errAtiv,
        )
      }
    }

    if (atividades.length > 0) {
      console.log(
        `[Exclusão em Cascata] ${atividades.length} atividade(s) excluída(s) para a oportunidade ${oportunidadeId}`,
      )
    }

    // 2. Remover anexos vinculados (e seus arquivos físicos no storage)
    try {
      const anexos = $app.findRecordsByFilter(
        'anexos',
        `oportunidade_id = '${oportunidadeId}'`,
        '-created',
        500,
        0,
      )

      for (let j = 0; j < anexos.length; j++) {
        try {
          $app.delete(anexos[j])
        } catch (errAnexo) {
          console.error(
            `[Exclusão em Cascata] Erro ao excluir anexo ${anexos[j].id} da oportunidade ${oportunidadeId}:`,
            errAnexo,
          )
        }
      }

      if (anexos.length > 0) {
        console.log(
          `[Exclusão em Cascata] ${anexos.length} anexo(s) excluído(s) para a oportunidade ${oportunidadeId}`,
        )
      }
    } catch (errAnxFilter) {
      console.warn(`[Exclusão em Cascata] Aviso ao buscar anexos vinculados:`, errAnxFilter)
    }

    // 3. Outras dependências futuras
    // (em leads não há campo direto com required para oportunidade, mas caso exista vínculo em outras collections futuras)
  } catch (err) {
    console.error(
      `[Exclusão em Cascata] Erro durante limpeza de dependências da oportunidade ${oportunidadeId}:`,
      err,
    )
  }

  return e.next()
}, 'oportunidades')
