migrate(
  (app) => {
    // 1. Obter a coleção clientes_b2b
    const b2b = app.findCollectionByNameOrId('clientes_b2b')
    console.log('Collection b2b encontrada:', b2b.id, b2b.name)
  },
  (app) => {},
)
