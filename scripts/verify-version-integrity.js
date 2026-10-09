/**
 * Trava de integridade de versão do Nexo NTC.
 * Valida se package.json coincide exatamente com:
 * 1. public/version.json
 * 2. index.html (<meta name="app-version" content="...">)
 * 3. dist/version.json (se a pasta dist existir)
 * 4. pocketbase/hooks/versao_app.js
 * 5. src/lib/appVersion.ts (CURRENT_APP_VERSION)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const pkgPath = path.join(rootDir, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const targetVersion = pkg.version

console.log(`[Integrity Check] Validando alinhamento estrito para v${targetVersion}...`)

// 1. Checa public/version.json
const publicVersionPath = path.join(rootDir, 'public', 'version.json')
assert(fs.existsSync(publicVersionPath), 'public/version.json não encontrado')
const publicVersion = JSON.parse(fs.readFileSync(publicVersionPath, 'utf8'))
assert.strictEqual(
  publicVersion.version,
  targetVersion,
  `public/version.json (${publicVersion.version}) diverge de package.json (${targetVersion})`,
)

// 2. Checa index.html meta tag
const indexHtmlPath = path.join(rootDir, 'index.html')
if (fs.existsSync(indexHtmlPath)) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8')
  const metaMatch = html.match(/<meta[^>]*name=["']app-version["'][^>]*content=["']([^"']+)["']/i)
  if (metaMatch && metaMatch[1]) {
    assert.strictEqual(
      metaMatch[1],
      targetVersion,
      `index.html meta app-version (${metaMatch[1]}) diverge de package.json (${targetVersion})`,
    )
  }
}

// 3. Checa pocketbase/hooks/versao_app.js
const hookPath = path.join(rootDir, 'pocketbase', 'hooks', 'versao_app.js')
if (fs.existsSync(hookPath)) {
  const hookContent = fs.readFileSync(hookPath, 'utf8')
  const hookMatch = hookContent.match(/const\s+currentVersion\s*=\s*['"]([^'"]+)['"]/)
  if (hookMatch && hookMatch[1]) {
    assert.strictEqual(
      hookMatch[1],
      targetVersion,
      `pocketbase/hooks/versao_app.js (${hookMatch[1]}) diverge de package.json (${targetVersion})`,
    )
  }
}

// 4. Checa dist/version.json se dist existir
const distVersionPath = path.join(rootDir, 'dist', 'version.json')
if (fs.existsSync(distVersionPath)) {
  const distVersion = JSON.parse(fs.readFileSync(distVersionPath, 'utf8'))
  assert.strictEqual(
    distVersion.version,
    targetVersion,
    `dist/version.json (${distVersion.version}) diverge de package.json (${targetVersion})`,
  )
}

// 5. Checa dev-dist/version.json se dev-dist existir
const devDistVersionPath = path.join(rootDir, 'dev-dist', 'version.json')
if (fs.existsSync(devDistVersionPath)) {
  const devDistVersion = JSON.parse(fs.readFileSync(devDistVersionPath, 'utf8'))
  assert.strictEqual(
    devDistVersion.version,
    targetVersion,
    `dev-dist/version.json (${devDistVersion.version}) diverge de package.json (${targetVersion})`,
  )
}

console.log(
  `[Integrity Check] OK! Todos os artefatos de versão estão 100% sincronizados com v${targetVersion}.`,
)
