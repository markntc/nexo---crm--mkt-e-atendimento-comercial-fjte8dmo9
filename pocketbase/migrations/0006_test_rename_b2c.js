migrate(
  (app) => {
    // Renomear clientes_b2c -> pessoas
    const b2c = app.findCollectionByNameOrId('clientes_b2c')
    b2c.name = 'pessoas'
    app.save(b2c)
  },
  (app) => {},
)
