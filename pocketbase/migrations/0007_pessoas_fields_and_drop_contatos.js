migrate(
  (app) => {
    const orgCol = app.findCollectionByNameOrId('organizacoes')
    const pesCol = app.findCollectionByNameOrId('pessoas')

    // 1. Adicionar campos em pessoas: organizacao_id, cargo, departamento
    if (!pesCol.fields.getByName('organizacao_id')) {
      pesCol.fields.add(
        new RelationField({
          name: 'organizacao_id',
          type: 'relation',
          required: false,
          collectionId: orgCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!pesCol.fields.getByName('cargo')) {
      pesCol.fields.add(
        new TextField({
          name: 'cargo',
          type: 'text',
          required: false,
        }),
      )
    }

    if (!pesCol.fields.getByName('departamento')) {
      pesCol.fields.add(
        new TextField({
          name: 'departamento',
          type: 'text',
          required: false,
        }),
      )
    }
    app.save(pesCol)

    // 2. Adicionar documento_faturamento em oportunidades
    try {
      const oppCol = app.findCollectionByNameOrId('oportunidades')
      if (!oppCol.fields.getByName('documento_faturamento')) {
        oppCol.fields.add(
          new SelectField({
            name: 'documento_faturamento',
            type: 'select',
            required: false,
            values: ['CPF', 'CNPJ', 'AMBOS'],
            maxSelect: 1,
          }),
        )
        app.save(oppCol)
      }
    } catch (e) {
      console.log('Erro ao adicionar campo documento_faturamento em oportunidades:', e)
    }

    // 3. Migrar dados de contatos para pessoas
    try {
      const contatosRecords = app.findRecordsByFilter('contatos', '', '-created', 500, 0)
      for (const ct of contatosRecords) {
        const pessoaId = ct.getString('consumidor_b2c_id')
        const orgId = ct.getString('cliente_b2b_id')
        const cargo = ct.getString('cargo')
        const depto = ct.getString('departamento')

        if (pessoaId) {
          try {
            const pessoaRec = app.findRecordById('pessoas', pessoaId)
            if (orgId) pessoaRec.set('organizacao_id', orgId)
            if (cargo) pessoaRec.set('cargo', cargo)
            if (depto) pessoaRec.set('departamento', depto)
            app.save(pessoaRec)
          } catch (e) {
            console.log('Erro ao atualizar pessoa do contato:', e)
          }
        }
      }

      // 4. Deletar collection contatos
      const contatosCol = app.findCollectionByNameOrId('contatos')
      app.delete(contatosCol)
    } catch (e) {
      console.log('Erro ao processar contatos:', e)
    }
  },
  (app) => {},
)
