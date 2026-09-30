migrate(
  (app) => {
    // 1. marcas
    const marcas = new Collection({
      name: 'marcas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'ativo', type: 'bool' },
        { name: 'cor_destaque', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_marcas_slug ON marcas (slug)'],
    })
    app.save(marcas)
    const marcasId = marcas.id

    // 2. equipes
    const equipes = new Collection({
      name: 'equipes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'marca_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        { name: 'nome_equipe', type: 'text', required: true },
        {
          name: 'lider_usuario_id',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_equipes_marca ON equipes (marca_id)'],
    })
    app.save(equipes)
    const equipesId = equipes.id

    // 3. funis
    const funis = new Collection({
      name: 'funis',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'marca_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        {
          name: 'equipe_id',
          type: 'relation',
          required: false,
          collectionId: equipesId,
          maxSelect: 1,
        },
        { name: 'nome_funil', type: 'text', required: true },
        { name: 'etapas_ordenadas', type: 'json', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_funis_marca ON funis (marca_id)'],
    })
    app.save(funis)
    const funisId = funis.id

    // 4. clientes_b2b
    const clientesB2b = new Collection({
      name: 'clientes_b2b',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'cnpj', type: 'text', required: true },
        { name: 'razao_social', type: 'text', required: true },
        { name: 'nome_fantasia', type: 'text' },
        { name: 'inscricao_estadual', type: 'text' },
        { name: 'endereco_corporativo', type: 'text' },
        { name: 'email_principal', type: 'text' },
        { name: 'telefone', type: 'text' },
        {
          name: 'marca_captura_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        { name: 'origem_sistema', type: 'text' },
        { name: 'data_criacao', type: 'date' },
        { name: 'id_origem_externa', type: 'text' },
        {
          name: 'criado_por_id',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_clientes_b2b_cnpj ON clientes_b2b (cnpj)',
        'CREATE INDEX idx_clientes_b2b_marca ON clientes_b2b (marca_captura_id)',
      ],
    })
    app.save(clientesB2b)
    const clientesB2bId = clientesB2b.id

    // 5. clientes_b2c
    const clientesB2c = new Collection({
      name: 'clientes_b2c',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'cpf', type: 'text', required: true },
        { name: 'nome_completo', type: 'text', required: true },
        { name: 'email_principal', type: 'text' },
        { name: 'telefone', type: 'text' },
        {
          name: 'marca_captura_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        { name: 'origem_sistema', type: 'text' },
        { name: 'data_criacao', type: 'date' },
        { name: 'id_origem_externa', type: 'text' },
        {
          name: 'criado_por_id',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_clientes_b2c_cpf ON clientes_b2c (cpf)',
        'CREATE INDEX idx_clientes_b2c_marca ON clientes_b2c (marca_captura_id)',
      ],
    })
    app.save(clientesB2c)
    const clientesB2cId = clientesB2c.id

    // 6. contatos
    const contatos = new Collection({
      name: 'contatos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'cliente_b2b_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2bId,
          maxSelect: 1,
        },
        {
          name: 'consumidor_b2c_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2cId,
          maxSelect: 1,
        },
        { name: 'cargo', type: 'text' },
        { name: 'departamento', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contatos_b2b ON contatos (cliente_b2b_id)',
        'CREATE INDEX idx_contatos_b2c ON contatos (consumidor_b2c_id)',
      ],
    })
    app.save(contatos)

    // 7. leads
    const leads = new Collection({
      name: 'leads',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'marca_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        {
          name: 'origem',
          type: 'select',
          required: true,
          values: [
            'Formulário Web',
            'Landing Page',
            'Indicação',
            'WhatsApp',
            'Feira',
            'Importação',
            'Outro',
          ],
          maxSelect: 1,
        },
        { name: 'dados_contato', type: 'text', required: true },
        {
          name: 'status_qualificacao',
          type: 'select',
          required: true,
          values: ['Novo', 'Qualificado', 'Desqualificado', 'Convertido'],
          maxSelect: 1,
        },
        {
          name: 'cliente_b2b_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2bId,
          maxSelect: 1,
        },
        {
          name: 'cliente_b2c_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2cId,
          maxSelect: 1,
        },
        {
          name: 'criado_por_id',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_leads_marca ON leads (marca_id)',
        'CREATE INDEX idx_leads_status ON leads (status_qualificacao)',
      ],
    })
    app.save(leads)

    // 8. oportunidades
    const oportunidades = new Collection({
      name: 'oportunidades',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'marca_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        { name: 'funil_id', type: 'relation', required: true, collectionId: funisId, maxSelect: 1 },
        {
          name: 'equipe_id',
          type: 'relation',
          required: false,
          collectionId: equipesId,
          maxSelect: 1,
        },
        {
          name: 'cliente_b2b_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2bId,
          maxSelect: 1,
        },
        {
          name: 'cliente_b2c_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2cId,
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'valor_estimado', type: 'number' },
        { name: 'etapa_atual', type: 'text', required: true },
        {
          name: 'vendedor_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'proxima_acao_data', type: 'date' },
        { name: 'proxima_acao_descricao', type: 'text' },
        { name: 'campos_exportacao', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_oportunidades_marca ON oportunidades (marca_id)',
        'CREATE INDEX idx_oportunidades_funil ON oportunidades (funil_id)',
        'CREATE INDEX idx_oportunidades_etapa ON oportunidades (etapa_atual)',
      ],
    })
    app.save(oportunidades)
    const oportunidadesId = oportunidades.id

    // 9. atividades
    const atividades = new Collection({
      name: 'atividades',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'marca_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        {
          name: 'oportunidade_id',
          type: 'relation',
          required: true,
          collectionId: oportunidadesId,
          maxSelect: 1,
        },
        {
          name: 'responsavel_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['Ligação', 'Reunião', 'Visita', 'E-mail', 'WhatsApp', 'Outro'],
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text' },
        { name: 'data_vencimento', type: 'date', required: true },
        { name: 'concluida', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_atividades_marca ON atividades (marca_id)',
        'CREATE INDEX idx_atividades_oportunidade ON atividades (oportunidade_id)',
        'CREATE INDEX idx_atividades_vencimento ON atividades (data_vencimento)',
      ],
    })
    app.save(atividades)

    // 10. preferencias_comunicacao
    const preferencias = new Collection({
      name: 'preferencias_comunicacao',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'cliente_b2b_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2bId,
          maxSelect: 1,
        },
        {
          name: 'cliente_b2c_id',
          type: 'relation',
          required: false,
          collectionId: clientesB2cId,
          maxSelect: 1,
        },
        {
          name: 'marca_id',
          type: 'relation',
          required: true,
          collectionId: marcasId,
          maxSelect: 1,
        },
        {
          name: 'canal',
          type: 'select',
          required: true,
          values: ['E-mail', 'WhatsApp', 'Telefone', 'SMS'],
          maxSelect: 1,
        },
        {
          name: 'status_consentimento',
          type: 'select',
          required: true,
          values: ['Opt-in', 'Opt-out'],
          maxSelect: 1,
        },
        { name: 'data_atualizacao', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pref_marca ON preferencias_comunicacao (marca_id)',
        'CREATE INDEX idx_pref_b2b ON preferencias_comunicacao (cliente_b2b_id)',
        'CREATE INDEX idx_pref_b2c ON preferencias_comunicacao (cliente_b2c_id)',
      ],
    })
    app.save(preferencias)

    // 11. duplicidades (reconciliation queue)
    const duplicidades = new Collection({
      name: 'duplicidades',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'cliente_b2b_id_1',
          type: 'relation',
          required: false,
          collectionId: clientesB2bId,
          maxSelect: 1,
        },
        {
          name: 'cliente_b2c_id_1',
          type: 'relation',
          required: false,
          collectionId: clientesB2cId,
          maxSelect: 1,
        },
        {
          name: 'cliente_b2b_id_2',
          type: 'relation',
          required: false,
          collectionId: clientesB2bId,
          maxSelect: 1,
        },
        {
          name: 'cliente_b2c_id_2',
          type: 'relation',
          required: false,
          collectionId: clientesB2cId,
          maxSelect: 1,
        },
        {
          name: 'tipo_divergencia',
          type: 'select',
          required: true,
          values: ['CNPJ Similar', 'CPF Similar', 'Homonímia', 'E-mail Duplicado', 'Outro'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Aberta', 'Em Revisão', 'Resolvida', 'Bloqueada'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_duplicidades_status ON duplicidades (status)'],
    })
    app.save(duplicidades)

    // 12. logs_auditoria
    const logsAuditoria = new Collection({
      name: 'logs_auditoria',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'marca_id',
          type: 'relation',
          required: false,
          collectionId: marcasId,
          maxSelect: 1,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'entidade', type: 'text', required: true },
        { name: 'entidade_id', type: 'text', required: true },
        { name: 'dados_anteriores', type: 'json' },
        { name: 'dados_novos', type: 'json' },
        { name: 'timestamp', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_logs_entidade ON logs_auditoria (entidade, entidade_id)'],
    })
    app.save(logsAuditoria)
  },
  (app) => {
    const names = [
      'logs_auditoria',
      'duplicidades',
      'preferencias_comunicacao',
      'atividades',
      'oportunidades',
      'leads',
      'contatos',
      'clientes_b2c',
      'clientes_b2b',
      'funis',
      'equipes',
      'marcas',
    ]
    for (const name of names) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
