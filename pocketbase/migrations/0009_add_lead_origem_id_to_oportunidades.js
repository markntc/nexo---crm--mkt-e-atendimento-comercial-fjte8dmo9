migrate(
  (app) => {
    const oportunidades = app.findCollectionByNameOrId('oportunidades')
    const leads = app.findCollectionByNameOrId('leads')

    if (!oportunidades.fields.getByName('lead_origem_id')) {
      oportunidades.fields.add(
        new RelationField({
          name: 'lead_origem_id',
          collectionId: leads.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(oportunidades)
    }
  },
  (app) => {
    const oportunidades = app.findCollectionByNameOrId('oportunidades')
    const field = oportunidades.fields.getByName('lead_origem_id')
    if (field) {
      oportunidades.fields.removeByName('lead_origem_id')
      app.save(oportunidades)
    }
  },
)
