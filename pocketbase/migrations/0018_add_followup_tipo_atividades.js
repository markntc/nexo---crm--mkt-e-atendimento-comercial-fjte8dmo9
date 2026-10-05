/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar o campo `tipo` da collection `atividades` para permitir 'Follow-up'
    const atividades = app.findCollectionByNameOrId('atividades')
    const tipoField = atividades.fields.getByName('tipo')
    if (tipoField) {
      const allowed = ['Ligação', 'Reunião', 'Visita', 'E-mail', 'WhatsApp', 'Outro', 'Follow-up']
      tipoField.values = allowed
      app.save(atividades)
    }

    // 2. Corrigir negócios órfãos da Roberta (17:24–17:25):
    // Como a usuária tentou salvar duas vezes gerando duplicidade do negócio "Volmir Ignacio Wagner"
    // (xq1m3uwvy25q6uv criado às 17:24:14 e btwo6k21fdujqxh criado às 17:25:25),
    // removemos a duplicata órfã mais recente e criamos a atividade de follow-up no negócio principal mantido.
    try {
      const opp1 = app.findRecordById('oportunidades', 'xq1m3uwvy25q6uv')
      const opp2 = app.findRecordById('oportunidades', 'btwo6k21fdujqxh')

      if (opp1 && opp2) {
        // Exclui a duplicata
        app.delete(opp2)
      }

      // Cria a atividade de follow-up que falhou para opp1 se ainda não existir
      if (opp1) {
        const ativsExistentes = app.findRecordsByFilter(
          'atividades',
          "oportunidade_id = 'xq1m3uwvy25q6uv'",
          '',
          10,
          0,
        )
        if (!ativsExistentes || ativsExistentes.length === 0) {
          const ativRecord = new Record(atividades)
          ativRecord.set('oportunidade_id', opp1.id)
          ativRecord.set('marca_id', opp1.getString('marca_id'))
          ativRecord.set('responsavel_id', opp1.getString('vendedor_id'))
          ativRecord.set('tipo', 'Follow-up')
          ativRecord.set(
            'descricao',
            opp1.getString('proxima_acao_descricao') || 'Primeiro alinhamento comercial',
          )
          ativRecord.set(
            'data_vencimento',
            opp1.getString('proxima_acao_data') || '2026-10-06 00:00:00.000Z',
          )
          ativRecord.set('concluida', false)
          app.save(ativRecord)
        }
      }
    } catch (err) {
      console.log('Aviso ao corrigir negócios órfãos da Roberta:', err)
    }
  },
  (app) => {
    try {
      const atividades = app.findCollectionByNameOrId('atividades')
      const tipoField = atividades.fields.getByName('tipo')
      if (tipoField) {
        tipoField.values = ['Ligação', 'Reunião', 'Visita', 'E-mail', 'WhatsApp', 'Outro']
        app.save(atividades)
      }
    } catch (_) {}
  },
)
