// pocketbase/migrations/0025_deduplicar_atividades_idempotente.js
// Migração idempotente para deduplicar atividades geradas repetidamente
// Chave de agrupamento: oportunidade_id + tipo + descricao + data_vencimento
// Mantém SEMPRE a mais recente (MAX(created), com desempate por MAX(id)) e remove as anteriores.

migrate(
  (app) => {
    app.runInTransaction((txApp) => {
      // 1. Encontra e remove duplicatas mantendo apenas o ID mais recente de cada grupo
      // No SQLite / PocketBase, 'created' é timestamp em formato ISO com millis.
      // MAX(created) identifica a versão mais recente criada.
      txApp
        .db()
        .newQuery(`
      DELETE FROM atividades
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY oportunidade_id, tipo, descricao, data_vencimento
                   ORDER BY created DESC, id DESC
                 ) as rn
          FROM atividades
          WHERE oportunidade_id IS NOT NULL AND oportunidade_id != ''
        ) WHERE rn = 1
      )
      AND oportunidade_id IS NOT NULL
      AND oportunidade_id != ''
    `)
        .execute()
    })
  },
  (app) => {
    // Operação irreversível de limpeza de duplicatas (down vazio é padrão aceito)
  },
)
