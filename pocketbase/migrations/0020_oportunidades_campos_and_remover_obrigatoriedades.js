/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. OPORTUNIDADES:
    // Adicionar campos faltantes: origem (text), id_canal_origem (text), observacoes (text), status (text)
    // Tornar opcionais campos que possam ter vindo required (titulo, etapa_atual, vendedor_id, funil_id, marca_id)
    const oppCol = app.findCollectionByNameOrId('oportunidades')

    if (!oppCol.fields.getByName('origem')) {
      oppCol.fields.add(
        new TextField({
          name: 'origem',
          required: false,
        }),
      )
    }

    if (!oppCol.fields.getByName('id_canal_origem')) {
      oppCol.fields.add(
        new TextField({
          name: 'id_canal_origem',
          required: false,
        }),
      )
    }

    if (!oppCol.fields.getByName('observacoes')) {
      oppCol.fields.add(
        new TextField({
          name: 'observacoes',
          required: false,
        }),
      )
    }

    if (!oppCol.fields.getByName('status')) {
      oppCol.fields.add(
        new TextField({
          name: 'status',
          required: false,
        }),
      )
    }

    // Tornar campos de oportunidades opcionais conforme diretriz geral
    const oppTitulo = oppCol.fields.getByName('titulo')
    if (oppTitulo) oppTitulo.required = false

    const oppEtapa = oppCol.fields.getByName('etapa_atual')
    if (oppEtapa) oppEtapa.required = false

    const oppVendedor = oppCol.fields.getByName('vendedor_id')
    if (oppVendedor) oppVendedor.required = false

    const oppFunil = oppCol.fields.getByName('funil_id')
    if (oppFunil) oppFunil.required = false

    const oppMarca = oppCol.fields.getByName('marca_id')
    if (oppMarca) oppMarca.required = false

    app.save(oppCol)

    // 2. ORGANIZACOES:
    // Tornar razao_social e marca_captura_id opcionais (required = false)
    const orgCol = app.findCollectionByNameOrId('organizacoes')
    const orgRazao = orgCol.fields.getByName('razao_social')
    if (orgRazao) orgRazao.required = false
    const orgMarca = orgCol.fields.getByName('marca_captura_id')
    if (orgMarca) orgMarca.required = false
    app.save(orgCol)

    // 3. PESSOAS:
    // Tornar nome_completo e marca_captura_id opcionais (required = false)
    const pesCol = app.findCollectionByNameOrId('pessoas')
    const pesNome = pesCol.fields.getByName('nome_completo')
    if (pesNome) pesNome.required = false
    const pesMarca = pesCol.fields.getByName('marca_captura_id')
    if (pesMarca) pesMarca.required = false
    app.save(pesCol)

    // 4. LEADS:
    // Tornar campos required opcionais (origem, dados_contato, status_qualificacao, marca_id)
    const leadCol = app.findCollectionByNameOrId('leads')
    const leadOrigem = leadCol.fields.getByName('origem')
    if (leadOrigem) leadOrigem.required = false
    const leadDados = leadCol.fields.getByName('dados_contato')
    if (leadDados) leadDados.required = false
    const leadStatus = leadCol.fields.getByName('status_qualificacao')
    if (leadStatus) leadStatus.required = false
    const leadMarca = leadCol.fields.getByName('marca_id')
    if (leadMarca) leadMarca.required = false
    app.save(leadCol)

    // 5. ATIVIDADES:
    // Tornar data_vencimento, tipo, responsavel_id, marca_id opcionais
    const ativCol = app.findCollectionByNameOrId('atividades')
    const ativVenc = ativCol.fields.getByName('data_vencimento')
    if (ativVenc) ativVenc.required = false
    const ativTipo = ativCol.fields.getByName('tipo')
    if (ativTipo) ativTipo.required = false
    const ativResp = ativCol.fields.getByName('responsavel_id')
    if (ativResp) ativResp.required = false
    const ativMarca = ativCol.fields.getByName('marca_id')
    if (ativMarca) ativMarca.required = false
    app.save(ativCol)
  },
  (app) => {
    // Reversão
    try {
      const oppCol = app.findCollectionByNameOrId('oportunidades')
      if (oppCol.fields.getByName('origem')) oppCol.fields.removeByName('origem')
      if (oppCol.fields.getByName('id_canal_origem')) oppCol.fields.removeByName('id_canal_origem')
      if (oppCol.fields.getByName('observacoes')) oppCol.fields.removeByName('observacoes')
      if (oppCol.fields.getByName('status')) oppCol.fields.removeByName('status')
      app.save(oppCol)
    } catch (_) {}
  },
)
