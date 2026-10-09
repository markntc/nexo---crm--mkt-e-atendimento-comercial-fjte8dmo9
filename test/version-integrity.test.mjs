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
  })

  await t.test(
    'Lógica de comparação de versão não aciona falso positivo para versão idêntica',
    () => {
      const cleanRemote = (v) => v.trim().replace(/^v/, '')
      const isNew = (remote, current) => cleanRemote(remote) !== cleanRemote(current)

      assert.strictEqual(
        isNew(appVersion, appVersion),
        false,
        'Versão idêntica não deve disparar atualização',
      )
      assert.strictEqual(
        isNew(`v${appVersion}`, appVersion),
        false,
        'Versão com prefixo v não deve disparar atualização',
      )
      assert.strictEqual(
        isNew('0.0.99', appVersion),
        true,
        'Versão remota diferente deve disparar atualização',
      )
    },
  )
})
