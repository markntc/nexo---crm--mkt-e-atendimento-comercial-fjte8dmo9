migrate(
  (app) => {
    // Proteger coleções administrativas no backend: apenas Administrador tem acesso
    // Administrador possui perfil_global = 'Administrador' ou email 'skip.adm@ntc.ind.br'
    const adminRule =
      "@request.auth.id != '' && (@request.auth.perfil_global = 'Administrador' || @request.auth.email = 'skip.adm@ntc.ind.br')"

    // 1. convites_usuarios: apenas Administrador pode criar, listar, ver, atualizar, deletar
    try {
      const convites = app.findCollectionByNameOrId('convites_usuarios')
      convites.listRule = adminRule
      convites.viewRule = adminRule
      convites.createRule = adminRule
      convites.updateRule = adminRule
      convites.deleteRule = adminRule
      app.save(convites)
    } catch (e) {
      console.log('Aviso ao atualizar regras de convites_usuarios:', e)
    }

    // 2. preferencias_comunicacao: governança & LGPD acessível apenas por Administrador
    try {
      const prefs = app.findCollectionByNameOrId('preferencias_comunicacao')
      prefs.listRule = adminRule
      prefs.viewRule = adminRule
      prefs.createRule = adminRule
      prefs.updateRule = adminRule
      prefs.deleteRule = adminRule
      app.save(prefs)
    } catch (e) {
      console.log('Aviso ao atualizar regras de preferencias_comunicacao:', e)
    }
  },
  (app) => {
    const authRule = "@request.auth.id != ''"
    try {
      const convites = app.findCollectionByNameOrId('convites_usuarios')
      convites.listRule = authRule
      convites.viewRule = authRule
      convites.createRule = authRule
      convites.updateRule = authRule
      convites.deleteRule = authRule
      app.save(convites)
    } catch (_) {}

    try {
      const prefs = app.findCollectionByNameOrId('preferencias_comunicacao')
      prefs.listRule = authRule
      prefs.viewRule = authRule
      prefs.createRule = authRule
      prefs.updateRule = authRule
      prefs.deleteRule = authRule
      app.save(prefs)
    } catch (_) {}
  },
)
