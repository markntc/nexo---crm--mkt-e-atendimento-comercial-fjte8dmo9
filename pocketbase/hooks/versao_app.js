// pocketbase/hooks/versao_app.js
// Endpoint público para consulta de integridade e versão do app publicado
// Permite que navegadores verifiquem se há um novo release disponível

routerAdd('GET', '/backend/v1/versao', (e) => {
  // Configura headers para nunca armazenar em cache
  e.response.header().set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  e.response.header().set('Pragma', 'no-cache')
  e.response.header().set('Expires', '0')

  // Determina dinamicamente a versão lendo arquivos de build/metadados caso existam
  let currentVersion = '0.0.87'
  let buildTimestamp = Date.now()
  let buildTime = new Date().toISOString()

  // Tentativas de leitura de versão dinâmica dos arquivos gerados no deploy/build.
  // Prioridade 1: package.json (que é atualizado automaticamente na plataforma no commit)
  // Prioridade 2: public/version.json e outros artefatos sincronizados
  const possiblePaths = [
    'package.json',
    '../package.json',
    'public/version.json',
    '../public/version.json',
    'version.json',
    'pb_public/version.json',
  ]

  for (let i = 0; i < possiblePaths.length; i++) {
    try {
      const content = $os.readFile(possiblePaths[i])
      if (content && content.length > 0) {
        const text =
          typeof content === 'string' ? content : String.fromCharCode.apply(null, content)
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed.version === 'string' && parsed.version.trim()) {
          currentVersion = parsed.version.trim()
          if (parsed.buildTimestamp) buildTimestamp = parsed.buildTimestamp
          if (parsed.buildTime) buildTime = parsed.buildTime
          break
        }
      }
    } catch (_) {
      // Continua para o próximo caminho caso não consiga ler
    }
  }

  return e.json(200, {
    version: currentVersion,
    updated_at: buildTime,
    timestamp: buildTimestamp,
    status: 'ok',
  })
})
