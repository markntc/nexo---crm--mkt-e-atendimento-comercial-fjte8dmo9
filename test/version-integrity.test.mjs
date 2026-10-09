/**
 * Teste automatizado de integridade de versionamento do Nexo NTC.
 * Executado pelo pipeline de teste do projeto (`pnpm test` / `npm test`).
 *
 * Garante que:
 * 1. package.json é a fonte única de verdade.
 * 2. public/version.json coincide com package.json.
 * 3. src/lib/appVersion.ts exporta CURRENT_APP_VERSION derivada diretamente do package.json.
 * 4. A função isNewVersionAvailable detecta diferenças reais e ignora versões idênticas.
 */
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

test('Verificação de fonte única de verdade para a versão', async (t) => {
  const pkgPath = path.join(rootDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const appVersion = pkg.version

  assert.ok(appVersion, 'package.json deve conter uma versão válida')
  assert.strictEqual(typeof appVersion, 'string', 'A versão deve ser uma string')

  await t.test('public/version.json reflete a versão de package.json', () => {
    const versionJsonPath = path.join(rootDir, 'public', 'version.json')
    assert.ok(fs.existsSync(versionJsonPath), 'public/version.json deve existir')
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'))
    assert.strictEqual(
      versionJson.version,
      appVersion,
      `public/version.json (${versionJson.version}) deve ser idêntica a package.json (${appVersion})`,
    )
    assert.ok(versionJson.buildTime, 'public/version.json deve conter buildTime')
    assert.ok(versionJson.buildTimestamp, 'public/version.json deve conter buildTimestamp')
  })

  await t.test('index.html meta tag app-version reflete package.json', () => {
    const indexHtmlPath = path.join(rootDir, 'index.html')
    const html = fs.readFileSync(indexHtmlPath, 'utf8')
    const match = html.match(/<meta[^>]*name=["']app-version["'][^>]*content=["']([^"']+)["']/i)
    assert.ok(match, 'index.html deve conter meta name="app-version"')
    assert.strictEqual(
      match[1],
      appVersion,
      `meta app-version (${match[1]}) deve ser idêntica a package.json (${appVersion})`,
    )
  })

  await t.test('pocketbase/hooks/versao_app.js reflete package.json', () => {
    const hookPath = path.join(rootDir, 'pocketbase', 'hooks', 'versao_app.js')
    const hookContent = fs.readFileSync(hookPath, 'utf8')
    const match = hookContent.match(/const\s+currentVersion\s*=\s*['"]([^'"]+)['"]/)
    assert.ok(match, 'versao_app.js deve declarar currentVersion')
    assert.strictEqual(
      match[1],
      appVersion,
      `versao_app.js (${match[1]}) deve coincidir com package.json (${appVersion})`,
    )
  })

  await t.test('src/lib/appVersion.ts importa versão diretamente do package.json', () => {
    const appVersionTsPath = path.join(rootDir, 'src', 'lib', 'appVersion.ts')
    const content = fs.readFileSync(appVersionTsPath, 'utf8')
    assert.ok(
      content.includes('packageJson.version'),
      'src/lib/appVersion.ts deve derivar CURRENT_APP_VERSION de packageJson.version',
    )
    assert.ok(
      !/export const CURRENT_APP_VERSION = ['"]\d+\.\d+\.\d+['"]/.test(content),
      'src/lib/appVersion.ts não deve conter versão escrita à mão hardcoded',
    )
    assert.ok(
      content.includes('compareSemver'),
      'src/lib/appVersion.ts deve conter a função compareSemver',
    )
    assert.ok(
      content.includes('compareSemver(remoteVersion, currentVersion) > 0'),
      'src/lib/appVersion.ts deve comparar se a versão remota é estritamente maior que a atual',
    )
  })

  await t.test('Lógica de comparação semântica de versão (isNewVersionAvailable)', () => {
    function compareSemver(v1, v2) {
      if (!v1 || !v2) return 0
      const clean1 = v1.trim().replace(/^v/i, '')
      const clean2 = v2.trim().replace(/^v/i, '')
      const base1 = clean1.split('-')[0].split('+')[0]
      const base2 = clean2.split('-')[0].split('+')[0]
      const parts1 = base1.split('.').map((p) => {
        const num = parseInt(p, 10)
        return isNaN(num) ? 0 : num
      })
      const parts2 = base2.split('.').map((p) => {
        const num = parseInt(p, 10)
        return isNaN(num) ? 0 : num
      })
      const maxLen = Math.max(parts1.length, parts2.length)
      for (let i = 0; i < maxLen; i++) {
        const p1 = parts1[i] ?? 0
        const p2 = parts2[i] ?? 0
        if (p1 > p2) return 1
        if (p1 < p2) return -1
      }
      return 0
    }

    function isNewVersionAvailable(remoteVersion, currentVersion = appVersion) {
      if (!remoteVersion) return false
      return compareSemver(remoteVersion, currentVersion) > 0
    }

    // 1. Versão idêntica -> false
    assert.strictEqual(
      isNewVersionAvailable(appVersion, appVersion),
      false,
      'Versão idêntica não deve disparar atualização',
    )
    assert.strictEqual(
      isNewVersionAvailable(`v${appVersion}`, appVersion),
      false,
      'Versão com prefixo v não deve disparar atualização se idêntica',
    )

    // 2. Versão remota mais antiga -> false (evita loop com versão em cache ou servida anterior)
    assert.strictEqual(
      isNewVersionAvailable('0.0.50', '0.0.55'),
      false,
      'Versão remota mais antiga (0.0.50 < 0.0.55) NUNCA deve disparar atualização',
    )
    assert.strictEqual(
      isNewVersionAvailable('0.0.55', '0.0.56'),
      false,
      'Versão remota mais antiga (0.0.55 < 0.0.56) NUNCA deve disparar atualização',
    )
    assert.strictEqual(
      isNewVersionAvailable('0.0.1', appVersion),
      false,
      'Versão remota mais antiga não deve disparar atualização',
    )

    // 3. Versão remota mais nova -> true
    assert.strictEqual(
      isNewVersionAvailable('0.0.57', '0.0.56'),
      true,
      'Versão remota mais nova (0.0.57 > 0.0.56) deve disparar atualização',
    )
    assert.strictEqual(
      isNewVersionAvailable('v0.0.57', '0.0.56'),
      true,
      'Versão remota mais nova com prefixo v deve disparar atualização',
    )
    assert.strictEqual(
      isNewVersionAvailable('0.1.0', '0.0.56'),
      true,
      'Versão minor mais nova deve disparar atualização',
    )
    assert.strictEqual(
      isNewVersionAvailable('1.0.0', '0.0.56'),
      true,
      'Versão major mais nova deve disparar atualização',
    )
    assert.strictEqual(
      isNewVersionAvailable('0.0.100', '0.0.56'),
      true,
      'Versão com patch de mais de 2 dígitos mais nova deve disparar atualização',
    )
  })
})
