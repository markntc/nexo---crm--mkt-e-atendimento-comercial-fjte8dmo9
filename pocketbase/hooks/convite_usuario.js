// pocketbase/hooks/convite_usuario.js
// Endpoint autenticado para administradores convidarem novos usuários para o CRM NTC:
// 1. Cria ou atualiza o usuário na collection `users` com senha temporária segura
// 2. Registra o convite em `convites_usuarios`
// 3. Dispara e-mail de definição/recuperação de senha nativo do PocketBase ($app.newMailClient ou requestPasswordReset)

routerAdd(
  'POST',
  '/backend/v1/convidar-usuario',
  (e) => {
    const authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Não autenticado' })
    }

    // Apenas Administrador pode convidar
    const isGlobalAdmin =
      authUser.getString('perfil_global') === 'Administrador' ||
      authUser.getString('email') === 'skip.adm@ntc.ind.br' ||
      (authUser.getString('name') || '').toLowerCase().includes('administrador')

    if (!isGlobalAdmin) {
      return e.json(403, { error: 'Apenas administradores podem convidar usuários.' })
    }

    const body = e.requestInfo().body || {}
    const email = (body.email || '').trim().toLowerCase()
    const nome = (body.nome || '').trim()
    const perfilGlobal = body.perfil_global || 'Vendedor'
    const permissoes = body.permissoes || {}

    if (!email || !nome) {
      return e.json(400, { error: 'Nome e e-mail são obrigatórios.' })
    }

    let userRecord = null
    let isNewUser = false

    try {
      userRecord = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {
      // Usuário novo
    }

    if (!userRecord) {
      isNewUser = true
      const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
      userRecord = new Record(usersCol)
      userRecord.setEmail(email)
      userRecord.setPassword($security.randomString(24))
      userRecord.setVerified(true)
      userRecord.set('name', nome)
      userRecord.set('ativo', true)
      userRecord.set('perfil_global', perfilGlobal)
      userRecord.set('permissoes', permissoes)
      $app.save(userRecord)
    } else {
      userRecord.set('name', nome)
      userRecord.set('ativo', true)
      userRecord.set('perfil_global', perfilGlobal)
      userRecord.set('permissoes', permissoes)
      $app.save(userRecord)
    }

    // Registra convite na collection `convites_usuarios`
    try {
      const convitesCol = $app.findCollectionByNameOrId('convites_usuarios')
      const conviteRec = new Record(convitesCol)
      conviteRec.set('nome', nome)
      conviteRec.set('email', email)
      conviteRec.set('perfil_global', perfilGlobal)
      conviteRec.set('permissoes', permissoes)
      conviteRec.set('status', 'Pendente')
      conviteRec.set('convidado_por_id', authUser.id)
      $app.save(conviteRec)
    } catch (cErr) {
      console.log('Aviso ao registrar histórico de convite:', cErr)
    }

    // Dispara e-mail de definição de senha via mecanismo nativo de password reset
    let emailEnviado = false
    try {
      // Usar o método nativo de envio de e-mail de reset de senha para o usuário recém-criado/convidado
      // PocketBase permite disparo via $app.findAuthRecordByEmail + newMailClient ou chamando action de reset
      const mailClient = $app.newMailClient()
      const subject = `Convite para acesso ao Nexus CRM - NTC Multi-Marca`
      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E3E7EB; border-radius: 12px;">
          <h2 style="color: #017848; margin-top: 0;">Bem-vindo ao Nexus CRM (Grupo NTC)</h2>
          <p>Olá <strong>${nome}</strong>,</p>
          <p>Você foi convidado por <strong>${authUser.getString('name') || 'Administrador NTC'}</strong> para acessar a plataforma multi-marca do Nexus CRM como <strong>${perfilGlobal}</strong>.</p>
          <p>Para definir sua senha de acesso e começar a usar o sistema, utilize a opção "Esqueci minha senha" na tela de login informando seu e-mail corporativo: <strong>${email}</strong>.</p>
          <div style="margin: 24px 0;">
            <a href="${$os.getenv('VITE_POCKETBASE_URL') || '#'}/forgot-password" style="background-color: #017848; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Acessar e Definir Senha
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b;">Se você não esperava este convite, por favor desconsidere esta mensagem.</p>
        </div>
      `
      mailClient.send({
        from: {
          address: 'no-reply@ntc.ind.br',
          name: 'Nexus CRM - Grupo NTC',
        },
        to: [{ address: email }],
        subject: subject,
        html: htmlBody,
      })
      emailEnviado = true
    } catch (mErr) {
      console.log('Aviso ao enviar e-mail de convite:', mErr)
    }

    return e.json(200, {
      success: true,
      user_id: userRecord.id,
      is_new: isNewUser,
      email_enviado: emailEnviado,
      message: `Convite processado para ${email}.`,
    })
  },
  $apis.requireAuth(),
)
