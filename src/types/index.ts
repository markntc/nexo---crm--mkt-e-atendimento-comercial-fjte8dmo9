// src/types/index.ts

export interface Marca {
  id: string
  nome: string
  slug: string
  ativo: boolean
  cor_destaque: string
  created: string
  updated: string
}

export interface Equipe {
  id: string
  marca_id: string
  nome_equipe: string
  lider_usuario_id?: string
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
  }
}

export interface EtapaConfig {
  nome: string
  valor_referencia?: number
  is_won?: boolean
  is_lost?: boolean
}

export type EtapaItem = string | EtapaConfig

export interface Funil {
  id: string
  marca_id: string
  equipe_id?: string
  nome_funil: string
  etapas_ordenadas: EtapaItem[]
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
    equipe_id?: Equipe
  }
}

export type PerfilGlobal =
  | 'Administrador'
  | 'Supervisor'
  | 'Vendedor'
  | 'Diretoria'
  | 'Representante'
export type PapelMarca =
  | 'Vendedor'
  | 'Supervisor'
  | 'Administrador de marca'
  | 'Diretoria'
  | 'Representante'

export interface PermissoesUsuario {
  marcas_permitidas?: string[]
  papeis_por_marca?: Record<string, PapelMarca>
  escopo_visibilidade?: 'proprios' | 'equipe' | 'marca_inteira'
  pode_conciliar?: boolean
  pode_importar?: boolean
}

export interface Usuario {
  id: string
  email: string
  name: string
  avatar?: string
  ativo?: boolean
  perfil_global?: PerfilGlobal
  permissoes?: PermissoesUsuario
  created: string
  updated: string
}

export interface ConviteUsuario {
  id: string
  nome: string
  email: string
  perfil_global: PerfilGlobal
  permissoes?: PermissoesUsuario
  status: 'Pendente' | 'Aceito' | 'Cancelado'
  convidado_por_id?: string
  created: string
  updated: string
  expand?: {
    convidado_por_id?: Usuario
  }
}

// Entidade de Relacionamento B2B
export interface Organizacao {
  id: string
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  inscricao_estadual?: string
  endereco_corporativo?: string
  email_principal?: string
  telefone?: string
  marca_captura_id: string
  origem_sistema?: string
  data_criacao?: string
  id_origem_externa?: string
  criado_por_id?: string
  created: string
  updated: string
  expand?: {
    marca_captura_id?: Marca
    criado_por_id?: { id: string; name: string; email: string }
  }
}

// Retrocompatibilidade temporária de tipo
export type ClienteB2B = Organizacao

// Entidade de Relacionamento B2C / Pessoa de Contato
export interface Pessoa {
  id: string
  cpf: string
  nome_completo: string
  email_principal?: string
  telefone?: string
  marca_captura_id: string
  origem_sistema?: string
  data_criacao?: string
  id_origem_externa?: string
  criado_por_id?: string
  organizacao_id?: string
  cargo?: string
  departamento?: string
  endereco_residencial?: string
  created: string
  updated: string
  expand?: {
    marca_captura_id?: Marca
    organizacao_id?: Organizacao
    criado_por_id?: { id: string; name: string; email: string }
  }
}

// Retrocompatibilidade temporária de tipo
export type ClienteB2C = Pessoa

// Tipo derivado de status de relacionamento comercial (FRENTE 3)
export type StatusRelacionamento = 'Cliente' | 'Prospect'

// Classificação de negócio para CRM: Cliente novo x Recompra
export type TipoClienteNegocio = 'Cliente novo' | 'Recompra'

export interface Lead {
  id: string
  marca_id?: string
  marca_origem_id?: string
  origem:
    | 'Formulário Web'
    | 'Landing Page'
    | 'Indicação'
    | 'WhatsApp'
    | 'Chat / WhatsApp'
    | 'Feira'
    | 'Evento / Feira'
    | 'Campanha Paga'
    | 'Prospecção Ativa'
    | 'Importação'
    | 'Outro'
  dados_contato: string
  cidade?: string
  estado?: string
  pais?: string
  status_qualificacao: 'Novo' | 'Qualificado' | 'Desqualificado' | 'Descartado' | 'Convertido'
  cliente_b2b_id?: string
  cliente_b2c_id?: string
  convertido_para_id?: string
  criado_por_id?: string
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
    marca_origem_id?: Marca
    convertido_para_id?: Oportunidade
    cliente_b2b_id?: Organizacao
    cliente_b2c_id?: Pessoa
  }
}

export type DocumentoFaturamento = 'CPF' | 'CNPJ' | 'AMBOS'

export interface Oportunidade {
  id: string
  marca_id: string
  funil_id: string
  equipe_id?: string
  cliente_b2b_id?: string
  cliente_b2c_id?: string
  organizacao_id?: string
  pessoa_id?: string
  titulo: string
  valor_estimado: number
  etapa_atual: string
  vendedor_id: string
  proxima_acao_data?: string
  proxima_acao_descricao?: string
  documento_faturamento?: DocumentoFaturamento
  data_fechamento_esperada?: string
  tipo_cliente?: TipoClienteNegocio
  lead_origem_id?: string
  observacoes?: string
  cidade?: string
  estado?: string
  pais?: string
  cidade_entrega?: string
  estado_entrega?: string
  origem?: string
  campos_exportacao?: {
    moeda?: string
    incoterm?: string
    idioma?: string
    documentos?: string[]
  }
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
    funil_id?: Funil
    equipe_id?: Equipe
    cliente_b2b_id?: Organizacao
    cliente_b2c_id?: Pessoa
    organizacao_id?: Organizacao
    pessoa_id?: Pessoa
    vendedor_id?: { id: string; name: string; email: string }
    lead_origem_id?: Lead
  }
}

export interface Atividade {
  id: string
  marca_id: string
  oportunidade_id: string
  responsavel_id: string
  tipo: 'Ligação' | 'Reunião' | 'Visita' | 'E-mail' | 'WhatsApp' | 'Outro'
  descricao?: string
  data_vencimento: string
  concluida: boolean
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
    oportunidade_id?: Oportunidade
    responsavel_id?: { id: string; name: string; email: string }
  }
}

export interface PreferenciaComunicacao {
  id: string
  cliente_b2b_id?: string
  cliente_b2c_id?: string
  marca_id: string
  canal: 'E-mail' | 'WhatsApp' | 'Telefone' | 'SMS'
  status_consentimento: 'Opt-in' | 'Opt-out'
  data_atualizacao?: string
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
    cliente_b2b_id?: Organizacao
    cliente_b2c_id?: Pessoa
  }
}

export interface Duplicidade {
  id: string
  cliente_b2b_id_1?: string
  cliente_b2c_id_1?: string
  cliente_b2b_id_2?: string
  cliente_b2c_id_2?: string
  tipo_divergencia: 'CNPJ Similar' | 'CPF Similar' | 'Homonímia' | 'E-mail Duplicado' | 'Outro'
  status: 'Aberta' | 'Em Revisão' | 'Resolvida' | 'Bloqueada'
  observacoes?: string
  created: string
  updated: string
  expand?: {
    cliente_b2b_id_1?: Organizacao
    cliente_b2c_id_1?: Pessoa
    cliente_b2b_id_2?: Organizacao
    cliente_b2c_id_2?: Pessoa
  }
}

export interface LogAuditoria {
  id: string
  marca_id?: string
  usuario_id?: string
  entidade: string
  entidade_id: string
  dados_anteriores?: Record<string, unknown>
  dados_novos?: Record<string, unknown>
  timestamp?: string
  created: string
  updated: string
}
