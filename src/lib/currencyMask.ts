/**
 * src/lib/currencyMask.ts
 *
 * Utilitário de máscara de moeda em tempo real (pt-BR / BRL).
 *
 * Comportamento exigido:
 * - Estilo máquina registradora / maquininha (PagSeguro, Mercado Livre):
 *   conforme o usuário digita dígitos, as duas últimas casas correspondem a centavos,
 *   e as anteriores ao valor inteiro com separadores de milhar (ponto).
 *   Exemplos:
 *     "1"       -> "0,01"
 *     "17"      -> "0,17"
 *     "179"     -> "1,79"
 *     "179190"  -> "1.791,90"
 *     "1791900" -> "17.919,00"
 * - Se o campo estiver vazio ("" ou apenas zeros ao apagar), retorna "" para respeitar campos opcionais.
 * - Suporta apagar (Backspace / Delete), aceita colar números.
 * - Suporta formatação inicial de valores numéricos vindos do backend (ex.: 1791.9 -> "1.791,90").
 * - Conversão segura de volta para `number` para persistência no banco (sem alterar o schema numérico).
 */

/**
 * Formata um número puro ou string de dígitos em formato monetário pt-BR (sem símbolo R$).
 * Ex: 1791.9 -> "1.791,90"
 * Ex: 0 -> "0,00" (se preserveZero: true) ou "" se false
 */
export function formatCurrencyString(
  value: number | string | null | undefined,
  options: { preserveZero?: boolean } = {},
): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (isNaN(num)) {
    return ''
  }

  if (num === 0 && !options.preserveZero) {
    return ''
  }

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Aplica máscara de moeda em tempo real a partir do valor digitado/colado pelo usuário.
 * Cada dígito novo empurra os existentes, sendo as duas últimas casas sempre centavos.
 *
 * Se todos os dígitos forem apagados ou sobrarem apenas zeros, retorna "".
 *
 * @param rawInput Valor bruto vindo do input (e.target.value)
 * @returns String formatada no padrão "1.234,56" ou ""
 */
export function maskCurrency(rawInput: string): string {
  if (!rawInput) return ''

  // Extrai apenas os dígitos numéricos
  const digits = rawInput.replace(/\D/g, '')

  // Se não há dígitos ou é tudo zero sem nada a mais, deixa vazio
  if (!digits || /^0+$/.test(digits)) {
    return ''
  }

  // Remove zeros à esquerda irrelevantes, ex: "00123" -> "123"
  const cleanDigits = digits.replace(/^0+/, '')

  // Se ficou vazio após remover zeros à esquerda
  if (!cleanDigits) {
    return ''
  }

  // Se tiver 1 dígito: "1" -> 0,01
  // Se tiver 2 dígitos: "12" -> 0,12
  // Se tiver 3+: divide os 2 últimos como centavos
  const padded = cleanDigits.padStart(3, '0')
  const integerPartRaw = padded.slice(0, -2)
  const centsPart = padded.slice(-2)

  // Formata a parte inteira com pontos de milhar
  const integerFormatted = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${integerFormatted},${centsPart}`
}

/**
 * Converte uma string formatada em moeda pt-BR para number seguro.
 * Ex: "1.791,90" -> 1791.9
 * Ex: "17.919,00" -> 17919
 * Ex: "" -> 0 (ou null se preferir)
 */
export function parseCurrencyToNumber(formattedValue: string | null | undefined): number {
  if (!formattedValue || typeof formattedValue !== 'string') {
    return 0
  }

  const trimmed = formattedValue.trim()
  if (!trimmed) return 0

  // Remove pontos de milhar e substitui vírgula por ponto
  const clean = trimmed.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(clean)

  return isNaN(num) ? 0 : num
}

/**
 * Handler utilitário para onChange de inputs com máscara de moeda.
 * Trata o novo valor e invoca o callback com o valor formatado.
 */
export function handleCurrencyInputChange(
  e: React.ChangeEvent<HTMLInputElement>,
  onChangeFormatted: (formatted: string, numeric: number) => void,
): void {
  const nextFormatted = maskCurrency(e.target.value)
  const nextNumeric = parseCurrencyToNumber(nextFormatted)
  onChangeFormatted(nextFormatted, nextNumeric)
}
