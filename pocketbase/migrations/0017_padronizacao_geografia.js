migrate(
  (app) => {
    // 1. Atualizar collection `organizacoes` com campos de cidade, estado, pais
    const organizacoes = app.findCollectionByNameOrId('organizacoes')

    if (!organizacoes.fields.getByName('cidade')) {
      organizacoes.fields.add(
        new TextField({
          name: 'cidade',
          required: false,
        }),
      )
    }

    if (!organizacoes.fields.getByName('estado')) {
      organizacoes.fields.add(
        new TextField({
          name: 'estado',
          required: false,
        }),
      )
    }

    if (!organizacoes.fields.getByName('pais')) {
      organizacoes.fields.add(
        new TextField({
          name: 'pais',
          required: false,
        }),
      )
    }

    app.save(organizacoes)

    // 2. Atualizar collection `pessoas` com campos de cidade, estado, pais
    const pessoas = app.findCollectionByNameOrId('pessoas')

    if (!pessoas.fields.getByName('cidade')) {
      pessoas.fields.add(
        new TextField({
          name: 'cidade',
          required: false,
        }),
      )
    }

    if (!pessoas.fields.getByName('estado')) {
      pessoas.fields.add(
        new TextField({
          name: 'estado',
          required: false,
        }),
      )
    }

    if (!pessoas.fields.getByName('pais')) {
      pessoas.fields.add(
        new TextField({
          name: 'pais',
          required: false,
        }),
      )
    }

    app.save(pessoas)

    // 3. Atualizar collection `oportunidades` com pais_entrega (caso ainda não exista)
    const oportunidades = app.findCollectionByNameOrId('oportunidades')
    if (!oportunidades.fields.getByName('pais_entrega')) {
      oportunidades.fields.add(
        new TextField({
          name: 'pais_entrega',
          required: false,
        }),
      )
      app.save(oportunidades)
    }

    // 4. Backfill leve em organizacoes: extrair cidade/estado de endereco_corporativo
    const UFS_VALIDAS = [
      'AC',
      'AL',
      'AP',
      'AM',
      'BA',
      'CE',
      'DF',
      'ES',
      'GO',
      'MA',
      'MT',
      'MS',
      'MG',
      'PA',
      'PB',
      'PR',
      'PE',
      'PI',
      'RJ',
      'RN',
      'RS',
      'RO',
      'RR',
      'SC',
      'SP',
      'SE',
      'TO',
    ]

    try {
      const orgs = app.findRecordsByFilter('organizacoes', '1=1', '', 500, 0)
      for (let i = 0; i < orgs.length; i++) {
        const org = orgs[i]
        let cid = org.getString('cidade')
        let est = org.getString('estado')
        let p = org.getString('pais')
        const endCorp = org.getString('endereco_corporativo')

        let modified = false

        if (!p) {
          org.set('pais', 'Brasil')
          modified = true
        }

        if ((!cid || !est) && endCorp) {
          const match = endCorp.match(/[-–—/,]\s*([A-Za-z]{2})\s*$/)
          if (match && UFS_VALIDAS.indexOf(match[1].toUpperCase()) !== -1) {
            const sigla = match[1].toUpperCase()
            const antes = endCorp.slice(0, match.index).trim()
            const partes = antes.split(/,\s*/)
            const extraida = partes[partes.length - 1].trim()
            if (!cid && extraida) {
              org.set('cidade', extraida)
              modified = true
            }
            if (!est) {
              org.set('estado', sigla)
              modified = true
            }
          }
        }

        if (modified) {
          app.save(org)
        }
      }
    } catch (err) {
      console.log('Erro ao executar backfill de organizacoes:', err)
    }

    // 5. Backfill leve em pessoas: default pais = Brasil se houver cidade/estado ou endereco_residencial
    try {
      const pList = app.findRecordsByFilter('pessoas', '1=1', '', 500, 0)
      for (let i = 0; i < pList.length; i++) {
        const pes = pList[i]
        let p = pes.getString('pais')
        let cid = pes.getString('cidade')
        let est = pes.getString('estado')
        const endRes = pes.getString('endereco_residencial')
        let modified = false

        if (!p) {
          pes.set('pais', 'Brasil')
          modified = true
        }

        if ((!cid || !est) && endRes) {
          const match = endRes.match(/[-–—/,]\s*([A-Za-z]{2})\s*$/)
          if (match && UFS_VALIDAS.indexOf(match[1].toUpperCase()) !== -1) {
            const sigla = match[1].toUpperCase()
            const antes = endRes.slice(0, match.index).trim()
            const partes = antes.split(/,\s*/)
            const extraida = partes[partes.length - 1].trim()
            if (!cid && extraida) {
              pes.set('cidade', extraida)
              modified = true
            }
            if (!est) {
              pes.set('estado', sigla)
              modified = true
            }
          }
        }

        if (modified) {
          app.save(pes)
        }
      }
    } catch (err) {
      console.log('Erro ao executar backfill de pessoas:', err)
    }

    // 6. Backfill leve em oportunidades: preencher pais e pais_entrega padrão Brasil
    try {
      const oppList = app.findRecordsByFilter('oportunidades', '1=1', '', 500, 0)
      for (let i = 0; i < oppList.length; i++) {
        const opp = oppList[i]
        let p = opp.getString('pais')
        let pe = opp.getString('pais_entrega')
        let est = opp.getString('estado')
        let estE = opp.getString('estado_entrega')
        let modified = false

        if (!p) {
          opp.set('pais', 'Brasil')
          modified = true
        }
        if (!pe) {
          opp.set('pais_entrega', 'Brasil')
          modified = true
        }
        if (est && UFS_VALIDAS.indexOf(est.toUpperCase()) !== -1 && est !== est.toUpperCase()) {
          opp.set('estado', est.toUpperCase())
          modified = true
        }
        if (estE && UFS_VALIDAS.indexOf(estE.toUpperCase()) !== -1 && estE !== estE.toUpperCase()) {
          opp.set('estado_entrega', estE.toUpperCase())
          modified = true
        }

        if (modified) {
          app.save(opp)
        }
      }
    } catch (err) {
      console.log('Erro ao executar backfill de oportunidades:', err)
    }

    // 7. Backfill leve em leads: preencher pais padrão Brasil
    try {
      const lList = app.findRecordsByFilter('leads', '1=1', '', 500, 0)
      for (let i = 0; i < lList.length; i++) {
        const lead = lList[i]
        let p = lead.getString('pais')
        let est = lead.getString('estado')
        let modified = false

        if (!p) {
          lead.set('pais', 'Brasil')
          modified = true
        }
        if (est && UFS_VALIDAS.indexOf(est.toUpperCase()) !== -1 && est !== est.toUpperCase()) {
          lead.set('estado', est.toUpperCase())
          modified = true
        }

        if (modified) {
          app.save(lead)
        }
      }
    } catch (err) {
      console.log('Erro ao executar backfill de leads:', err)
    }
  },
  (app) => {
    try {
      const organizacoes = app.findCollectionByNameOrId('organizacoes')
      if (organizacoes.fields.getByName('cidade')) organizacoes.fields.removeByName('cidade')
      if (organizacoes.fields.getByName('estado')) organizacoes.fields.removeByName('estado')
      if (organizacoes.fields.getByName('pais')) organizacoes.fields.removeByName('pais')
      app.save(organizacoes)
    } catch (_) {}

    try {
      const pessoas = app.findCollectionByNameOrId('pessoas')
      if (pessoas.fields.getByName('cidade')) pessoas.fields.removeByName('cidade')
      if (pessoas.fields.getByName('estado')) pessoas.fields.removeByName('estado')
      if (pessoas.fields.getByName('pais')) pessoas.fields.removeByName('pais')
      app.save(pessoas)
    } catch (_) {}

    try {
      const oportunidades = app.findCollectionByNameOrId('oportunidades')
      if (oportunidades.fields.getByName('pais_entrega'))
        oportunidades.fields.removeByName('pais_entrega')
      app.save(oportunidades)
    } catch (_) {}
  },
)
