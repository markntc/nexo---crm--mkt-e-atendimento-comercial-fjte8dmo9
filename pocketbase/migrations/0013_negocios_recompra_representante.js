migrate(
  (app) => {
    // 1. Atualizar collection `oportunidades`
    const oportunidades = app.findCollectionByNameOrId('oportunidades')

    // Campo data_fechamento_esperada (date)
    if (!oportunidades.fields.getByName('data_fechamento_esperada')) {
      oportunidades.fields.add(
        new DateField({
          name: 'data_fechamento_esperada',
          required: false,
        }),
      )
    }

    // Campo tipo_cliente: "Cliente novo" ou "Recompra"
    if (!oportunidades.fields.getByName('tipo_cliente')) {
      oportunidades.fields.add(
        new SelectField({
          name: 'tipo_cliente',
          required: false,
          values: ['Cliente novo', 'Recompra'],
          maxSelect: 1,
        }),
      )
    }

    app.save(oportunidades)

    // 2. Atualizar perfil_global em `users` para aceitar "Representante"
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const userPerfilField = users.fields.getByName('perfil_global')
    if (userPerfilField) {
      users.fields.removeByName('perfil_global')
      users.fields.add(
        new SelectField({
          name: 'perfil_global',
          required: false,
          values: ['Administrador', 'Supervisor', 'Vendedor', 'Diretoria', 'Representante'],
          maxSelect: 1,
        }),
      )
      app.save(users)
    }

    // 3. Atualizar perfil_global em `convites_usuarios` para aceitar "Representante"
    try {
      const convites = app.findCollectionByNameOrId('convites_usuarios')
      const convitePerfilField = convites.fields.getByName('perfil_global')
      if (convitePerfilField) {
        convites.fields.removeByName('perfil_global')
        convites.fields.add(
          new SelectField({
            name: 'perfil_global',
            required: true,
            values: ['Administrador', 'Supervisor', 'Vendedor', 'Diretoria', 'Representante'],
            maxSelect: 1,
          }),
        )
        app.save(convites)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const oportunidades = app.findCollectionByNameOrId('oportunidades')
      if (oportunidades.fields.getByName('tipo_cliente')) {
        oportunidades.fields.removeByName('tipo_cliente')
      }
      if (oportunidades.fields.getByName('data_fechamento_esperada')) {
        oportunidades.fields.removeByName('data_fechamento_esperada')
      }
      app.save(oportunidades)
    } catch (_) {}
  },
)
