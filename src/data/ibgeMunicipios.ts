// src/data/ibgeMunicipios.ts
// Base de municípios brasileiros completa do IBGE organizada por UF.
// Contém os 5.570 municípios do Brasil indexados por UF com busca de alta performance e normalização sem acentos.

import { MUNICIPIOS_POR_UF } from './ibgeCompactData'

export interface MunicipioIBGE {
  nome: string
  uf: string
}

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Lazy cache de objetos MunicipioIBGE por UF e geral para evitar alocações excessivas
let cachedAllMunicipios: MunicipioIBGE[] | null = null
const cachedByUf: Record<string, MunicipioIBGE[]> = {}

export function getMunicipiosPorUf(uf: string): MunicipioIBGE[] {
  const ufUpper = uf.toUpperCase()
  if (cachedByUf[ufUpper]) {
    return cachedByUf[ufUpper]
  }

  const pipeString = MUNICIPIOS_POR_UF[ufUpper]
  if (!pipeString) return []

  const list: MunicipioIBGE[] = pipeString.split('|').map((nome) => ({
    nome,
    uf: ufUpper,
  }))

  cachedByUf[ufUpper] = list
  return list
}

export function getAllMunicipios(): MunicipioIBGE[] {
  if (cachedAllMunicipios) {
    return cachedAllMunicipios
  }

  const list: MunicipioIBGE[] = []
  for (const uf of Object.keys(MUNICIPIOS_POR_UF)) {
    list.push(...getMunicipiosPorUf(uf))
  }

  cachedAllMunicipios = list
  return list
}

// Mantido para compatibilidade reversa com quem importar MUNICIPIOS_IBGE
export const MUNICIPIOS_IBGE: MunicipioIBGE[] = new Proxy([] as MunicipioIBGE[], {
  get(target, prop, receiver) {
    const all = getAllMunicipios()
    return Reflect.get(all, prop, receiver)
  },
})

/**
 * Busca municípios por query (case/acento-insensitivo).
 * Prioriza:
 * 1. Cidades cujo nome começa com a query
 * 2. Cidades cujo nome contém a query
 * Pode opcionalmente filtrar por UF.
 */
export function buscarMunicipios(query: string, ufFiltro?: string, limite = 50): MunicipioIBGE[] {
  const ufNorm = ufFiltro?.toUpperCase().trim()

  if (!query || query.trim().length === 0) {
    if (ufNorm && MUNICIPIOS_POR_UF[ufNorm]) {
      return getMunicipiosPorUf(ufNorm).slice(0, limite)
    }
    return []
  }

  const qNorm = normalizarTexto(query)
  const startsWithList: MunicipioIBGE[] = []
  const containsList: MunicipioIBGE[] = []

  // Se tem UF definida, busca apenas dentro daquela UF (muito mais rápido)
  if (ufNorm && MUNICIPIOS_POR_UF[ufNorm]) {
    const list = getMunicipiosPorUf(ufNorm)
    for (const m of list) {
      const nomeNorm = normalizarTexto(m.nome)
      if (nomeNorm.startsWith(qNorm)) {
        startsWithList.push(m)
        if (startsWithList.length >= limite) return startsWithList
      } else if (nomeNorm.includes(qNorm)) {
        containsList.push(m)
      }
    }
    return [...startsWithList, ...containsList].slice(0, limite)
  }

  // Busca global por todas as UFs
  for (const uf of Object.keys(MUNICIPIOS_POR_UF)) {
    const list = getMunicipiosPorUf(uf)
    for (const m of list) {
      const nomeNorm = normalizarTexto(m.nome)
      if (nomeNorm.startsWith(qNorm)) {
        startsWithList.push(m)
        if (startsWithList.length >= limite * 2) break
      } else if (nomeNorm.includes(qNorm)) {
        if (containsList.length < limite) {
          containsList.push(m)
        }
      }
    }
    if (startsWithList.length >= limite) break
  }

  return [...startsWithList, ...containsList].slice(0, limite)
}

/**
 * Encontra município exato (case/acento-insensitivo) por nome e opcionalmente UF.
 */
export function encontrarMunicipio(nome: string, uf?: string): MunicipioIBGE | undefined {
  if (!nome || !nome.trim()) return undefined
  const qNorm = normalizarTexto(nome)
  const ufNorm = uf?.toUpperCase().trim()

  if (ufNorm && MUNICIPIOS_POR_UF[ufNorm]) {
    const list = getMunicipiosPorUf(ufNorm)
    return list.find((m) => normalizarTexto(m.nome) === qNorm)
  }

  // Busca em todas as UFs
  for (const curUf of Object.keys(MUNICIPIOS_POR_UF)) {
    const list = getMunicipiosPorUf(curUf)
    const match = list.find((m) => normalizarTexto(m.nome) === qNorm)
    if (match) return match
  }

  return undefined
}
