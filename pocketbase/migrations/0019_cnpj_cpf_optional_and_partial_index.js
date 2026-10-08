/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. ORGANIZACOES: tornar 'cnpj' não obrigatório (required = false) e substituir índice único simples por índice parcial
    const orgCol = app.findCollectionByNameOrId('organizacoes')
    const orgCnpjField = orgCol.fields.getByName('cnpj')
    if (orgCnpjField) {
      orgCnpjField.required = false
    }

    // Dropar índice único simples anterior se existir
    try {
      orgCol.removeIndex('idx_clientes_b2b_cnpj')
    } catch (_) {}

    // Adicionar índice parcial único no SQLite para CNPJ não vazio
    // Em SQLite / PocketBase: "CREATE UNIQUE INDEX idx_organizacoes_cnpj_unique ON organizacoes (cnpj) WHERE cnpj != '' AND cnpj IS NOT NULL"
    // Ou via col.addIndex / raw index list
    // col.indexes é um array de strings no Collection model
    const orgIndexes = orgCol.indexes.filter(
      (idx) =>
        !idx.includes('idx_clientes_b2b_cnpj') && !idx.includes('idx_organizacoes_cnpj_unique'),
    )
    orgIndexes.push(
      "CREATE UNIQUE INDEX `idx_organizacoes_cnpj_unique` ON `organizacoes` (`cnpj`) WHERE `cnpj` != '' AND `cnpj` IS NOT NULL",
    )
    orgCol.indexes = orgIndexes

    app.save(orgCol)

    // 2. PESSOAS: tornar 'cpf' não obrigatório (required = false) e substituir índice único simples por índice parcial
    const pesCol = app.findCollectionByNameOrId('pessoas')
    const pesCpfField = pesCol.fields.getByName('cpf')
    if (pesCpfField) {
      pesCpfField.required = false
    }

    // Dropar índice único simples anterior se existir
    try {
      pesCol.removeIndex('idx_clientes_b2c_cpf')
    } catch (_) {}

    const pesIndexes = pesCol.indexes.filter(
      (idx) => !idx.includes('idx_clientes_b2c_cpf') && !idx.includes('idx_pessoas_cpf_unique'),
    )
    pesIndexes.push(
      "CREATE UNIQUE INDEX `idx_pessoas_cpf_unique` ON `pessoas` (`cpf`) WHERE `cpf` != '' AND `cpf` IS NOT NULL",
    )
    pesCol.indexes = pesIndexes

    app.save(pesCol)
  },
  (app) => {
    try {
      const orgCol = app.findCollectionByNameOrId('organizacoes')
      const orgCnpjField = orgCol.fields.getByName('cnpj')
      if (orgCnpjField) {
        orgCnpjField.required = true
      }
      orgCol.indexes = orgCol.indexes.filter((idx) => !idx.includes('idx_organizacoes_cnpj_unique'))
      orgCol.indexes.push('CREATE UNIQUE INDEX `idx_clientes_b2b_cnpj` ON `organizacoes` (`cnpj`)')
      app.save(orgCol)
    } catch (_) {}

    try {
      const pesCol = app.findCollectionByNameOrId('pessoas')
      const pesCpfField = pesCol.fields.getByName('cpf')
      if (pesCpfField) {
        pesCpfField.required = true
      }
      pesCol.indexes = pesCol.indexes.filter((idx) => !idx.includes('idx_pessoas_cpf_unique'))
      pesCol.indexes.push('CREATE UNIQUE INDEX `idx_clientes_b2c_cpf` ON `pessoas` (`cpf`)')
      app.save(pesCol)
    } catch (_) {}
  },
)
