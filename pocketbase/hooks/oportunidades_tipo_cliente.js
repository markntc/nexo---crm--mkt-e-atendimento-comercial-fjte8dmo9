// pocketbase/hooks/oportunidades_tipo_cliente.js
// Classificação automática "Cliente novo" vs "Recompra" na criação de oportunidades
onRecordCreate((e) => {
  const opp = e.record
  // Se já veio definido (ex: preenchido pelo frontend), valida se deve manter ou calcular
  let clienteB2bId = opp.get('cliente_b2b_id')
  let clienteB2cId = opp.get('cliente_b2c_id')

  // Se não tem nem b2b nem b2c, default é "Cliente novo"
  if (!clienteB2bId && !clienteB2cId) {
    if (!opp.get('tipo_cliente')) {
      opp.set('tipo_cliente', 'Cliente novo')
    }
    e.next()
    return
  }

  try {
    const filters = []
    if (clienteB2bId) filters.push(`cliente_b2b_id = "${clienteB2bId}"`)
    if (clienteB2cId) filters.push(`cliente_b2c_id = "${clienteB2cId}"`)

    const queryFilter = `(${filters.join(' || ')}) && id != "${opp.id || ''}"`
    const records = $app.findRecordsByFilter('oportunidades', queryFilter, '-created', 100)

    // Busca funis para checar quais etapas são consideradas "is_won"
    const funis = $app.findRecordsByFilter('funis', 'ativo = true', '-created', 50)
    const wonStagesSet = new Set([
      'ganho',
      'fechado',
      'pedido efetivado',
      'venda ganha',
      'concluído',
      'faturado',
    ])

    for (let f of funis) {
      let etapas = f.get('etapas_ordenadas')
      if (Array.isArray(etapas)) {
        for (let et of etapas) {
          if (et && (et.is_won === true || et.status === 'won')) {
            if (et.nome) wonStagesSet.add(String(et.nome).toLowerCase().trim())
          }
        }
      }
    }

    let hasWonDeal = false
    for (let r of records) {
      const etapa = String(r.get('etapa_atual') || '')
        .toLowerCase()
        .trim()
      const status = String(r.get('status') || '')
        .toLowerCase()
        .trim()
      if (status === 'ganho' || wonStagesSet.has(etapa)) {
        hasWonDeal = true
        break
      }
    }

    opp.set('tipo_cliente', hasWonDeal ? 'Recompra' : 'Cliente novo')
  } catch (err) {
    console.warn('[oportunidades_tipo_cliente] Erro ao verificar recompra:', err)
    if (!opp.get('tipo_cliente')) {
      opp.set('tipo_cliente', 'Cliente novo')
    }
  }

  e.next()
}, 'oportunidades')
