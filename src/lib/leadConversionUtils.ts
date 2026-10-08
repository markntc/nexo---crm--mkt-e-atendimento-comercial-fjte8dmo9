// src/lib/leadConversionUtils.ts
// Utilitários canônicos para conversão de leads em oportunidades e contatos no padrão Pipedrive NTC

import { Lead } from '@/types'
import { extrairCidadeEstado, extrairLocalInstalacao } from './geoUtils'

export interface LeadDealInitialValues {
  titulo: string
  cliente_b2b_id?: string
  cliente_b2c_id?: string
  organizacao_id?: string
  pessoa_id?: string
  lead_origem_id: string
  origem: string
  cidade?: string
  estado?: string
  pais?: string
  cidade_entrega?: string
  estado_entrega?: string
  pais_entrega?: string
  observacoes?: string
  proxima_acao_descricao?: string
  // Dados de contato pré-preenchidos para nova pessoa inline
  contato_nome?: string
  contato_email?: string
  contato_telefone?: string
}

/**
 * Extrai nome, e-mail e telefone de strings livres de dados de contato.
 * Exemplo: "Ricardo Torres - Eng. de Produto, EletroTech (ricardo@electrotech.com.br / (19) 99123-8899)"
 */
export function extrairContatoDeLead(dadosContato?: string | null): {
  nome: string
  email: string
  telefone: string
} {
  if (!dadosContato || !dadosContato.trim()) {
    return { nome: '', email: '', telefone: '' }
  }

  const str = dadosContato.trim()

  // 1. Extrai e-mail se presente
  let email = ''
  const emailMatch = str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
  if (emailMatch) {
    email = emailMatch[1].trim()
  }

  // 2. Extrai telefone brasileiro se presente: (XX) XXXXX-XXXX ou XX 9XXXX-XXXX
  let telefone = ''
  const phoneMatch = str.match(/(?:\(?([0-9]{2})\)?\s*)?(?:9\s*)?[0-9]{4,5}[-\s.]?[0-9]{4}/)
  if (phoneMatch) {
    telefone = phoneMatch[0].trim()
  }

  // 3. Extrai nome: pega a parte antes do primeiro hífen, vírgula, barra ou parênteses
  let nome = str
  // Remove parênteses com contatos
  nome = nome.replace(/\([^)]*\)/g, '').trim()
  // Pega antes de separadores comuns como " - ", " / ", " | "
  const partes = nome.split(/\s*[-/|]\s*/)
  if (partes.length > 0 && partes[0].trim()) {
    nome = partes[0].trim()
  }

  // Remove eventuais prefixos como "Nome:" ou "Contato:"
  nome = nome.replace(/^(?:nome|contato|cliente)\s*:\s*/i, '').trim()

  return {
    nome: nome || str,
    email,
    telefone,
  }
}

/**
 * Constrói o título canônico da oportunidade derivada do lead.
 * Padrão Pierplas: "Site Pierplas #NNNN – Nome" quando o lead veio do site ou marca Pierplas;
 * Caso contrário, usa o nome do contato ou "Negócio - Nome".
 */
export function gerarTituloLeadDeal(lead: Lead, marcaSlugOuNome?: string): string {
  const contato = extrairContatoDeLead(lead.dados_contato)
  const nomeContato = contato.nome || lead.dados_contato.slice(0, 30)

  // Extrai número amigável de 4 a 6 dígitos baseado no ID do lead
  const numId = lead.id.replace(/\D/g, '').slice(-4).padStart(4, '1')

  const isPierplas =
    (marcaSlugOuNome && /pierplas/i.test(marcaSlugOuNome)) ||
    (lead.expand?.marca_id?.nome && /pierplas/i.test(lead.expand.marca_id.nome)) ||
    (lead.expand?.marca_origem_id?.nome && /pierplas/i.test(lead.expand.marca_origem_id.nome)) ||
    (lead.origem === 'Formulário Web' &&
      (lead.marca_id === 'miglxzi2xmf3pmi' || lead.marca_origem_id === 'miglxzi2xmf3pmi'))

  const isFormWeb =
    lead.origem === 'Formulário Web' ||
    lead.origem === 'Landing Page' ||
    /site|formulario|formulário|web/i.test(lead.origem)

  if (isPierplas || (isFormWeb && /pierplas/i.test(marcaSlugOuNome || ''))) {
    return `Site Pierplas #${numId} – ${nomeContato}`
  }

  return nomeContato
}

/**
 * Prepara o objeto initialValues para passar ao AddDealModal a partir de um Lead.
 */
export function prepararInitialValuesDeLead(
  lead: Lead,
  marcaSlugOuNome?: string,
): LeadDealInitialValues {
  const titulo = gerarTituloLeadDeal(lead, marcaSlugOuNome)
  const contato = extrairContatoDeLead(lead.dados_contato)

  // Faturamento: cidade/estado/pais do lead ou extraído do texto de contato
  let cidFat = lead.cidade || ''
  let estFat = lead.estado || ''
  let paisFat = lead.pais || 'Brasil'

  if (!cidFat && !estFat && lead.dados_contato) {
    const locExt = extrairCidadeEstado(lead.dados_contato)
    if (locExt.cidade) cidFat = locExt.cidade
    if (locExt.estado) estFat = locExt.estado
    if (locExt.pais) paisFat = locExt.pais
  }

  // Entrega: extrai de possíveis marcadores "Local de instalação:" ou "Entrega:"
  const localInst = extrairLocalInstalacao(lead.dados_contato)
  let cidEnt = localInst.cidadeEntrega || cidFat
  let estEnt = localInst.estadoEntrega || estFat
  let paisEnt = localInst.paisEntrega || paisFat

  // Observações
  let obsFinal = ''
  if (localInst.observacaoInstalacao) {
    obsFinal = localInst.observacaoInstalacao
  }

  // Vínculos existentes
  const b2bId = lead.cliente_b2b_id || undefined
  const b2cId = lead.cliente_b2c_id || undefined

  return {
    titulo,
    cliente_b2b_id: b2bId,
    cliente_b2c_id: b2cId,
    organizacao_id: b2bId,
    pessoa_id: b2cId,
    lead_origem_id: lead.id,
    origem: lead.origem || 'Formulário Web',
    cidade: cidFat,
    estado: estFat,
    pais: paisFat,
    cidade_entrega: cidEnt,
    estado_entrega: estEnt,
    pais_entrega: paisEnt,
    observacoes: obsFinal || undefined,
    proxima_acao_descricao: 'Primeiro contato com lead qualificado',
    contato_nome: contato.nome,
    contato_email: contato.email,
    contato_telefone: contato.telefone,
  }
}
