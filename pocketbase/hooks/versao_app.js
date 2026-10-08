// pocketbase/hooks/versao_app.js
// Endpoint público para consulta de integridade e versão do app publicado
// Permite que navegadores verifiquem se há um novo release disponível

routerAdd('GET', '/backend/v1/versao', (e) => {
  // Configura headers para nunca armazenar em cache
  e.response.header().set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  e.response.header().set('Pragma', 'no-cache')
  e.response.header().set('Expires', '0')

  return e.json(200, {
    version: '0.0.45',
    updated_at: new Date().toISOString(),
    timestamp: Date.now(),
    status: 'ok',
  })
})
