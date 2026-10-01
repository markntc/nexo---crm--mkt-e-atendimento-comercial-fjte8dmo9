migrate(
  (app) => {
    try {
      app.db().newQuery('UPDATE users SET ativo = 1 WHERE ativo IS NULL OR ativo = 0').execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET perfil_global = 'Administrador' WHERE email = 'skip.adm@ntc.ind.br'",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET perfil_global = 'Supervisor' WHERE email = 'roberta.gomes@ntc.ind.br'",
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET perfil_global = 'Vendedor' WHERE email = 'carlos.muller@ntc.ind.br'",
        )
        .execute()
    } catch (e) {
      console.log('Erro ao atualizar usuarios padrão:', e)
    }
  },
  () => {},
)
