/**
 * Script de bump de versão do app Nexo NTC.
 *
 * ORDEM DE VERSIONAMENTO DEFINIDA:
 * 1. BUMP NO FLUXO DE COMMIT / RELEASE:
 *    Executa este script explicitamente (`npm run version:bump` ou `npm run version:bump minor|major|patch`)
 *    antes ou durante o commit. Ele incrementa o package.json e dispara a sincronização dos artefatos.
 * 2. BUILD APENAS LÊ E SINCRONIZA:
 *    O comando de build (via `prebuild` / `node scripts/sync-version.js`) apenas LÊ o package.json atual
 *    e sincroniza public/version.json, pocketbase/hooks/versao_app.js e index.html, SEM NUNCA BUMPAR.
 *    Dessa forma, builder, preview publicado e hook backend ficam exatamente com o mesmo número commitado.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const pkgPath = path.join(rootDir, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const currentVersion = pkg.version || '0.0.1'

// Tipo de bump passado via argumento de linha de comando: patch (padrão), minor ou major
const bumpType = (process.argv[2] || 'patch').toLowerCase()

const semverRegex = /^(\d+)\.(\d+)\.(\d+)(.*)$/
const match = currentVersion.match(semverRegex)

if (!match) {
  console.error(`[Version Bump] Versão atual inválida em package.json: ${currentVersion}`)
  process.exit(1)
}

let major = parseInt(match[1], 10)
let minor = parseInt(match[2], 10)
let patch = parseInt(match[3], 10)
const suffix = match[4] || ''

if (bumpType === 'major') {
  major += 1
  minor = 0
  patch = 0
} else if (bumpType === 'minor') {
  minor += 1
  patch = 0
} else {
  // Padrão: patch
  patch += 1
}

const newVersion = `${major}.${minor}.${patch}${suffix}`

// Atualiza package.json
pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
console.log(`[Version Bump] package.json atualizado: ${currentVersion} -> ${newVersion}`)

// Sincroniza artefatos com a nova versão
const syncScriptPath = path.join(rootDir, 'scripts', 'sync-version.js')
execFileSync('node', [syncScriptPath], { stdio: 'inherit' })

console.log(`[Version Bump] Versão ${newVersion} gravada e sincronizada com sucesso!`)
