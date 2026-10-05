migrate(
  (app) => {
    // Configura duração adequada do token de sessão para os usuários (14 dias = 1209600s)
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users && users.authToken) {
      users.authToken.duration = 1209600 // 14 dias em segundos
      app.save(users)
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      if (users && users.authToken) {
        users.authToken.duration = 604800 // Padrão PocketBase 7 dias
        app.save(users)
      }
    } catch (_) {}
  },
)
