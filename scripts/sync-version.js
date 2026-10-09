/**
 * Script de sincronização automática e trava de integridade da versão do app Nexo NTC.
 * Fonte única de verdade: package.json
 *
 * Sincroniza e valida:
 * 1. public/version.json (gerado automaticamente com version do package.json + timestamp)
 * 2. index.html (garante consistência da tag meta name="app-version")
 * 3. pocketbase/hooks/versao_app.js (garante que a rota /backend/v1/versao sirva a versão canônica)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const pkgPath = path.join(rootDir, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const targetVersion = pkg.version

if (!targetVersion) {
  console.error('ERRO: package.json não possui campo "version" definido.')
  process.exit(1)
}

const buildTime = new Date().toISOString()
const buildTimestamp = Date.now()

console.log(`[Version Sync] Fonte única de verdade: package.json -> v${targetVersion}`)

// 1. Gerar/sincronizar public/version.json
const publicDir = path.join(rootDir, 'public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}
const versionJsonPath = path.join(publicDir, 'version.json')
const versionData = {
  version: targetVersion,
  buildTime,
  buildTimestamp,
}
fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n', 'utf8')
console.log(`[Version Sync] public/version.json atualizado com v${targetVersion}`)

// 2. Sincronizar meta app-version em index.html
const indexHtmlPath = path.join(rootDir, 'index.html')
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8')
  const metaRegex = /(<meta[^>]*name=["']app-version["'][^>]*content=["'])([^"']+)(["'][^>]*>)/i
  if (metaRegex.test(html)) {
    html = html.replace(metaRegex, `$1${targetVersion}$3`)
  } else {
    // Insere caso não exista
    html = html.replace(
      '</head>',
      `    <meta name="app-version" content="${targetVersion}" />\n  </head>`,
    )
  }
  const buildTimeRegex = /(<meta[^>]*name=["']build-time["'][^>]*content=["'])([^"']+)(["'][^>]*>)/i
  if (buildTimeRegex.test(html)) {
    html = html.replace(buildTimeRegex, `$1${buildTime}$3`)
  }
  fs.writeFileSync(indexHtmlPath, html, 'utf8')
  console.log(`[Version Sync] index.html atualizado com v${targetVersion}`)
}

// 3. Sincronizar pocketbase/hooks/versao_app.js
const hookPath = path.join(rootDir, 'pocketbase', 'hooks', 'versao_app.js')
if (fs.existsSync(hookPath)) {
  let hookContent = fs.readFileSync(hookPath, 'utf8')
  const hookVersionRegex = /(const\s+currentVersion\s*=\s*['"])([^'"]+)(['"])/
  if (hookVersionRegex.test(hookContent)) {
    hookContent = hookContent.replace(hookVersionRegex, `$1${targetVersion}$3`)
    fs.writeFileSync(hookPath, hookContent, 'utf8')
    console.log(`[Version Sync] pocketbase/hooks/versao_app.js sincronizado com v${targetVersion}`)
  }
}

// 4. Sincronizar CURRENT_BUILD_TIMESTAMP em src/lib/appVersion.ts
const appVersionTsPath = path.join(rootDir, 'src', 'lib', 'appVersion.ts')
if (fs.existsSync(appVersionTsPath)) {
  let tsContent = fs.readFileSync(appVersionTsPath, 'utf8')
  const tsRegex = /(export\s+const\s+CURRENT_BUILD_TIMESTAMP\s*=\s*)(\d+)/
  if (tsRegex.test(tsContent)) {
    tsContent = tsContent.replace(tsRegex, `$1${buildTimestamp}`)
    fs.writeFileSync(appVersionTsPath, tsContent, 'utf8')
    console.log(`[Version Sync] src/lib/appVersion.ts sincronizado com timestamp ${buildTimestamp}`)
  }
}
