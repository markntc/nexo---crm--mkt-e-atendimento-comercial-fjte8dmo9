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

export interface Funil {
  id: string
  marca_id: string
  equipe_id?: string
  nome_funil: string
  etapas_ordenadas: string[]
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
    equipe_id?: Equipe
  }
}

export interface ClienteB2B {
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
  }
}

export interface ClienteB2C {
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
  created: string
  updated: string
  expand?: {
    marca_captura_id?: Marca
  }
}

export interface Contato {
  id: string
  cliente_b2b_id?: string
  consumidor_b2c_id?: string
  cargo?: string
  departamento?: string
  created: string
  updated: string
  expand?: {
    cliente_b2b_id?: ClienteB2B
    consumidor_b2c_id?: ClienteB2C
  }
}

export interface Lead {
  id: string
  marca_id: string
  origem:
    | 'Formulário Web'
    | 'Landing Page'
    | 'Indicação'
    | 'WhatsApp'
    | 'Feira'
    | 'Importação'
    | 'Outro'
  dados_contato: string
  status_qualificacao: 'Novo' | 'Qualificado' | 'Desqualificado' | 'Convertido'
  cliente_b2b_id?: string
  cliente_b2c_id?: string
  criado_por_id?: string
  created: string
  updated: string
  expand?: {
    marca_id?: Marca
    cliente_b2b_id?: ClienteB2B
    cliente_b2c_id?: ClienteB2C
  }
}

export interface Oportunidade {
  id: string
  marca_id: string
  funil_id: string
  equipe_id?: string
  cliente_b2b_id?: string
  cliente_b2c_id?: string
  titulo: string
  valor_estimado: number
  etapa_atual: string
  vendedor_id: string
  proxima_acao_data?: string
  proxima_acao_descricao?: string
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
    cliente_b2b_id?: ClienteB2B
    cliente_b2c_id?: ClienteB2C
    vendedor_id?: { id: string; name: string; email: string }
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
    cliente_b2b_id?: ClienteB2B
    cliente_b2c_id?: ClienteB2C
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
    cliente_b2b_id_1?: ClienteB2B
    cliente_b2c_id_1?: ClienteB2C
    cliente_b2b_id_2?: ClienteB2B
    cliente_b2c_id_2?: ClienteB2C
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
