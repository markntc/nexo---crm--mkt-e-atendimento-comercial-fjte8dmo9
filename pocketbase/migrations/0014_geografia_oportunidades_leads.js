migrate(
  (app) => {
    // 1. Atualizar collection `oportunidades` com campos de geografia (faturamento e entrega)
    const oportunidades = app.findCollectionByNameOrId('oportunidades')

    if (!oportunidades.fields.getByName('cidade')) {
      oportunidades.fields.add(
        new TextField({
          name: 'cidade',
          required: false,
        }),
      )
    }

    if (!oportunidades.fields.getByName('estado')) {
      oportunidades.fields.add(
        new TextField({
          name: 'estado',
          required: false,
        }),
      )
    }

    if (!oportunidades.fields.getByName('pais')) {
      oportunidades.fields.add(
        new TextField({
          name: 'pais',
          required: false,
        }),
      )
    }

    if (!oportunidades.fields.getByName('cidade_entrega')) {
      oportunidades.fields.add(
        new TextField({
          name: 'cidade_entrega',
          required: false,
        }),
      )
    }

    if (!oportunidades.fields.getByName('estado_entrega')) {
      oportunidades.fields.add(
        new TextField({
          name: 'estado_entrega',
          required: false,
        }),
      )
    }

    app.save(oportunidades)

    // 2. Atualizar collection `leads` com campos de localidade
    const leads = app.findCollectionByNameOrId('leads')

    if (!leads.fields.getByName('cidade')) {
      leads.fields.add(
        new TextField({
          name: 'cidade',
          required: false,
        }),
      )
    }

    if (!leads.fields.getByName('estado')) {
      leads.fields.add(
        new TextField({
          name: 'estado',
          required: false,
        }),
      )
    }

    if (!leads.fields.getByName('pais')) {
      leads.fields.add(
        new TextField({
          name: 'pais',
          required: false,
        }),
      )
    }

    app.save(leads)
  },
  (app) => {
    try {
      const oportunidades = app.findCollectionByNameOrId('oportunidades')
      if (oportunidades.fields.getByName('cidade')) oportunidades.fields.removeByName('cidade')
      if (oportunidades.fields.getByName('estado')) oportunidades.fields.removeByName('estado')
      if (oportunidades.fields.getByName('pais')) oportunidades.fields.removeByName('pais')
      if (oportunidades.fields.getByName('cidade_entrega'))
        oportunidades.fields.removeByName('cidade_entrega')
      if (oportunidades.fields.getByName('estado_entrega'))
        oportunidades.fields.removeByName('estado_entrega')
      app.save(oportunidades)
    } catch (_) {}

    try {
      const leads = app.findCollectionByNameOrId('leads')
      if (leads.fields.getByName('cidade')) leads.fields.removeByName('cidade')
      if (leads.fields.getByName('estado')) leads.fields.removeByName('estado')
      if (leads.fields.getByName('pais')) leads.fields.removeByName('pais')
      app.save(leads)
    } catch (_) {}
  },
)
