migrate(
  (app) => {
    // Garantir que novas instâncias ou seeds encontrem dados em organizacoes e pessoas se necessário
    const orgCol = app.findCollectionByNameOrId('organizacoes')
    const pesCol = app.findCollectionByNameOrId('pessoas')
    console.log('Collections organizacoes e pessoas confirmadas ativas:', orgCol.id, pesCol.id)
  },
  (app) => {},
)
