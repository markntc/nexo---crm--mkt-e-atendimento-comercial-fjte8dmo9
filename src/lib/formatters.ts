// src/lib/formatters.ts

/**
 * Formata um número em moeda brasileira (BRL)
 * Exemplo: 1234.56 -> "R$ 1.234,56"
 */
export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00'
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Extrai data pura no formato AAAA-MM-DD a partir de qualquer string de data válida
 * (compatível com AAAA-MM-DD, AAAA-MM-DD HH:MM:SS.000Z e DD/MM/AAAA)
 */
export function extractPureDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const trimmed = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10)
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    const parts = trimmed.substring(0, 10).split('/')
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  // Fallback caso venha em outro formato parseável
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

/**
 * Retorna a diferença em dias corridos entre uma data (pura ou string) e hoje (fuso local do navegador).
 * - diffDays < 0: anterior a hoje (ontem ou antes = vencido)
 * - diffDays === 0: hoje
 * - diffDays === 1: amanhã
 * - diffDays === 2: depois de amanhã (até 48h)
 * - diffDays > 2: futuro
 */
export function getDiffDaysFromToday(dateInput?: string | null): number | null {
  if (!dateInput) return null
  const pure = extractPureDate(dateInput)
  if (!pure) return null
  const [y, m, d] = pure.substring(0, 10).split('-').map(Number)
  const targetDate = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffTime = targetDate.getTime() - today.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

export function formatDateBR(dateStr: string | null | undefined, includeTime = false): string {
  if (!dateStr) return '—'
  try {
    const trimmed = dateStr.trim()
    // Quando não inclui hora e possui prefixo AAAA-MM-DD, formata diretamente sem conversão de fuso
    if (!includeTime && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const pure = trimmed.substring(0, 10)
      const parts = pure.split('-')
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
    }
    const d = new Date(trimmed)
    if (isNaN(d.getTime())) return '—'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    if (!includeTime) {
      return `${day}/${month}/${year}`
    }
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch {
    return '—'
  }
}

/**
 * Validação formal de CNPJ com cálculo dos dois dígitos verificadores
 */
export function isValidCNPJ(cnpjRaw: string): boolean {
  if (!cnpjRaw) return false
  const cnpj = cnpjRaw.replace(/\D/g, '')
  if (cnpj.length !== 14) return false

  // Rejeita sequências de dígitos iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  // Primeiro dígito verificador
  let tamanho = cnpj.length - 2
  let numeros = cnpj.substring(0, tamanho)
  const digitos = cnpj.substring(tamanho)
  let soma = 0
  let pos = tamanho - 7
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false

  // Segundo dígito verificador
  tamanho = tamanho + 1
  numeros = cnpj.substring(0, tamanho)
  soma = 0
  pos = tamanho - 7
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false

  return true
}

/**
 * Validação formal de CPF com cálculo dos dígitos verificadores
 */
export function isValidCPF(cpfRaw: string): boolean {
  if (!cpfRaw) return false
  const cpf = cpfRaw.replace(/\D/g, '')
  if (cpf.length !== 11) return false

  // Rejeita sequências de dígitos iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let soma = 0
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i), 10) * (11 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(9, 10), 10)) return false

  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i), 10) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(10, 11), 10)) return false

  return true
}

/**
 * Máscara formatada para CNPJ (00.000.000/0000-00)
 */
export function onlyDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '')
}

export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/**
 * Máscara formatada para CPF (000.000.000-00)
 */
export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

/**
 * Máscara formatada para Telefone (BR)
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

/**
 * Checa status do follow up:
 * 'overdue' (vencido), 'soon' (dentro de 48h), 'ok', ou 'missing' (sem follow-up)
 */
export function getFollowUpStatus(dateStr?: string | null): 'missing' | 'overdue' | 'soon' | 'ok' {
  if (!dateStr) return 'missing'
  const pure = extractPureDate(dateStr)
  if (!pure) return 'missing'

  // Comparação pura de dias calendário sem contaminação de fuso horário UTC:
  // - Vencido (overdue): somente se a data do follow-up for estritamente anterior a hoje (diffDays < 0)
  // - Em 48h (soon): hoje, amanhã ou depois de amanhã (0 <= diffDays <= 2)
  // - Em dia (ok): a partir de 3 dias no futuro (diffDays > 2)
  const diffDays = getDiffDaysFromToday(pure)
  if (diffDays === null) return 'missing'
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 2) return 'soon'
  return 'ok'
}
