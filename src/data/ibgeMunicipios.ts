// src/data/ibgeMunicipios.ts
// Base de municípios brasileiros organizada por UF.
// Contém os mais de 5.500 municípios do Brasil (IBGE), indexados por UF e normalizados.

export interface MunicipioIBGE {
  nome: string
  uf: string
}

// Cidades mais frequentes ou polos regionais por UF, além de municípios-chave
// Para permitir busca instantânea no bundle sem latência.
import { BASE_MUNICIPIOS_DATA } from './municipiosBase'

export const MUNICIPIOS_IBGE: MunicipioIBGE[] = BASE_MUNICIPIOS_DATA

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Busca municípios por query (case/acento-insensitivo).
 * Prioriza:
 * 1. Cidades que começam com a query
 * 2. Cidades que contêm a query
 * Pode opcionalmente filtrar por UF.
 */
export function buscarMunicipios(query: string, ufFiltro?: string, limite = 30): MunicipioIBGE[] {
  if (!query || query.trim().length === 0) {
    if (ufFiltro) {
      return MUNICIPIOS_IBGE.filter((m) => m.uf === ufFiltro).slice(0, limite)
    }
    return []
  }

  const qNorm = normalizarTexto(query)
  const ufNorm = ufFiltro?.toUpperCase()

  const startsWithList: MunicipioIBGE[] = []
  const containsList: MunicipioIBGE[] = []

  for (const m of MUNICIPIOS_IBGE) {
    if (ufNorm && m.uf !== ufNorm) continue

    const nomeNorm = normalizarTexto(m.nome)
    if (nomeNorm.startsWith(qNorm)) {
      startsWithList.push(m)
      if (startsWithList.length >= limite) break
    } else if (nomeNorm.includes(qNorm)) {
      containsList.push(m)
    }
  }

  const resultado = [...startsWithList, ...containsList].slice(0, limite)
  return resultado
}

/**
 * Encontra município exato (case/acento-insensitivo) por nome e opcionalmente UF.
 */
export function encontrarMunicipio(nome: string, uf?: string): MunicipioIBGE | undefined {
  if (!nome) return undefined
  const qNorm = normalizarTexto(nome)
  const ufNorm = uf?.toUpperCase()

  return MUNICIPIOS_IBGE.find((m) => {
    if (ufNorm && m.uf !== ufNorm) return false
    return normalizarTexto(m.nome) === qNorm
  })
}
