// src/lib/geoUtils.ts
// Utilitários de geolocalização e extração de endereço para CRM NTC

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

/**
 * Extrai cidade e estado de uma string de endereço ou texto livre brasileiro.
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

  // 1. Tenta padrão com hífen ou barra ou vírgula seguido de UF: "Angra dos Reis - RJ" ou "São Paulo/SP"
  const regexHifenUF = /[-–—/,]\s*([A-Za-z]{2})\s*$/i
  const matchHifen = str.match(regexHifenUF)
  if (matchHifen) {
    const possivelUf = matchHifen[1].toUpperCase()
    if (ESTADOS_BRASIL.includes(possivelUf as UF)) {
      // Pega o que está antes do separador
      const antes = str.slice(0, matchHifen.index).trim()
      // Se houver vírgulas antes (ex: "Av. Beira Mar, 1200, Angra dos Reis"), a cidade é o último segmento
      const partes = antes.split(/,\s*/)
      const cidade = partes[partes.length - 1].trim()
      return { cidade, estado: possivelUf, pais: 'Brasil' }
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
      const cidade = partes[partes.length - 1].trim()
      return { cidade, estado: possivelUf, pais: 'Brasil' }
    }
  }

  // 3. Fallback: não conseguiu determinar UF formalmente
  return { cidade: str, estado: '', pais: 'Brasil' }
}

/**
 * Valida se uma string aparenta ser um município formal (não apenas "Represa", "Marina", "Lago", etc.)
 */
export function isCidadeValida(cidade: string, estado: string): boolean {
  if (!cidade || !cidade.trim()) return false
  const lower = cidade.toLowerCase().trim()
  const genericos = ['represa', 'marina', 'lago', 'rio', 'mar', 'porto', 'praia', 'ilha']
  if (genericos.includes(lower)) return false
  return Boolean(estado && estado.length === 2)
}
