migrate(
  (app) => {
    // Tentar renomear apenas clientes_b2b -> organizacoes
    const b2b = app.findCollectionByNameOrId('clientes_b2b')
    b2b.name = 'organizacoes'
    app.save(b2b)
  },
  (app) => {},
)
