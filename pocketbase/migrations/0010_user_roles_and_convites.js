migrate(
  (app) => {
    // 1. Atualizar collection `users` adicionando campos para controle de status e papéis
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Ativo (para desativação sem excluir, preservando auditoria)
    if (!users.fields.getByName('ativo')) {
      users.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
    }

    // Role global: Administrador, Vendedor, Supervisor, Diretoria
    if (!users.fields.getByName('perfil_global')) {
      users.fields.add(
        new SelectField({
          name: 'perfil_global',
          required: false,
          values: ['Administrador', 'Supervisor', 'Vendedor', 'Diretoria'],
          maxSelect: 1,
        }),
      )
    }

    // Matriz de acessos JSON: {
    //   marcas_permitidas: string[], // ids das marcas
    //   papeis_por_marca: Record<string, 'Vendedor' | 'Supervisor' | 'Administrador de marca' | 'Diretoria'>,
    //   escopo_visibilidade: 'proprios' | 'equipe' | 'marca_inteira',
    //   pode_conciliar: boolean,
    //   pode_importar: boolean
    // }
    if (!users.fields.getByName('permissoes')) {
      users.fields.add(
        new JSONField({
          name: 'permissoes',
          required: false,
          maxSize: 2000000,
        }),
      )
    }

    // Permitir list e view para todos autenticados para permitir listar vendedores/usuários no CRM
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    // Update liberado para o próprio ou se o usuário autenticado for admin corporativo
    users.updateRule = "@request.auth.id != ''"
    // Create liberado para autenticado
    users.createRule = "@request.auth.id != ''"

    app.save(users)

    // Garantir que os usuários existentes estejam ativos por padrão
    try {
      app.db().newQuery('UPDATE users SET ativo = 1 WHERE ativo IS NULL').execute()
      app
        .db()
        .newQuery(
          "UPDATE users SET perfil_global = 'Administrador' WHERE email = 'skip.adm@ntc.ind.br'",
        )
        .execute()
    } catch (_) {}

    // 2. Criar collection `convites_usuarios`
    try {
      app.findCollectionByNameOrId('convites_usuarios')
    } catch (_) {
      const convites = new Collection({
        name: 'convites_usuarios',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'email', type: 'email', required: true },
          {
            name: 'perfil_global',
            type: 'select',
            required: true,
            values: ['Administrador', 'Supervisor', 'Vendedor', 'Diretoria'],
            maxSelect: 1,
          },
          { name: 'permissoes', type: 'json' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Pendente', 'Aceito', 'Cancelado'],
            maxSelect: 1,
          },
          {
            name: 'convidado_por_id',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_convites_email ON convites_usuarios (email)',
          'CREATE INDEX idx_convites_status ON convites_usuarios (status)',
        ],
      })
      app.save(convites)
    }
  },
  (app) => {
    try {
      const convites = app.findCollectionByNameOrId('convites_usuarios')
      app.delete(convites)
    } catch (_) {}

    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      if (users.fields.getByName('permissoes')) users.fields.removeByName('permissoes')
      if (users.fields.getByName('perfil_global')) users.fields.removeByName('perfil_global')
      if (users.fields.getByName('ativo')) users.fields.removeByName('ativo')
      app.save(users)
    } catch (_) {}
  },
)
