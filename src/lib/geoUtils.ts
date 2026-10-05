// src/lib/geoUtils.ts
// Utilitários de geolocalização e extração de endereço para CRM NTC

import {
  MUNICIPIOS_IBGE,
  normalizarTexto,
  encontrarMunicipio,
  buscarMunicipios,
} from '../data/ibgeMunicipios'

export const ESTADOS_BRASIL = [
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
] as const

export type UF = (typeof ESTADOS_BRASIL)[number]

export interface Localidade {
  cidade: string
  estado: string
  pais: string
}

export const ESTADOS_NOMES: Record<UF, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
}

/**
 * Converte qualquer texto de estado/UF (nome extenso ou sigla) para a sigla canônica de 2 letras.
 */
export function normalizarUf(rawUf?: string | null): UF | '' {
  if (!rawUf) return ''
  const trimmed = rawUf.trim().toUpperCase()
  if (ESTADOS_BRASIL.includes(trimmed as UF)) return trimmed as UF

  const norm = normalizarTexto(rawUf)
  for (const [sigla, nome] of Object.entries(ESTADOS_NOMES)) {
    if (normalizarTexto(nome) === norm) {
      return sigla as UF
    }
  }

  return ''
}

/**
 * Converte string para Title Case canônico preservando preposições da língua portuguesa.
 */
export function toTitleCase(str: string): string {
  if (!str) return ''
  const preposicoes = ['de', 'da', 'do', 'dos', 'das', 'e', 'em', "d'"]
  return str
    .trim()
    .split(/\s+/)
    .map((word, idx) => {
      const lower = word.toLowerCase()
      if (idx > 0 && preposicoes.includes(lower)) {
        return lower
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Extrai cidade e estado de uma string de endereço ou texto livre brasileiro.
 * Casando contra a base de municípios IBGE sempre que possível.
 * Exemplos:
 * "Av. Beira Mar, 1200, Angra dos Reis - RJ" -> { cidade: "Angra dos Reis", estado: "RJ", pais: "Brasil" }
 * "Canabrava do Norte MT" -> { cidade: "Canabrava do Norte", estado: "MT", pais: "Brasil" }
 * "São Paulo / SP" -> { cidade: "São Paulo", estado: "SP", pais: "Brasil" }
 * "Chapecó - SC" -> { cidade: "Chapecó", estado: "SC", pais: "Brasil" }
 * "Belo Horizonte, MG" -> { cidade: "Belo Horizonte", estado: "MG", pais: "Brasil" }
 */
export function extrairCidadeEstado(texto?: string | null): Localidade {
  if (!texto || !texto.trim()) {
    return { cidade: '', estado: '', pais: 'Brasil' }
  }

  const str = texto.trim()

  // 1. Tenta padrão com hífen, barra ou vírgula seguido de UF: "Angra dos Reis - RJ" ou "São Paulo/SP"
  const regexHifenUF = /[-–—/,]\s*([A-Za-z]{2})\s*$/i
  const matchHifen = str.match(regexHifenUF)
  if (matchHifen) {
    const possivelUf = matchHifen[1].toUpperCase()
    if (ESTADOS_BRASIL.includes(possivelUf as UF)) {
      const antes = str.slice(0, matchHifen.index).trim()
      const partes = antes.split(/,\s*/)
      const cidadeCandidata = partes[partes.length - 1].trim()
      const matchIbge = encontrarMunicipio(cidadeCandidata, possivelUf)
      return {
        cidade: matchIbge ? matchIbge.nome : toTitleCase(cidadeCandidata),
        estado: possivelUf,
        pais: 'Brasil',
      }
    }
  }

  // 2. Tenta padrão final com espaço + UF: "Canabrava do Norte MT"
  const regexEspacoUF = /\s+([A-Za-z]{2})$/i
  const matchEspaco = str.match(regexEspacoUF)
  if (matchEspaco) {
    const possivelUf = matchEspaco[1].toUpperCase()
    if (ESTADOS_BRASIL.includes(possivelUf as UF)) {
      const antes = str.slice(0, matchEspaco.index).trim()
      const partes = antes.split(/,\s*/)
      const cidadeCandidata = partes[partes.length - 1].trim()
      const matchIbge = encontrarMunicipio(cidadeCandidata, possivelUf)
      return {
        cidade: matchIbge ? matchIbge.nome : toTitleCase(cidadeCandidata),
        estado: possivelUf,
        pais: 'Brasil',
      }
    }
  }

  // 3. Tenta encontrar município da base pelo texto digitado
  const matchDireto = encontrarMunicipio(str)
  if (matchDireto) {
    return {
      cidade: matchDireto.nome,
      estado: matchDireto.uf,
      pais: 'Brasil',
    }
  }

  const candidatos = buscarMunicipios(str, undefined, 5)
  if (candidatos.length > 0) {
    const exato = candidatos.find((c) => normalizarTexto(c.nome) === normalizarTexto(str))
    if (exato) {
      return {
        cidade: exato.nome,
        estado: exato.uf,
        pais: 'Brasil',
      }
    }
  }

  // 4. Fallback: não conseguiu determinar UF formalmente
  return { cidade: toTitleCase(str), estado: '', pais: 'Brasil' }
}

/**
 * Valida se uma string aparenta ser um município formal
 */
export function isCidadeValida(cidade: string, estado: string): boolean {
  if (!cidade || !cidade.trim()) return false
  const lower = cidade.toLowerCase().trim()
  const genericos = ['represa', 'marina', 'lago', 'rio', 'mar', 'porto', 'praia', 'ilha']
  if (genericos.includes(lower)) return false
  return Boolean(estado && estado.length === 2)
}
