// src/data/ibgePaises.ts
// Países canônicos para CRM NTC: Brasil pré-selecionado, países limítrofes / Mercosul e Outro.

export interface PaisOption {
  nome: string
  sigla?: string
}

export const PAISES_CANONICOS: string[] = [
  'Brasil',
  'Argentina',
  'Bolívia',
  'Chile',
  'Colômbia',
  'Equador',
  'Guiana',
  'Paraguai',
  'Peru',
  'Suriname',
  'Uruguai',
  'Venezuela',
  'Outro',
] as const

export const PAIS_PADRAO = 'Brasil'
