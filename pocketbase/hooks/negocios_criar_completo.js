// pocketbase/hooks/negocios_criar_completo.js
// Endpoint atômico para criação completa de negócio (Organização + Pessoa + Oportunidade + Follow-up)
// Garante execução em TRANSAÇÃO ÚNICA de banco de dados via $app.runInTransaction.
// Se qualquer passo falhar, NADA é salvo (rollback total), impedindo estados parciais e duplicidades.

routerAdd(
  'POST',
  '/backend/v1/negocios/criar-completo',
  (e) => {
    const authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Não autenticado', message: 'Usuário não autenticado.' })
    }

    const body = e.requestInfo().body || {}

    // Dados principais
    const marcaId = (body.marca_id || '').trim()
    const currentUserId = (body.vendedor_id || authUser.id || '').trim()

    if (!marcaId) {
      return e.json(400, {
        error: 'marca_obrigatoria',
        stage: 'validacao',
        message: 'A marca é obrigatória para registrar o negócio.',
      })
    }

    // Validação de Escopo de Marca do Usuário
    const rawPerfil = authUser.getString('perfil_global') || 'Vendedor'
    const isSuperAdminEmail = authUser.getString('email') === 'skip.adm@ntc.ind.br'
    const isAdmin = rawPerfil === 'Administrador' || isSuperAdminEmail
    const isDiretoria = !isAdmin && rawPerfil === 'Diretoria'

    if (!isAdmin && !isDiretoria) {
      // Usuário comum (Supervisor, Vendedor, Representante): checar marcas_permitidas
      let marcasPermitidas = []
      try {
        const rawPerms = authUser.get('permissoes')
        if (rawPerms && typeof rawPerms === 'object' && Array.isArray(rawPerms.marcas_permitidas)) {
          marcasPermitidas = rawPerms.marcas_permitidas
        }
      } catch (_) {}

      if (marcasPermitidas.length > 0 && !marcasPermitidas.includes(marcaId)) {
        return e.json(403, {
          error: 'marca_nao_autorizada',
          stage: 'autorizacao',
          message: 'Você não possui permissão para cadastrar negócios nesta marca.',
        })
      }
    }

    // Validações de negócio e follow-up (opcionais conforme diretriz de produto)
    const dealData = body.deal || {}
    const titulo = (dealData.titulo || '').trim() || 'Novo negócio'

    const followUpData = body.follow_up || {}
    const followUpDataVencimento = (followUpData.data_vencimento || '').trim()

    // Mapas e utilitários de normalização geográfica inline
    const UFS_MAP = {
      ACRE: 'AC',
      AC: 'AC',
      ALAGOAS: 'AL',
      AL: 'AL',
      AMAPA: 'AP',
      AMAPÁ: 'AP',
      AP: 'AP',
      AMAZONAS: 'AM',
      AM: 'AM',
      BAHIA: 'BA',
      BA: 'BA',
      CEARA: 'CE',
      CEARÁ: 'CE',
      CE: 'CE',
      'DISTRITO FEDERAL': 'DF',
      DF: 'DF',
      'ESPIRITO SANTO': 'ES',
      'ESPÍRITO SANTO': 'ES',
      ES: 'ES',
      GOIAS: 'GO',
      GOIÁS: 'GO',
      GO: 'GO',
      MARANHAO: 'MA',
      MARANHÃO: 'MA',
      MA: 'MA',
      'MATO GROSSO': 'MT',
      MT: 'MT',
      'MATO GROSSO DO SUL': 'MS',
      MS: 'MS',
      'MINAS GERAIS': 'MG',
      MG: 'MG',
      PARA: 'PA',
      PARÁ: 'PA',
      PA: 'PA',
      PARAIBA: 'PB',
      PARAÍBA: 'PB',
      PB: 'PB',
      PARANA: 'PR',
      PARANÁ: 'PR',
      PR: 'PR',
      PERNAMBUCO: 'PE',
      PE: 'PE',
      PIAUI: 'PI',
      PIAUÍ: 'PI',
      PI: 'PI',
      'RIO DE JANEIRO': 'RJ',
      RJ: 'RJ',
      'RIO GRANDE DO NORTE': 'RN',
      RN: 'RN',
      'RIO GRANDE DO SUL': 'RS',
      RS: 'RS',
      RONDONIA: 'RO',
      RONDÔNIA: 'RO',
      RO: 'RO',
      RORAIMA: 'RR',
      RR: 'RR',
      'SANTA CATARINA': 'SC',
      SC: 'SC',
      'SAO PAULO': 'SP',
      'SÃO PAULO': 'SP',
      SP: 'SP',
      SERGIPE: 'SE',
      SE: 'SE',
      TOCANTINS: 'TO',
      TO: 'TO',
    }

    const toTitle = (str) => {
      if (!str) return ''
      const preposicoes = ['de', 'da', 'do', 'dos', 'das', 'e', 'em']
      return str
        .trim()
        .split(/\s+/)
        .map((word, idx) => {
          const lower = word.toLowerCase()
          if (idx > 0 && preposicoes.indexOf(lower) !== -1) {
            return lower
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join(' ')
    }

    const normUf = (rawUf) => {
      if (!rawUf) return ''
      const clean = rawUf.trim().toUpperCase()
      if (UFS_MAP[clean]) return UFS_MAP[clean]
      const semAcento = clean
        .replace(/[ÁÀÃÂ]/g, 'A')
        .replace(/[ÉÈÊ]/g, 'E')
        .replace(/[ÍÌ]/g, 'I')
        .replace(/[ÓÒÕÔ]/g, 'O')
        .replace(/[ÚÙ]/g, 'U')
        .replace(/Ç/g, 'C')
      if (UFS_MAP[semAcento]) return UFS_MAP[semAcento]
      return clean.slice(0, 2)
    }

    const normPais = (rawPais) => {
      if (!rawPais || !rawPais.trim()) return 'Brasil'
      const trimmed = rawPais.trim()
      const lower = trimmed.toLowerCase()
      if (lower === 'brasil' || lower === 'brazil' || lower === 'br') return 'Brasil'
      return toTitle(trimmed)
    }

    const onlyDigits = (str) => (str ? String(str).replace(/\D/g, '') : '')

    const isValidCNPJ = (cnpj) => {
      const clean = onlyDigits(cnpj)
      if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false
      let size = clean.length - 2
      let numbers = clean.substring(0, size)
      const digits = clean.substring(size)
      let sum = 0
      let pos = size - 7
      for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--
        if (pos < 2) pos = 9
      }
      let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
      if (result !== parseInt(digits.charAt(0), 10)) return false
      size = size + 1
      numbers = clean.substring(0, size)
      sum = 0
      pos = size - 7
      for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--
        if (pos < 2) pos = 9
      }
      result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
      return result === parseInt(digits.charAt(1), 10)
    }

    const isValidCPF = (cpf) => {
      const clean = onlyDigits(cpf)
      if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false
      let sum = 0
      for (let i = 0; i < 9; i++) {
        sum += parseInt(clean.charAt(i), 10) * (10 - i)
      }
      let rev = 11 - (sum % 11)
      if (rev === 10 || rev === 11) rev = 0
      if (rev !== parseInt(clean.charAt(9), 10)) return false
      sum = 0
      for (let i = 0; i < 10; i++) {
        sum += parseInt(clean.charAt(i), 10) * (11 - i)
      }
      rev = 11 - (sum % 11)
      if (rev === 10 || rev === 11) rev = 0
      return rev === parseInt(clean.charAt(10), 10)
    }

    // Variáveis que receberão o resultado da transação
    let finalOrgId = (dealData.cliente_b2b_id || '').trim()
    let finalPessoaId = (dealData.cliente_b2c_id || '').trim()
    let orgVinculadaAuto = false
    let orgVinculadaNome = ''
    let pessoaVinculadaAuto = false
    let pessoaVinculadaNome = ''
    let createdDealId = ''
    let createdAtivId = ''

    // Bloco de Execução Atômica
    try {
      $app.runInTransaction((txApp) => {
        // =====================================================================
        // PASSO 1: Organização (se nova fornecida em body.nova_organizacao)
        // =====================================================================
        const novaOrg = body.nova_organizacao
        if (novaOrg && novaOrg.razao_social && !finalOrgId) {
          const rawRazao = String(novaOrg.razao_social).trim()
          const cleanCnpj = onlyDigits(novaOrg.cnpj)

          if (cleanCnpj) {
            if (!isValidCNPJ(cleanCnpj)) {
              throw new Error(
                'VALIDATION_ERROR:CNPJ_INVALIDO:O CNPJ informado possui dígitos verificadores inválidos.',
              )
            }

            // Deduplicação: busca se já existe organização cadastrada com este CNPJ
            try {
              const existingOrgs = txApp.findRecordsByFilter(
                'organizacoes',
                `cnpj = "${cleanCnpj}"`,
                '-created',
                1,
                0,
              )
              if (existingOrgs && existingOrgs.length > 0) {
                finalOrgId = existingOrgs[0].id
                orgVinculadaAuto = true
                orgVinculadaNome = existingOrgs[0].getString('razao_social')
              }
            } catch (errSearchOrg) {
              console.warn('[criar-completo] Erro busca org por cnpj:', errSearchOrg)
            }
          }

          // Se não vinculou a uma existente, cria nova organização
          if (!finalOrgId) {
            try {
              const orgCol = txApp.findCollectionByNameOrId('organizacoes')
              const orgRec = new Record(orgCol)

              orgRec.set('razao_social', rawRazao)
              orgRec.set(
                'nome_fantasia',
                novaOrg.nome_fantasia ? String(novaOrg.nome_fantasia).trim() : rawRazao,
              )
              orgRec.set('cnpj', cleanCnpj || null)
              orgRec.set(
                'email_principal',
                novaOrg.email_principal ? String(novaOrg.email_principal).trim() : null,
              )
              orgRec.set('telefone', novaOrg.telefone ? String(novaOrg.telefone).trim() : null)
              orgRec.set(
                'endereco_corporativo',
                novaOrg.endereco_corporativo ? String(novaOrg.endereco_corporativo).trim() : null,
              )

              // Normalização geográfica
              if (novaOrg.cidade) orgRec.set('cidade', toTitle(String(novaOrg.cidade)))
              if (novaOrg.estado) orgRec.set('estado', normUf(String(novaOrg.estado)))
              if (novaOrg.pais) orgRec.set('pais', normPais(String(novaOrg.pais)))

              orgRec.set('marca_captura_id', marcaId)
              orgRec.set(
                'origem_sistema',
                novaOrg.origem_sistema || 'Cadastro via Pipedrive Negócio',
              )
              orgRec.set('data_criacao', new Date().toISOString())
              orgRec.set('criado_por_id', currentUserId)

              txApp.save(orgRec)
              finalOrgId = orgRec.id
            } catch (errCreateOrg) {
              const errMsg = String(errCreateOrg || '')
              if (errMsg.includes('idx_organizacoes_cnpj_unique') || errMsg.includes('cnpj')) {
                throw new Error(
                  'DUPLICATE_ERROR:ORGANIZACAO_CNPJ:Já existe uma organização cadastrada com este CNPJ no sistema.',
                )
              }
              throw new Error(`STEP_ERROR:ORGANIZACAO:Falha ao criar organização: ${errMsg}`)
            }
          }
        }

        // =====================================================================
        // PASSO 2: Pessoa (se nova fornecida em body.nova_pessoa)
        // =====================================================================
        const novaPessoa = body.nova_pessoa
        if (novaPessoa && novaPessoa.nome_completo && !finalPessoaId) {
          const rawNome = String(novaPessoa.nome_completo).trim()
          const cleanCpf = onlyDigits(novaPessoa.cpf)

          if (cleanCpf) {
            if (!isValidCPF(cleanCpf)) {
              throw new Error(
                'VALIDATION_ERROR:CPF_INVALIDO:O CPF informado possui dígitos verificadores inválidos.',
              )
            }

            // Deduplicação: busca se já existe pessoa com este CPF
            try {
              const existingPessoas = txApp.findRecordsByFilter(
                'pessoas',
                `cpf = "${cleanCpf}"`,
                '-created',
                1,
                0,
              )
              if (existingPessoas && existingPessoas.length > 0) {
                finalPessoaId = existingPessoas[0].id
                pessoaVinculadaAuto = true
                pessoaVinculadaNome = existingPessoas[0].getString('nome_completo')
              }
            } catch (errSearchPes) {
              console.warn('[criar-completo] Erro busca pessoa por cpf:', errSearchPes)
            }
          }

          if (!finalPessoaId) {
            try {
              const pesCol = txApp.findCollectionByNameOrId('pessoas')
              const pesRec = new Record(pesCol)

              pesRec.set('nome_completo', rawNome)
              pesRec.set('cpf', cleanCpf || null)
              pesRec.set(
                'email_principal',
                novaPessoa.email_principal ? String(novaPessoa.email_principal).trim() : null,
              )
              pesRec.set(
                'telefone',
                novaPessoa.telefone ? String(novaPessoa.telefone).trim() : null,
              )
              pesRec.set('marca_captura_id', marcaId)
              pesRec.set('organizacao_id', finalOrgId || null)
              pesRec.set('cargo', novaPessoa.cargo ? String(novaPessoa.cargo).trim() : null)
              pesRec.set(
                'departamento',
                novaPessoa.departamento ? String(novaPessoa.departamento).trim() : null,
              )
              pesRec.set(
                'origem_sistema',
                novaPessoa.origem_sistema || 'Cadastro via Pipedrive Negócio',
              )
              pesRec.set('data_criacao', new Date().toISOString())
              pesRec.set('criado_por_id', currentUserId)

              if (novaPessoa.cidade) pesRec.set('cidade', toTitle(String(novaPessoa.cidade)))
              if (novaPessoa.estado) pesRec.set('estado', normUf(String(novaPessoa.estado)))
              if (novaPessoa.pais) pesRec.set('pais', normPais(String(novaPessoa.pais)))

              txApp.save(pesRec)
              finalPessoaId = pesRec.id
            } catch (errCreatePes) {
              const errMsg = String(errCreatePes || '')
              if (errMsg.includes('idx_pessoas_cpf_unique') || errMsg.includes('cpf')) {
                throw new Error(
                  'DUPLICATE_ERROR:PESSOA_CPF:Já existe uma pessoa cadastrada com este CPF no sistema.',
                )
              }
              throw new Error(`STEP_ERROR:PESSOA:Falha ao criar pessoa: ${errMsg}`)
            }
          }
        } else if (finalPessoaId && body.atualizar_pessoa_vinculada) {
          // Atualiza dados de contato/vínculo da pessoa existente se solicitado
          try {
            const pesRec = txApp.findRecordById('pessoas', finalPessoaId)
            const up = body.atualizar_pessoa_vinculada
            if (up.telefone) pesRec.set('telefone', String(up.telefone).trim())
            if (up.email_principal) pesRec.set('email_principal', String(up.email_principal).trim())
            if (finalOrgId && !pesRec.getString('organizacao_id')) {
              pesRec.set('organizacao_id', finalOrgId)
            }
            txApp.save(pesRec)
          } catch (errUpPes) {
            console.warn(
              '[criar-completo] Aviso ao atualizar dados de contato da pessoa:',
              errUpPes,
            )
          }
        }

        // =====================================================================
        // PASSO 3: Classificação "Cliente novo" vs "Recompra"
        // =====================================================================
        let tipoCliente = dealData.tipo_cliente || 'Cliente novo'
        if (!dealData.tipo_cliente && (finalOrgId || finalPessoaId)) {
          try {
            const filters = []
            if (finalOrgId) filters.push(`cliente_b2b_id = "${finalOrgId}"`)
            if (finalPessoaId) filters.push(`cliente_b2c_id = "${finalPessoaId}"`)
            const queryFilter = filters.join(' || ')

            const pastDeals = txApp.findRecordsByFilter(
              'oportunidades',
              queryFilter,
              '-created',
              100,
              0,
            )
            const wonStages = new Set([
              'ganho',
              'fechado',
              'fechado ganho',
              'pedido efetivado',
              'venda ganha',
              'concluído',
              'faturado',
            ])

            let funis = []
            try {
              funis = txApp.findRecordsByFilter('funis', '1=1', '-created', 50, 0)
            } catch (_) {}

            for (let f of funis) {
              try {
                let etapas = f.get('etapas_ordenadas')
                if (Array.isArray(etapas)) {
                  for (let et of etapas) {
                    if (et && (et.is_won === true || et.status === 'won')) {
                      if (et.nome) wonStages.add(String(et.nome).toLowerCase().trim())
                    }
                  }
                }
              } catch (_) {}
            }

            let hasWon = false
            for (let d of pastDeals) {
              const etapa = String(d.get('etapa_atual') || '')
                .toLowerCase()
                .trim()
              const status = String(d.get('status') || '')
                .toLowerCase()
                .trim()
              if (status === 'ganho' || wonStages.has(etapa)) {
                hasWon = true
                break
              }
            }
            tipoCliente = hasWon ? 'Recompra' : 'Cliente novo'
          } catch (errClassif) {
            console.warn('[criar-completo] Erro na classificação de tipo_cliente:', errClassif)
            tipoCliente = 'Cliente novo'
          }
        }

        // =====================================================================
        // PASSO 4: Criar a Oportunidade
        // =====================================================================
        try {
          const oppCol = txApp.findCollectionByNameOrId('oportunidades')
          const oppRec = new Record(oppCol)

          oppRec.set('titulo', titulo)
          oppRec.set('valor_estimado', Number(dealData.valor_estimado) || 0)
          oppRec.set('funil_id', dealData.funil_id || null)
          oppRec.set('etapa_atual', dealData.etapa_atual || 'Primeiro contato')
          oppRec.set('marca_id', marcaId)
          oppRec.set('cliente_b2b_id', finalOrgId || null)
          oppRec.set('cliente_b2c_id', finalPessoaId || null)
          oppRec.set('vendedor_id', currentUserId)
          oppRec.set('status', dealData.status || 'aberto')
          oppRec.set('tipo_cliente', tipoCliente)
          oppRec.set('documento_faturamento', dealData.documento_faturamento || null)

          if (dealData.data_fechamento_esperada) {
            oppRec.set('data_fechamento_esperada', dealData.data_fechamento_esperada)
          }

          // Origem e observações
          if (dealData.origem) oppRec.set('origem', dealData.origem)
          if (dealData.id_canal_origem) oppRec.set('id_canal_origem', dealData.id_canal_origem)
          if (dealData.observacoes) oppRec.set('observacoes', dealData.observacoes)
          if (dealData.lead_origem_id) oppRec.set('lead_origem_id', dealData.lead_origem_id)

          // Normalização de Geografia: faturamento e entrega
          const cidFat = dealData.cidade ? toTitle(String(dealData.cidade)) : null
          const estFat = dealData.estado ? normUf(String(dealData.estado)) : null
          const paisFat = normPais(dealData.pais)

          oppRec.set('cidade', cidFat)
          oppRec.set('estado', estFat)
          oppRec.set('pais', paisFat)

          const cidEnt = dealData.cidade_entrega ? toTitle(String(dealData.cidade_entrega)) : cidFat
          const estEnt = dealData.estado_entrega ? normUf(String(dealData.estado_entrega)) : estFat
          const paisEnt = dealData.pais_entrega ? normPais(dealData.pais_entrega) : paisFat

          oppRec.set('cidade_entrega', cidEnt)
          oppRec.set('estado_entrega', estEnt)
          oppRec.set('pais_entrega', paisEnt)

          // Trava de Follow-up na oportunidade
          oppRec.set('proxima_acao_data', followUpDataVencimento)
          if (followUpData.descricao) {
            oppRec.set('proxima_acao_descricao', String(followUpData.descricao).trim())
          }

          txApp.save(oppRec)
          createdDealId = oppRec.id
        } catch (errCreateDeal) {
          const errMsg = String(errCreateDeal || '')
          throw new Error(`STEP_ERROR:OPORTUNIDADE:Falha ao criar oportunidade: ${errMsg}`)
        }

        // =====================================================================
        // PASSO 5: Criar a Atividade de Follow-up (se informada)
        // =====================================================================
        if (followUpDataVencimento) {
          try {
            const ativCol = txApp.findCollectionByNameOrId('atividades')
            const ativRec = new Record(ativCol)

            ativRec.set('oportunidade_id', createdDealId)
            ativRec.set('marca_id', marcaId)
            ativRec.set('responsavel_id', currentUserId)
            ativRec.set('tipo', followUpData.tipo || 'Follow-up')
            ativRec.set(
              'descricao',
              (followUpData.descricao || 'Ação comercial agendada no negócio').trim(),
            )
            ativRec.set('data_vencimento', followUpDataVencimento)
            ativRec.set('concluida', false)

            txApp.save(ativRec)
            createdAtivId = ativRec.id
          } catch (errCreateAtiv) {
            const errMsg = String(errCreateAtiv || '')
            throw new Error(
              `STEP_ERROR:ATIVIDADE:Falha ao agendar atividade de follow-up: ${errMsg}`,
            )
          }
        }

        // =====================================================================
        // PASSO 6: Atualizar Lead de Origem (se houver lead_origem_id)
        // =====================================================================
        if (dealData.lead_origem_id) {
          try {
            const leadRec = txApp.findRecordById('leads', dealData.lead_origem_id)
            leadRec.set('status_qualificacao', 'Convertido')
            leadRec.set('convertido_para_id', createdDealId)
            if (finalOrgId && !leadRec.getString('cliente_b2b_id')) {
              leadRec.set('cliente_b2b_id', finalOrgId)
            }
            if (finalPessoaId && !leadRec.getString('cliente_b2c_id')) {
              leadRec.set('cliente_b2c_id', finalPessoaId)
            }
            txApp.save(leadRec)
          } catch (errLead) {
            console.warn(
              '[criar-completo] Aviso ao marcar lead como Convertido na transação:',
              errLead,
            )
          }
        }
      })
    } catch (txErr) {
      const fullError = String(txErr && txErr.message ? txErr.message : txErr || '')
      console.error('[criar-completo] Transação revertida com sucesso (rollback):', fullError)

      // Identifica e trata os tipos específicos de erro para feedback claro ao usuário
      if (fullError.includes('DUPLICATE_ERROR:ORGANIZACAO_CNPJ')) {
        return e.json(400, {
          error: 'cnpj_duplicado',
          stage: 'organizacao',
          field: 'cnpj',
          message: 'Não foi possível salvar: já existe uma organização com este CNPJ no sistema.',
        })
      }

      if (fullError.includes('DUPLICATE_ERROR:PESSOA_CPF')) {
        return e.json(400, {
          error: 'cpf_duplicado',
          stage: 'pessoa',
          field: 'cpf',
          message:
            'Não foi possível salvar: já existe uma pessoa cadastrada com este CPF no sistema.',
        })
      }

      if (fullError.includes('VALIDATION_ERROR:CNPJ_INVALIDO')) {
        return e.json(400, {
          error: 'cnpj_invalido',
          stage: 'organizacao',
          field: 'cnpj',
          message: 'CNPJ inválido: verifique os dígitos verificadores informados.',
        })
      }

      if (fullError.includes('VALIDATION_ERROR:CPF_INVALIDO')) {
        return e.json(400, {
          error: 'cpf_invalido',
          stage: 'pessoa',
          field: 'cpf',
          message: 'CPF inválido: verifique os dígitos verificadores informados.',
        })
      }

      if (fullError.includes('STEP_ERROR:ORGANIZACAO')) {
        return e.json(400, {
          error: 'falha_organizacao',
          stage: 'organizacao',
          message: 'Falha ao salvar a organização. O negócio não foi criado.',
          detail: fullError,
        })
      }

      if (fullError.includes('STEP_ERROR:PESSOA')) {
        return e.json(400, {
          error: 'falha_pessoa',
          stage: 'pessoa',
          message: 'Falha ao salvar a pessoa de contato. O negócio não foi criado.',
          detail: fullError,
        })
      }

      if (fullError.includes('STEP_ERROR:OPORTUNIDADE')) {
        return e.json(400, {
          error: 'falha_oportunidade',
          stage: 'oportunidade',
          message: 'Falha ao salvar a oportunidade. Nenhuma entidade foi persistida.',
          detail: fullError,
        })
      }

      if (fullError.includes('STEP_ERROR:ATIVIDADE')) {
        return e.json(400, {
          error: 'falha_followup',
          stage: 'atividade',
          message: 'Falha ao criar a atividade de follow-up. A oportunidade foi revertida.',
          detail: fullError,
        })
      }

      return e.json(400, {
        error: 'falha_transacao',
        stage: 'transacao',
        message: 'Não foi possível salvar o negócio. Nenhuma alteração foi gravada.',
        detail: fullError,
      })
    }

    return e.json(200, {
      success: true,
      oportunidade_id: createdDealId,
      atividade_id: createdAtivId,
      organizacao_id: finalOrgId || null,
      pessoa_id: finalPessoaId || null,
      org_vinculada_auto: orgVinculadaAuto,
      org_vinculada_nome: orgVinculadaNome,
      pessoa_vinculada_auto: pessoaVinculadaAuto,
      pessoa_vinculada_nome: pessoaVinculadaNome,
      message: 'Negócio, contatos e follow-up criados com sucesso em transação única.',
    })
  },
  $apis.requireAuth(),
)
