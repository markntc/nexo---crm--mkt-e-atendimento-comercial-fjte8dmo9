/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Verificar se a collection anexos já existe (idempotência)
    let anexosCol
    try {
      anexosCol = app.findCollectionByNameOrId('anexos')
    } catch (_) {
      const oppCol = app.findCollectionByNameOrId('oportunidades')
      const marcasCol = app.findCollectionByNameOrId('marcas')

      // Collection dedicada 'anexos' vinculada a oportunidades
      // Armazena arquivos anexados à oportunidade com metadados ricos:
      // arquivo (FileField, 50MB, formatos comuns), nome_original, tamanho, mime_type,
      // oportunidade_id (RelationField com cascadeDelete: true), marca_id, criado_por_id.
      // Regras de acesso: usuários autenticados.
      anexosCol = new Collection({
        name: 'anexos',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'oportunidade_id',
            type: 'relation',
            required: true,
            collectionId: oppCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'marca_id',
            type: 'relation',
            required: false,
            collectionId: marcasCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'arquivo',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 52428800, // 50 MB
            mimeTypes: [], // aceita qualquer tipo de documento comum (PDF, DOCX, XLSX, imagens, etc.)
          },
          {
            name: 'nome_original',
            type: 'text',
            required: false,
          },
          {
            name: 'tamanho',
            type: 'number',
            required: false,
          },
          {
            name: 'mime_type',
            type: 'text',
            required: false,
          },
          {
            name: 'criado_por_id',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_anexos_oportunidade ON anexos (oportunidade_id)',
          'CREATE INDEX idx_anexos_marca ON anexos (marca_id)',
        ],
      })

      app.save(anexosCol)
    }
  },
  (app) => {
    try {
      const anexosCol = app.findCollectionByNameOrId('anexos')
      app.delete(anexosCol)
    } catch (_) {}
  },
)
