// src/services/anexos.ts
import pb from '@/lib/pocketbase/client'
import type { AnexoOportunidade } from '@/types'

/**
 * Retorna a lista de anexos vinculados a uma oportunidade específica
 */
export async function listarAnexosOportunidade(
  oportunidadeId: string,
): Promise<AnexoOportunidade[]> {
  if (!oportunidadeId) return []
  return pb.collection('anexos').getFullList<AnexoOportunidade>({
    filter: `oportunidade_id = "${oportunidadeId}"`,
    sort: '-created',
    expand: 'criado_por_id,marca_id',
    requestKey: null,
  })
}

/**
 * Faz o upload de um arquivo vinculado a uma oportunidade
 */
export async function uploadAnexoOportunidade({
  oportunidadeId,
  marcaId,
  file,
  criadoPorId,
}: {
  oportunidadeId: string
  marcaId?: string
  file: File
  criadoPorId?: string
}): Promise<AnexoOportunidade> {
  const formData = new FormData()
  formData.append('oportunidade_id', oportunidadeId)
  if (marcaId) formData.append('marca_id', marcaId)
  if (criadoPorId) formData.append('criado_por_id', criadoPorId)
  formData.append('nome_original', file.name)
  formData.append('tamanho', String(file.size))
  formData.append('mime_type', file.type || 'application/octet-stream')
  formData.append('arquivo', file)

  return pb.collection('anexos').create<AnexoOportunidade>(formData, {
    expand: 'criado_por_id,marca_id',
  })
}

/**
 * Remove um anexo pelo seu ID
 */
export async function excluirAnexo(anexoId: string): Promise<boolean> {
  await pb.collection('anexos').delete(anexoId)
  return true
}

/**
 * Gera a URL para download ou visualização do arquivo no PocketBase
 */
export function getAnexoFileUrl(
  anexo: AnexoOportunidade,
  options?: { download?: boolean },
): string {
  if (!anexo || !anexo.arquivo) return ''
  const base = pb.files.getURL(anexo, anexo.arquivo, {
    download: options?.download ? true : undefined,
  })
  return base
}

/**
 * Formata o tamanho de arquivos em bytes para formato legível (KB, MB)
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
