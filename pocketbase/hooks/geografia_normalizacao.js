// pocketbase/hooks/geografia_normalizacao.js
// Normalização no servidor dos campos geográficos de:
// oportunidades, leads, pessoas, organizacoes
// Trim, capitalização Title Case canônica de cidade, sigla canônica de UF (uppercase), país canônico ("Brasil").
// Nota: Toda a lógica está estritamente inline dentro de cada handler para cumprir a regra de isolamento de VM do PocketBase.

onRecordCreateRequest(
  (e) => {
    const rec = e.record
    const UFS_MAP = {
      ACRE: 'AC',
      AC: 'AC',
      ALAGOAS: 'AL',
      AL: 'AL',
      AMAPA: 'AP',
      AMAPÁ: 'AP',
      AP: 'AP',
      AMAZONAS: 'AM',
      AM: 'AM',
      BAHIA: 'BA',
      BA: 'BA',
      CEARA: 'CE',
      CEARÁ: 'CE',
      CE: 'CE',
      'DISTRITO FEDERAL': 'DF',
      DF: 'DF',
      'ESPIRITO SANTO': 'ES',
      'ESPÍRITO SANTO': 'ES',
      ES: 'ES',
      GOIAS: 'GO',
      GOIÁS: 'GO',
      GO: 'GO',
      MARANHAO: 'MA',
      MARANHÃO: 'MA',
      MA: 'MA',
      'MATO GROSSO': 'MT',
      MT: 'MT',
      'MATO GROSSO DO SUL': 'MS',
      MS: 'MS',
      'MINAS GERAIS': 'MG',
      MG: 'MG',
      PARA: 'PA',
      PARÁ: 'PA',
      PA: 'PA',
      PARAIBA: 'PB',
      PARAÍBA: 'PB',
      PB: 'PB',
      PARANA: 'PR',
      PARANÁ: 'PR',
      PR: 'PR',
      PERNAMBUCO: 'PE',
      PE: 'PE',
      PIAUI: 'PI',
      PIAUÍ: 'PI',
      PI: 'PI',
      'RIO DE JANEIRO': 'RJ',
      RJ: 'RJ',
      'RIO GRANDE DO NORTE': 'RN',
      RN: 'RN',
      'RIO GRANDE DO SUL': 'RS',
      RS: 'RS',
      RONDONIA: 'RO',
      RONDÔNIA: 'RO',
      RO: 'RO',
      RORAIMA: 'RR',
      RR: 'RR',
      'SANTA CATARINA': 'SC',
      SC: 'SC',
      'SAO PAULO': 'SP',
      'SÃO PAULO': 'SP',
      SP: 'SP',
      SERGIPE: 'SE',
      SE: 'SE',
      TOCANTINS: 'TO',
      TO: 'TO',
    }

    const toTitle = (str) => {
      if (!str) return ''
      const preposicoes = ['de', 'da', 'do', 'dos', 'das', 'e', 'em']
      return str
        .trim()
        .split(/\s+/)
        .map((word, idx) => {
          const lower = word.toLowerCase()
          if (idx > 0 && preposicoes.indexOf(lower) !== -1) {
            return lower
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join(' ')
    }

    const normUf = (rawUf) => {
      if (!rawUf) return ''
      const clean = rawUf.trim().toUpperCase()
      if (UFS_MAP[clean]) return UFS_MAP[clean]
      const semAcento = clean
        .replace(/[ÁÀÃÂ]/g, 'A')
        .replace(/[ÉÈÊ]/g, 'E')
        .replace(/[ÍÌ]/g, 'I')
        .replace(/[ÓÒÕÔ]/g, 'O')
        .replace(/[ÚÙ]/g, 'U')
        .replace(/Ç/g, 'C')
      if (UFS_MAP[semAcento]) return UFS_MAP[semAcento]
      return clean.slice(0, 2)
    }

    const normPais = (rawPais) => {
      if (!rawPais || !rawPais.trim()) return 'Brasil'
      const trimmed = rawPais.trim()
      const lower = trimmed.toLowerCase()
      if (lower === 'brasil' || lower === 'brazil' || lower === 'br') return 'Brasil'
      return toTitle(trimmed)
    }

    try {
      const rawCidade = rec.getString('cidade')
      if (rawCidade) rec.set('cidade', toTitle(rawCidade))
    } catch (_) {}

    try {
      const rawEstado = rec.getString('estado')
      if (rawEstado) rec.set('estado', normUf(rawEstado))
    } catch (_) {}

    try {
      const rawPais = rec.getString('pais')
      rec.set('pais', normPais(rawPais))
    } catch (_) {}

    try {
      const rawCidEnt = rec.getString('cidade_entrega')
      if (rawCidEnt) rec.set('cidade_entrega', toTitle(rawCidEnt))
    } catch (_) {}

    try {
      const rawEstEnt = rec.getString('estado_entrega')
      if (rawEstEnt) rec.set('estado_entrega', normUf(rawEstEnt))
    } catch (_) {}

    try {
      const rawPaisEnt = rec.getString('pais_entrega')
      if (rawPaisEnt) rec.set('pais_entrega', normPais(rawPaisEnt))
    } catch (_) {}

    return e.next()
  },
  'oportunidades',
  'leads',
  'pessoas',
  'organizacoes',
)

onRecordUpdateRequest(
  (e) => {
    const rec = e.record
    const UFS_MAP = {
      ACRE: 'AC',
      AC: 'AC',
      ALAGOAS: 'AL',
      AL: 'AL',
      AMAPA: 'AP',
      AMAPÁ: 'AP',
      AP: 'AP',
      AMAZONAS: 'AM',
      AM: 'AM',
      BAHIA: 'BA',
      BA: 'BA',
      CEARA: 'CE',
      CEARÁ: 'CE',
      CE: 'CE',
      'DISTRITO FEDERAL': 'DF',
      DF: 'DF',
      'ESPIRITO SANTO': 'ES',
      'ESPÍRITO SANTO': 'ES',
      ES: 'ES',
      GOIAS: 'GO',
      GOIÁS: 'GO',
      GO: 'GO',
      MARANHAO: 'MA',
      MARANHÃO: 'MA',
      MA: 'MA',
      'MATO GROSSO': 'MT',
      MT: 'MT',
      'MATO GROSSO DO SUL': 'MS',
      MS: 'MS',
      'MINAS GERAIS': 'MG',
      MG: 'MG',
      PARA: 'PA',
      PARÁ: 'PA',
      PA: 'PA',
      PARAIBA: 'PB',
      PARAÍBA: 'PB',
      PB: 'PB',
      PARANA: 'PR',
      PARANÁ: 'PR',
      PR: 'PR',
      PERNAMBUCO: 'PE',
      PE: 'PE',
      PIAUI: 'PI',
      PIAUÍ: 'PI',
      PI: 'PI',
      'RIO DE JANEIRO': 'RJ',
      RJ: 'RJ',
      'RIO GRANDE DO NORTE': 'RN',
      RN: 'RN',
      'RIO GRANDE DO SUL': 'RS',
      RS: 'RS',
      RONDONIA: 'RO',
      RONDÔNIA: 'RO',
      RO: 'RO',
      RORAIMA: 'RR',
      RR: 'RR',
      'SANTA CATARINA': 'SC',
      SC: 'SC',
      'SAO PAULO': 'SP',
      'SÃO PAULO': 'SP',
      SP: 'SP',
      SERGIPE: 'SE',
      SE: 'SE',
      TOCANTINS: 'TO',
      TO: 'TO',
    }

    const toTitle = (str) => {
      if (!str) return ''
      const preposicoes = ['de', 'da', 'do', 'dos', 'das', 'e', 'em']
      return str
        .trim()
        .split(/\s+/)
        .map((word, idx) => {
          const lower = word.toLowerCase()
          if (idx > 0 && preposicoes.indexOf(lower) !== -1) {
            return lower
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join(' ')
    }

    const normUf = (rawUf) => {
      if (!rawUf) return ''
      const clean = rawUf.trim().toUpperCase()
      if (UFS_MAP[clean]) return UFS_MAP[clean]
      const semAcento = clean
        .replace(/[ÁÀÃÂ]/g, 'A')
        .replace(/[ÉÈÊ]/g, 'E')
        .replace(/[ÍÌ]/g, 'I')
        .replace(/[ÓÒÕÔ]/g, 'O')
        .replace(/[ÚÙ]/g, 'U')
        .replace(/Ç/g, 'C')
      if (UFS_MAP[semAcento]) return UFS_MAP[semAcento]
      return clean.slice(0, 2)
    }

    const normPais = (rawPais) => {
      if (!rawPais || !rawPais.trim()) return 'Brasil'
      const trimmed = rawPais.trim()
      const lower = trimmed.toLowerCase()
      if (lower === 'brasil' || lower === 'brazil' || lower === 'br') return 'Brasil'
      return toTitle(trimmed)
    }

    try {
      const rawCidade = rec.getString('cidade')
      if (rawCidade) rec.set('cidade', toTitle(rawCidade))
    } catch (_) {}

    try {
      const rawEstado = rec.getString('estado')
      if (rawEstado) rec.set('estado', normUf(rawEstado))
    } catch (_) {}

    try {
      const rawPais = rec.getString('pais')
      rec.set('pais', normPais(rawPais))
    } catch (_) {}

    try {
      const rawCidEnt = rec.getString('cidade_entrega')
      if (rawCidEnt) rec.set('cidade_entrega', toTitle(rawCidEnt))
    } catch (_) {}

    try {
      const rawEstEnt = rec.getString('estado_entrega')
      if (rawEstEnt) rec.set('estado_entrega', normUf(rawEstEnt))
    } catch (_) {}

    try {
      const rawPaisEnt = rec.getString('pais_entrega')
      if (rawPaisEnt) rec.set('pais_entrega', normPais(rawPaisEnt))
    } catch (_) {}

    return e.next()
  },
  'oportunidades',
  'leads',
  'pessoas',
  'organizacoes',
)
