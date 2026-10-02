migrate(
  (app) => {
    // Adicionar endereco_residencial na collection `pessoas`
    const pessoas = app.findCollectionByNameOrId('pessoas')
    if (!pessoas.fields.getByName('endereco_residencial')) {
      pessoas.fields.add(
        new TextField({
          name: 'endereco_residencial',
          required: false,
        }),
      )
      app.save(pessoas)
    }
  },
  (app) => {
    try {
      const pessoas = app.findCollectionByNameOrId('pessoas')
      if (pessoas.fields.getByName('endereco_residencial')) {
        pessoas.fields.removeByName('endereco_residencial')
        app.save(pessoas)
      }
    } catch (_) {}
  },
)
