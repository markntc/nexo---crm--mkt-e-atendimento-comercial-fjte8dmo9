migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const marcas = app.findCollectionByNameOrId('marcas')
    const equipes = app.findCollectionByNameOrId('equipes')
    const funis = app.findCollectionByNameOrId('funis')
    const clientesB2b = app.findCollectionByNameOrId('clientes_b2b')
    const clientesB2c = app.findCollectionByNameOrId('clientes_b2c')
    const contatos = app.findCollectionByNameOrId('contatos')
    const leads = app.findCollectionByNameOrId('leads')
    const oportunidades = app.findCollectionByNameOrId('oportunidades')
    const atividades = app.findCollectionByNameOrId('atividades')
    const preferencias = app.findCollectionByNameOrId('preferencias_comunicacao')
    const duplicidades = app.findCollectionByNameOrId('duplicidades')

    // 1. Seed Admin User: skip.adm@ntc.ind.br
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'skip.adm@ntc.ind.br')
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('skip.adm@ntc.ind.br')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Administrador Corporativo NTC')
      app.save(adminUser)
    }

    // 2. Seed 5 Marcas
    const marcasData = [
      { nome: 'NTC Serviços', slug: 'ntc-servicos', cor_destaque: '#1B4F72', ativo: true },
      { nome: 'Pierplas', slug: 'pierplas', cor_destaque: '#2E86C1', ativo: true },
      { nome: 'NTC Agro', slug: 'ntc-agro', cor_destaque: '#27AE60', ativo: true },
      { nome: 'NTC Geo', slug: 'ntc-geo', cor_destaque: '#8E44AD', ativo: true },
      { nome: 'Udê', slug: 'ude', cor_destaque: '#E67E22', ativo: true },
    ]

    const marcasMap = {}
    for (const m of marcasData) {
      let rec
      try {
        rec = app.findFirstRecordByData('marcas', 'slug', m.slug)
      } catch (_) {
        rec = new Record(marcas)
        rec.set('nome', m.nome)
        rec.set('slug', m.slug)
        rec.set('ativo', m.ativo)
        rec.set('cor_destaque', m.cor_destaque)
        app.save(rec)
      }
      marcasMap[m.slug] = rec
    }

    // 3. Seed Equipes por Marca
    const equipesData = [
      { marca_slug: 'ntc-servicos', nome: 'Comercial Industrial & Ferramentaria' },
      { marca_slug: 'pierplas', nome: 'Vendas Náuticas & Estruturas Flutuantes' },
      { marca_slug: 'ntc-agro', nome: 'Vendas Agropecuárias & Cooperativas' },
      { marca_slug: 'ntc-geo', nome: 'Soluções Técnicas de Sondagem' },
      { marca_slug: 'ude', nome: 'Vendas B2B Redes & Varejo B2C' },
    ]

    const equipesMap = {}
    for (const eq of equipesData) {
      const marcaRec = marcasMap[eq.marca_slug]
      let rec
      try {
        rec = app.findFirstRecordByData('equipes', 'nome_equipe', eq.nome)
      } catch (_) {
        rec = new Record(equipes)
        rec.set('marca_id', marcaRec.id)
        rec.set('nome_equipe', eq.nome)
        rec.set('lider_usuario_id', adminUser.id)
        app.save(rec)
      }
      equipesMap[eq.marca_slug] = rec
    }

    // 4. Seed Funis (1 por marca, e 2 para Udê)
    const funisData = [
      {
        marca_slug: 'ntc-servicos',
        nome_funil: 'Injeção e Moldes Sob Encomenda',
        etapas: [
          'Qualificação Técnica',
          'Análise de Desenho/Molde',
          'Cotação Consultiva',
          'Negociação',
          'Fechado Ganho',
          'Fechado Perdido',
        ],
      },
      {
        marca_slug: 'pierplas',
        nome_funil: 'Plataformas e Módulos Náuticos',
        etapas: [
          'Lead Recebido',
          'Dimensionamento de Área',
          'Projeto Técnico & Proposta',
          'Negociação Comercial',
          'Fechado Ganho',
          'Fechado Perdido',
        ],
      },
      {
        marca_slug: 'ntc-agro',
        nome_funil: 'Pisos e Grelhas para Suinocultura',
        etapas: [
          'Contato Inicial',
          'Mapeamento da Granja',
          'Proposta Comercial',
          'Aprovação de Crédito',
          'Fechado Ganho',
          'Fechado Perdido',
        ],
      },
      {
        marca_slug: 'ntc-geo',
        nome_funil: 'Caixas de Testemunho e Amostragem',
        etapas: [
          'Sondagem & Levantamento',
          'Amostra Enviada',
          'Orçamento em Lote',
          'Contrato / Fornecimento',
          'Fechado Ganho',
          'Fechado Perdido',
        ],
      },
      {
        marca_slug: 'ude',
        nome_funil: 'Udê B2B Atacado',
        etapas: [
          'Prospecção de Redes',
          'Apresentação Catálogo',
          'Pedido Piloto',
          'Negociação de Volume',
          'Fechado Ganho',
          'Fechado Perdido',
        ],
      },
      {
        marca_slug: 'ude',
        nome_funil: 'Udê B2C Varejo',
        etapas: [
          'Interesse Inicial',
          'Dúvida de Produto',
          'Carrinho / Orçamento',
          'Pagamento Confirmado',
          'Pós-venda Concluído',
        ],
      },
    ]

    const funisMap = {}
    for (const f of funisData) {
      const marcaRec = marcasMap[f.marca_slug]
      const equipeRec = equipesMap[f.marca_slug]
      let rec
      try {
        rec = app.findFirstRecordByData('funis', 'nome_funil', f.nome_funil)
      } catch (_) {
        rec = new Record(funis)
        rec.set('marca_id', marcaRec.id)
        rec.set('equipe_id', equipeRec ? equipeRec.id : null)
        rec.set('nome_funil', f.nome_funil)
        rec.set('etapas_ordenadas', f.etapas)
        app.save(rec)
      }
      funisMap[f.nome_funil] = rec
    }

    // 5. Seed Clientes B2B realistas
    const clientesB2bData = [
      {
        cnpj: '18.234.567/0001-89',
        razao_social: 'Marina Porto Belo Soluções Náuticas Ltda',
        nome_fantasia: 'Marina Porto Belo',
        inscricao_estadual: '254.890.123.110',
        endereco_corporativo: 'Av. Beira Mar, 1200, Angra dos Reis - RJ',
        email_principal: 'compras@marinaportobelo.com.br',
        telefone: '(24) 3365-8900',
        marca_slug: 'pierplas',
        origem_sistema: 'Migração Planilha Náutica',
      },
      {
        cnpj: '04.567.890/0001-42',
        razao_social: 'Cooperativa Agropecuária Vale do Chapecó',
        nome_fantasia: 'Copervale Agro',
        inscricao_estadual: '250.119.882.115',
        endereco_corporativo: 'Rodovia BR 282, Km 15, Chapecó - SC',
        email_principal: 'suprimentos@copervale.com.br',
        telefone: '(49) 3321-4400',
        marca_slug: 'ntc-agro',
        origem_sistema: 'PipeRun Legado',
      },
      {
        cnpj: '60.789.012/0001-35',
        razao_social: 'Geomil Mineração e Prospecção Mineral S.A.',
        nome_fantasia: 'Geomil Mineração',
        inscricao_estadual: '062.334.891.002',
        endereco_corporativo: 'Av. Afonso Pena, 3100, Belo Horizonte - MG',
        email_principal: 'geologia.suprimentos@geomil.com.br',
        telefone: '(31) 3280-9900',
        marca_slug: 'ntc-geo',
        origem_sistema: 'Indicação Técnica',
      },
      {
        cnpj: '52.123.456/0001-90',
        razao_social: 'Lojas Silva & Silva Casa e Decoração Ltda',
        nome_fantasia: 'Rede Silva House',
        inscricao_estadual: '114.982.341.119',
        endereco_corporativo: 'Rua Vergueiro, 2500, São Paulo - SP',
        email_principal: 'comercial@silvahouse.com.br',
        telefone: '(11) 5080-1200',
        marca_slug: 'ude',
        origem_sistema: 'Feira Housewares',
      },
      {
        cnpj: '33.987.654/0001-11',
        razao_social: 'TecnoMotores Automação Industrial Ltda',
        nome_fantasia: 'TecnoMotores',
        inscricao_estadual: '099.123.456.789',
        endereco_corporativo: 'Distrito Industrial III, Caxias do Sul - RS',
        email_principal: 'engenharia@tecnomotores.ind.br',
        telefone: '(54) 3218-7000',
        marca_slug: 'ntc-servicos',
        origem_sistema: 'Prospecção Ativa',
      },
    ]

    const clientesB2bMap = {}
    for (const c of clientesB2bData) {
      let rec
      try {
        rec = app.findFirstRecordByData('clientes_b2b', 'cnpj', c.cnpj)
      } catch (_) {
        rec = new Record(clientesB2b)
        rec.set('cnpj', c.cnpj)
        rec.set('razao_social', c.razao_social)
        rec.set('nome_fantasia', c.nome_fantasia)
        rec.set('inscricao_estadual', c.inscricao_estadual)
        rec.set('endereco_corporativo', c.endereco_corporativo)
        rec.set('email_principal', c.email_principal)
        rec.set('telefone', c.telefone)
        rec.set('marca_captura_id', marcasMap[c.marca_slug].id)
        rec.set('origem_sistema', c.origem_sistema)
        rec.set('data_criacao', new Date().toISOString())
        rec.set('criado_por_id', adminUser.id)
        app.save(rec)
      }
      clientesB2bMap[c.cnpj] = rec
    }

    // 6. Seed Clientes B2C realistas (com validação CPF)
    const clientesB2cData = [
      {
        cpf: '847.192.839-00',
        nome_completo: 'Carlos Eduardo de Mendonça',
        email_principal: 'carlos.mendonca@embarcacoes.com.br',
        telefone: '(21) 98877-6655',
        marca_slug: 'pierplas',
        origem_sistema: 'Formulário Pierplas Náutica',
      },
      {
        cpf: '192.837.465-98',
        nome_completo: 'Mariana Alcantara Silveira',
        email_principal: 'mariana.silveira@gmail.com',
        telefone: '(11) 97123-4567',
        marca_slug: 'ude',
        origem_sistema: 'Landing Page Linha Udê Organização',
      },
      {
        cpf: '582.910.374-21',
        nome_completo: 'Roberto Sampaio Filho',
        email_principal: 'roberto.sampaio@engenharia.com.br',
        telefone: '(31) 99882-1144',
        marca_slug: 'ntc-geo',
        origem_sistema: 'Contato Técnico B2C',
      },
    ]

    const clientesB2cMap = {}
    for (const c of clientesB2cData) {
      let rec
      try {
        rec = app.findFirstRecordByData('clientes_b2c', 'cpf', c.cpf)
      } catch (_) {
        rec = new Record(clientesB2c)
        rec.set('cpf', c.cpf)
        rec.set('nome_completo', c.nome_completo)
        rec.set('email_principal', c.email_principal)
        rec.set('telefone', c.telefone)
        rec.set('marca_captura_id', marcasMap[c.marca_slug].id)
        rec.set('origem_sistema', c.origem_sistema)
        rec.set('data_criacao', new Date().toISOString())
        rec.set('criado_por_id', adminUser.id)
        app.save(rec)
      }
      clientesB2cMap[c.cpf] = rec
    }

    // 7. Seed Contatos (Vínculo B2B <-> B2C)
    try {
      const contatoExist = app.findFirstRecordByData(
        'contatos',
        'cargo',
        'Engenheiro Chefe de Materiais',
      )
    } catch (_) {
      const b2bMarina = clientesB2bMap['18.234.567/0001-89']
      const b2cCarlos = clientesB2cMap['847.192.839-00']
      if (b2bMarina && b2cCarlos) {
        const rec = new Record(contatos)
        rec.set('cliente_b2b_id', b2bMarina.id)
        rec.set('consumidor_b2c_id', b2cCarlos.id)
        rec.set('cargo', 'Engenheiro Chefe de Materiais')
        rec.set('departamento', 'Infraestrutura Náutica')
        app.save(rec)
      }
    }

    // 8. Seed Leads
    const leadsData = [
      {
        marca_slug: 'ntc-servicos',
        origem: 'Formulário Web',
        dados_contato:
          'Ricardo Torres - Eng. de Produto, EletroTech (ricardo@electrotech.com.br / (19) 99123-8899)',
        status: 'Novo',
      },
      {
        marca_slug: 'pierplas',
        origem: 'WhatsApp',
        dados_contato:
          'Iate Clube Guaíba - Comodoro Fernando (contato@iateclube.com.br / (51) 3244-1100)',
        status: 'Qualificado',
      },
      {
        marca_slug: 'ntc-agro',
        origem: 'Feira',
        dados_contato:
          'Granja São Lucas - Marcos Silveira (msilveira@saolucasagro.com.br / (49) 98800-2211)',
        status: 'Novo',
      },
      {
        marca_slug: 'ntc-geo',
        origem: 'Indicação',
        dados_contato:
          'Consultoria Geológica Brasdril - Dra. Helena Castro (hcastro@brasdril.com.br / (31) 98777-4433)',
        status: 'Qualificado',
      },
      {
        marca_slug: 'ude',
        origem: 'Landing Page',
        dados_contato:
          'Distribuidora Nacional Utilidades - Paula Rezende (prezende@distnacional.com.br / (11) 3456-7890)',
        status: 'Convertido',
      },
    ]

    for (const l of leadsData) {
      try {
        app.findFirstRecordByData('leads', 'dados_contato', l.dados_contato)
      } catch (_) {
        const rec = new Record(leads)
        rec.set('marca_id', marcasMap[l.marca_slug].id)
        rec.set('origem', l.origem)
        rec.set('dados_contato', l.dados_contato)
        rec.set('status_qualificacao', l.status)
        rec.set('criado_por_id', adminUser.id)
        app.save(rec)
      }
    }

    // 9. Seed Oportunidades com datas de follow-up realistas
    const hoje = new Date()
    const amanha = new Date(hoje.getTime() + 24 * 3600 * 1000).toISOString()
    const proximaSemana = new Date(hoje.getTime() + 7 * 24 * 3600 * 1000).toISOString()
    const ontem = new Date(hoje.getTime() - 24 * 3600 * 1000).toISOString()

    const oppData = [
      {
        marca_slug: 'pierplas',
        funil_nome: 'Plataformas e Módulos Náuticos',
        titulo: 'Pier Modular 36m Flutuante - Marina Porto Belo',
        valor: 185000,
        etapa: 'Projeto Técnico & Proposta',
        b2b_cnpj: '18.234.567/0001-89',
        proxima_acao_data: amanha,
        proxima_acao_descricao:
          'Apresentar laudo de ancoragem e proposta comercial final com prazo de entrega',
      },
      {
        marca_slug: 'pierplas',
        funil_nome: 'Plataformas e Módulos Náuticos',
        titulo: 'Plataforma Náutica Privativa Lazer 6x4m',
        valor: 34500,
        etapa: 'Negociação Comercial',
        b2c_cpf: '847.192.839-00',
        proxima_acao_data: proximaSemana,
        proxima_acao_descricao: 'Enviar contrato de venda com condição parcelada em 4x',
      },
      {
        marca_slug: 'ntc-agro',
        funil_nome: 'Pisos e Grelhas para Suinocultura',
        titulo: 'Fornecimento de Pisos Vazados 1.200m² - Granja Copervale',
        valor: 240000,
        etapa: 'Proposta Comercial',
        b2b_cnpj: '04.567.890/0001-42',
        proxima_acao_data: ontem, // vencido de propósito para KPI
        proxima_acao_descricao: 'Revisão de frete para entrega fracionada em Chapecó',
      },
      {
        marca_slug: 'ntc-geo',
        funil_nome: 'Caixas de Testemunho e Amostragem',
        titulo: 'Lote Inicial 3.000 Caixas Plastificadas HQ - Geomil',
        valor: 96000,
        etapa: 'Amostra Enviada',
        b2b_cnpj: '60.789.012/0001-35',
        proxima_acao_data: amanha,
        proxima_acao_descricao: 'Acompanhar recebimento das caixas modelo no laboratório de campo',
      },
      {
        marca_slug: 'ude',
        funil_nome: 'Udê B2B Atacado',
        titulo: 'Contrato Anual Linha Potes Herméticos - Rede Silva House',
        valor: 320000,
        etapa: 'Negociação de Volume',
        b2b_cnpj: '52.123.456/0001-90',
        proxima_acao_data: amanha,
        proxima_acao_descricao: 'Definir tabela de bonificação por volume semestral',
      },
      {
        marca_slug: 'ntc-servicos',
        funil_nome: 'Injeção e Moldes Sob Encomenda',
        titulo: 'Desenvolvimento de Molde 4 Cavidades Carcaça Motor',
        valor: 145000,
        etapa: 'Cotação Consultiva',
        b2b_cnpj: '33.987.654/0001-11',
        proxima_acao_data: proximaSemana,
        proxima_acao_descricao: 'Validar taxa de contração da resina PA66 com aditivo antichama',
      },
    ]

    const oppMap = {}
    for (const op of oppData) {
      let rec
      try {
        rec = app.findFirstRecordByData('oportunidades', 'titulo', op.titulo)
      } catch (_) {
        rec = new Record(oportunidades)
        rec.set('marca_id', marcasMap[op.marca_slug].id)
        rec.set('funil_id', funisMap[op.funil_nome].id)
        rec.set('equipe_id', equipesMap[op.marca_slug].id)
        rec.set('titulo', op.titulo)
        rec.set('valor_estimado', op.valor)
        rec.set('etapa_atual', op.etapa)
        rec.set('vendedor_id', adminUser.id)
        rec.set('proxima_acao_data', op.proxima_acao_data)
        rec.set('proxima_acao_descricao', op.proxima_acao_descricao)
        if (op.b2b_cnpj && clientesB2bMap[op.b2b_cnpj]) {
          rec.set('cliente_b2b_id', clientesB2bMap[op.b2b_cnpj].id)
        }
        if (op.b2c_cpf && clientesB2cMap[op.b2c_cpf]) {
          rec.set('cliente_b2c_id', clientesB2cMap[op.b2c_cpf].id)
        }
        app.save(rec)
      }
      oppMap[op.titulo] = rec
    }

    // 10. Seed Atividades / Tarefas
    const atividadesData = [
      {
        marca_slug: 'pierplas',
        opp_titulo: 'Pier Modular 36m Flutuante - Marina Porto Belo',
        tipo: 'Reunião',
        descricao: 'Reunião presencial na Marina para medição de maré e profundidade',
        vencimento: amanha,
        concluida: false,
      },
      {
        marca_slug: 'ntc-agro',
        opp_titulo: 'Fornecimento de Pisos Vazados 1.200m² - Granja Copervale',
        tipo: 'Ligação',
        descricao: 'Ligar para engenheiro agrônomo da Copervale sobre especificação de carga',
        vencimento: ontem,
        concluida: false,
      },
      {
        marca_slug: 'ntc-geo',
        opp_titulo: 'Lote Inicial 3.000 Caixas Plastificadas HQ - Geomil',
        tipo: 'E-mail',
        descricao: 'Enviar catálogo técnico de resistência ao impacto UV em mina aberta',
        vencimento: proximaSemana,
        concluida: false,
      },
      {
        marca_slug: 'ude',
        opp_titulo: 'Contrato Anual Linha Potes Herméticos - Rede Silva House',
        tipo: 'Visita',
        descricao: 'Apresentação dos protótipos de cores da nova coleção primavera',
        vencimento: amanha,
        concluida: true,
      },
    ]

    for (const at of atividadesData) {
      const opp = oppMap[at.opp_titulo]
      if (!opp) continue
      try {
        app.findFirstRecordByData('atividades', 'descricao', at.descricao)
      } catch (_) {
        const rec = new Record(atividades)
        rec.set('marca_id', marcasMap[at.marca_slug].id)
        rec.set('oportunidade_id', opp.id)
        rec.set('responsavel_id', adminUser.id)
        rec.set('tipo', at.tipo)
        rec.set('descricao', at.descricao)
        rec.set('data_vencimento', at.vencimento)
        rec.set('concluida', at.concluida)
        app.save(rec)
      }
    }

    // 11. Seed Preferencias de Comunicacao (LGPD) segregadas por marca
    const b2bMarina = clientesB2bMap['18.234.567/0001-89']
    const b2cMariana = clientesB2cMap['192.837.465-98']

    if (b2bMarina) {
      try {
        app.findFirstRecordByData('preferencias_comunicacao', 'cliente_b2b_id', b2bMarina.id)
      } catch (_) {
        const p1 = new Record(preferencias)
        p1.set('cliente_b2b_id', b2bMarina.id)
        p1.set('marca_id', marcasMap['pierplas'].id)
        p1.set('canal', 'E-mail')
        p1.set('status_consentimento', 'Opt-in')
        p1.set('data_atualizacao', new Date().toISOString())
        app.save(p1)

        const p2 = new Record(preferencias)
        p2.set('cliente_b2b_id', b2bMarina.id)
        p2.set('marca_id', marcasMap['pierplas'].id)
        p2.set('canal', 'WhatsApp')
        p2.set('status_consentimento', 'Opt-in')
        p2.set('data_atualizacao', new Date().toISOString())
        app.save(p2)
      }
    }

    if (b2cMariana) {
      try {
        app.findFirstRecordByData('preferencias_comunicacao', 'cliente_b2c_id', b2cMariana.id)
      } catch (_) {
        const p = new Record(preferencias)
        p.set('cliente_b2c_id', b2cMariana.id)
        p.set('marca_id', marcasMap['ude'].id)
        p.set('canal', 'WhatsApp')
        p.set('status_consentimento', 'Opt-in')
        p.set('data_atualizacao', new Date().toISOString())
        app.save(p)
      }
    }

    // 12. Seed Duplicidades (Fila de Conciliação Humana)
    try {
      app.findFirstRecordByData('duplicidades', 'tipo_divergencia', 'Homonímia')
    } catch (_) {
      const marina = clientesB2bMap['18.234.567/0001-89']
      const silva = clientesB2bMap['52.123.456/0001-90']
      if (marina && silva) {
        const rec = new Record(duplicidades)
        rec.set('cliente_b2b_id_1', marina.id)
        rec.set('cliente_b2b_id_2', silva.id)
        rec.set('tipo_divergencia', 'Homonímia')
        rec.set('status', 'Aberta')
        rec.set(
          'observacoes',
          'Suspeita de filial do mesmo grupo com razão social aproximada identificada em importação',
        )
        app.save(rec)
      }
    }
  },
  (app) => {
    // down logic: optional cleanup
  },
)
