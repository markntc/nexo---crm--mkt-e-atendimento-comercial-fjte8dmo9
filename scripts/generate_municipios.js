// scripts/generate_municipios.js
// Script para baixar da API oficial do IBGE e gerar a base compacta dos 5.570 municípios brasileiros por UF.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/ibgeMunicipiosCompact.ts')

async function main() {
  console.log('Fetching municipios from IBGE API...')
  const res = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado',
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch IBGE: ${res.status} ${res.statusText}`)
  }

  const list = await res.json()
  console.log(`Received ${list.length} municipios from IBGE.`)

  // Agrupar por UF (sigla)
  const porUf = {}

  for (const item of list) {
    const uf = item['UF-sigla'] || item.microrregiao?.mesorregiao?.UF?.sigla
    const nome = (item['municipio-nome'] || item.nome || '').trim()
    if (!uf || !nome) continue

    if (!porUf[uf]) {
      porUf[uf] = []
    }
    porUf[uf].push(nome)
  }

  // Ordenar UFs e cidades dentro de cada UF alfabeticamente
  const ufsOrdenadas = Object.keys(porUf).sort()
  const dataset = {}
  let totalCidades = 0

  for (const uf of ufsOrdenadas) {
    // Remover duplicatas e ordenar
    const cidades = Array.from(new Set(porUf[uf])).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    dataset[uf] = cidades.join('|')
    totalCidades += cidades.length
  }

  console.log(`Total UFs: ${ufsOrdenadas.length}, Total Cidades: ${totalCidades}`)

  const tsContent = `// src/data/ibgeMunicipiosCompact.ts
// Base canônica compacta com TODOS os ${totalCidades} municípios do Brasil (IBGE).
// Organizada por UF como strings delimitadas por '|' para reduzir o bundle e compressão máxima gzip (~25-30 KB).

export const MUNICIPIOS_POR_UF_PIPE: Record<string, string> = ${JSON.stringify(dataset, null, 2)}
`

  fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf-8')
  console.log(`Successfully written to ${OUTPUT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
