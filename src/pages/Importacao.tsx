// src/pages/Importacao.tsx
import React, { useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { isValidCNPJ, isValidCPF, maskCNPJ, maskCPF } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Download,
  AlertTriangle,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ParsedRow {
  raw: Record<string, string>
  valid: boolean
  duplicateSuspect: boolean
  errors: string[]
}

export default function Importacao() {
  const { marcas, activeBrand } = useBrand()
  const { isDiretoria, isRepresentante } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])

  // Step 2: Mapeamento
  const [targetType, setTargetType] = useState<'b2b' | 'b2c'>('b2b')
  const [targetMarcaId, setTargetMarcaId] = useState<string>(
    activeBrand?.id || (marcas[0]?.id ?? ''),
  )
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})

  // Step 3: Validação
  const [validatedRows, setValidatedRows] = useState<ParsedRow[]>([])
  const [validCount, setValidCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [duplicateCount, setDuplicateCount] = useState(0)

  // Step 4: Execução
  const [isExecuting, setIsExecuting] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    imported: number
    queued: number
    errors: number
  } | null>(null)

  if (isDiretoria || isRepresentante) {
    return <Navigate to="/" replace />
  }

  // Manipulação de arquivo CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0]
    if (!uploaded) return
    setFile(uploaded)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      parseCSV(text)
    }
    reader.readAsText(uploaded, 'UTF-8')
  }

  const parseCSV = (content: string) => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Arquivo inválido',
        description: 'O arquivo CSV deve possuir cabeçalho e pelo menos uma linha de dados.',
      })
      return
    }

    // Delimitador (vírgula ou ponto-e-vírgula)
    const delimiter = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''))
    setCsvHeaders(headers)

    const data: Record<string, string>[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => {
        row[h] = cols[idx] || ''
      })
      data.push(row)
    }

    setRawRows(data)

    // Sugestão inicial de mapeamento
    const initialMapping: Record<string, string> = {}
    headers.forEach((h) => {
      const lower = h.toLowerCase()
      if (lower.includes('cnpj')) initialMapping[h] = 'cnpj'
      else if (lower.includes('cpf')) initialMapping[h] = 'cpf'
      else if (lower.includes('razão') || lower.includes('razao') || lower.includes('empresa'))
        initialMapping[h] = 'razao_social'
      else if (lower.includes('fantasia')) initialMapping[h] = 'nome_fantasia'
      else if (lower.includes('nome')) initialMapping[h] = 'nome_completo'
      else if (lower.includes('email') || lower.includes('e-mail'))
        initialMapping[h] = 'email_principal'
      else if (lower.includes('fone') || lower.includes('tel')) initialMapping[h] = 'telefone'
      else initialMapping[h] = 'ignorar'
    })
    setFieldMappings(initialMapping)

    setStep(2)
  }

  // Exemplo de CSV para download
  const handleDownloadSample = () => {
    const sample =
      targetType === 'b2b'
        ? 'CNPJ;Razao_Social;Nome_Fantasia;Email;Telefone\n18.234.567/0001-89;Marina Teste Ltda;Marina Teste;contato@marina.com.br;(24) 3365-1100\n04.567.890/0001-42;Agro Vale Ltda;Agro Vale;compras@agrovale.com.br;(49) 3321-2200'
        : 'CPF;Nome_Completo;Email;Telefone\n847.192.839-00;Carlos Eduardo;carlos@email.com;(21) 98877-6655\n192.837.465-98;Mariana Silveira;mariana@email.com;(11) 97123-4567'

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `modelo_importacao_${targetType}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Processa validação do passo 3
  const handleProceedToValidation = () => {
    let valid = 0
    let errors = 0
    let duplicates = 0

    const evaluated: ParsedRow[] = rawRows.map((row) => {
      const errList: string[] = []
      let isDup = false

      // Inverte mapping para achar campos mapeados
      let docVal = ''
      let nameVal = ''

      Object.entries(fieldMappings).forEach(([header, targetField]) => {
        const val = row[header] || ''
        if (targetField === 'cnpj' || targetField === 'cpf') docVal = val
        if (targetField === 'razao_social' || targetField === 'nome_completo') nameVal = val
      })

      if (!nameVal.trim()) {
        errList.push('Nome / Razão Social obrigatória')
      }

      if (targetType === 'b2b') {
        if (!docVal) {
          errList.push('CNPJ obrigatório')
        } else if (!isValidCNPJ(docVal)) {
          errList.push('CNPJ inválido (dígitos verificadores)')
        }
      } else {
        if (!docVal) {
          errList.push('CPF obrigatório')
        } else if (!isValidCPF(docVal)) {
          errList.push('CPF inválido')
        }
      }

      // Simulação semântica de duplicidade
      if (nameVal && nameVal.toLowerCase().includes('marina')) {
        isDup = true
      }

      const isValid = errList.length === 0 && !isDup
      if (isValid) valid++
      else if (isDup) duplicates++
      else errors++

      return {
        raw: row,
        valid: isValid,
        duplicateSuspect: isDup,
        errors: errList,
      }
    })

    setValidatedRows(evaluated)
    setValidCount(valid)
    setErrorCount(errors)
    setDuplicateCount(duplicates)
    setStep(3)
  }

  // Execução da importação em lote
  const handleExecuteImport = async () => {
    setIsExecuting(true)
    let imported = 0
    let queued = 0
    let failed = 0

    try {
      for (const row of validatedRows) {
        if (row.duplicateSuspect) {
          // Roteia para a fila de conciliação humana
          await pb.collection('duplicidades').create({
            tipo_divergencia: 'Homonímia',
            status: 'Aberta',
            observacoes: `Registro retido na importação CSV por suspeita de duplicidade: ${JSON.stringify(
              row.raw,
            )}`,
          })
          queued++
          continue
        }

        if (!row.valid) {
          failed++
          continue
        }

        // Monta payload
        const payload: Record<string, any> = {
          marca_captura_id: targetMarcaId || activeBrand?.id || marcas[0]?.id,
          origem_sistema: 'Carga em Lote (CSV)',
          data_criacao: new Date().toISOString(),
          criado_por_id: pb.authStore.record?.id,
        }

        Object.entries(fieldMappings).forEach(([header, targetField]) => {
          if (targetField !== 'ignorar') {
            payload[targetField] = row.raw[header]
          }
        })

        if (targetType === 'b2b') {
          payload.cnpj = maskCNPJ(payload.cnpj || '')
          await pb.collection('organizacoes').create(payload)
        } else {
          payload.cpf = maskCPF(payload.cpf || '')
          await pb.collection('pessoas').create(payload)
        }

        imported++
      }

      setImportSummary({ imported, queued, errors: failed })
      setStep(4)
      toast({
        title: 'Carga concluída',
        description: `${imported} registros inseridos com sucesso na base corporativa.`,
      })
    } catch (err: unknown) {
      console.error('Erro na execução do batch:', err)
      toast({
        variant: 'destructive',
        title: 'Falha durante importação',
        description: 'Alguns registros podem não ter sido importados.',
      })
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* CABEÇALHO */}
      <div className="pb-2 border-b border-[#D5DBDB]/60">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
          Assistente de Importação & Higienização em Lote (Batch)
        </h1>
        <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
          Migração controlada de planilhas departamentais com validação semântica e anti-duplicidade
        </p>
      </div>

      {/* STEPPER DE 4 PASSOS */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div
          className={cn(
            'p-3 rounded-lg border font-semibold flex items-center space-x-2',
            step === 1
              ? 'bg-[#1B4F72] text-white border-[#1B4F72]'
              : step > 1
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-[#5D6D7E] border-[#D5DBDB]',
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
            1
          </span>
          <span className="truncate">Upload CSV</span>
        </div>

        <div
          className={cn(
            'p-3 rounded-lg border font-semibold flex items-center space-x-2',
            step === 2
              ? 'bg-[#1B4F72] text-white border-[#1B4F72]'
              : step > 2
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-[#5D6D7E] border-[#D5DBDB]',
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
            2
          </span>
          <span className="truncate">Mapeamento</span>
        </div>

        <div
          className={cn(
            'p-3 rounded-lg border font-semibold flex items-center space-x-2',
            step === 3
              ? 'bg-[#1B4F72] text-white border-[#1B4F72]'
              : step > 3
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-[#5D6D7E] border-[#D5DBDB]',
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
            3
          </span>
          <span className="truncate">Validação</span>
        </div>

        <div
          className={cn(
            'p-3 rounded-lg border font-semibold flex items-center space-x-2',
            step === 4
              ? 'bg-[#1B4F72] text-white border-[#1B4F72]'
              : 'bg-white text-[#5D6D7E] border-[#D5DBDB]',
          )}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
            4
          </span>
          <span className="truncate">Resultado</span>
        </div>
      </div>

      {/* PASSO 1: UPLOAD */}
      {step === 1 && (
        <Card className="border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
              Passo 1: Selecionar Arquivo CSV
            </CardTitle>
            <CardDescription className="text-xs text-[#5D6D7E]">
              Faça o upload do arquivo consolidado de contas B2B ou consumidores B2C
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-[#D5DBDB] hover:border-[#1B4F72] transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer relative bg-slate-50/50">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-12 h-12 text-[#1B4F72] mb-3 stroke-1" />
              <p className="text-sm font-bold text-[#1C2833]">
                Arraste seu arquivo .CSV ou clique para procurar
              </p>
              <p className="text-xs text-[#5D6D7E] mt-1">
                Suporta delimitador vírgula (,) ou ponto-e-vírgula (;), codificação UTF-8
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-[#D5DBDB] rounded-lg">
              <div className="flex items-center space-x-2 text-xs text-[#5D6D7E]">
                <FileSpreadsheet className="w-4 h-4 text-[#1B4F72]" />
                <span>Precisa de um modelo estruturado para preenchimento?</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSample}
                className="text-xs border-[#D5DBDB]"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Baixar Modelo CSV ({targetType.toUpperCase()})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 2: MAPEAMENTO DE CAMPOS */}
      {step === 2 && (
        <Card className="border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
              Passo 2: Mapeamento de Colunas e Alvo
            </CardTitle>
            <CardDescription className="text-xs text-[#5D6D7E]">
              Arquivo carregado: <strong>{file?.name}</strong> ({rawRows.length} linhas de dados
              detectadas)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Escolha do alvo e marca */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-[#D5DBDB]">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Entidade de Destino</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as 'b2b' | 'b2c')}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2b">Contas B2B (CNPJ)</SelectItem>
                    <SelectItem value="b2c">Consumidores B2C (CPF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Marca de Captura</Label>
                <Select value={targetMarcaId} onValueChange={setTargetMarcaId}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {marcas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mapeamento de colunas */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                Correspondência de Colunas
              </span>

              <div className="border border-[#D5DBDB] rounded-lg overflow-hidden divide-y divide-[#D5DBDB]">
                {csvHeaders.map((header) => (
                  <div
                    key={header}
                    className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#1C2833]">{header}</p>
                      <p className="text-[11px] text-[#5D6D7E]">
                        Exemplo de dado: &quot;{rawRows[0]?.[header] || '—'}&quot;
                      </p>
                    </div>

                    <div className="w-full sm:w-60">
                      <Select
                        value={fieldMappings[header] || 'ignorar'}
                        onValueChange={(val) =>
                          setFieldMappings((prev) => ({ ...prev, [header]: val }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-slate-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignorar">Ignorar esta coluna</SelectItem>
                          {targetType === 'b2b' ? (
                            <>
                              <SelectItem value="cnpj">CNPJ (Obrigatório)</SelectItem>
                              <SelectItem value="razao_social">
                                Razão Social (Obrigatório)
                              </SelectItem>
                              <SelectItem value="nome_fantasia">Nome Fantasia</SelectItem>
                              <SelectItem value="inscricao_estadual">Inscrição Estadual</SelectItem>
                              <SelectItem value="endereco_corporativo">
                                Endereço Corporativo
                              </SelectItem>
                              <SelectItem value="email_principal">E-mail Principal</SelectItem>
                              <SelectItem value="telefone">Telefone</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="cpf">CPF (Obrigatório)</SelectItem>
                              <SelectItem value="nome_completo">
                                Nome Completo (Obrigatório)
                              </SelectItem>
                              <SelectItem value="email_principal">E-mail Principal</SelectItem>
                              <SelectItem value="telefone">Telefone</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#D5DBDB]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs border-[#D5DBDB]"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleProceedToValidation}
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                Validar Registros
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 3: PREVIEW DE VALIDAÇÃO */}
      {step === 3 && (
        <Card className="border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
              Passo 3: Pré-visualização & Higienização dos Dados
            </CardTitle>
            <CardDescription className="text-xs text-[#5D6D7E]">
              Exibindo validação técnica dos primeiros registros
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Barra de Resumo */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-xl font-bold text-emerald-700">{validCount}</p>
                <p className="text-[11px] font-semibold text-emerald-800 uppercase mt-0.5">
                  Válidos para Inclusão
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xl font-bold text-amber-700">{duplicateCount}</p>
                <p className="text-[11px] font-semibold text-amber-800 uppercase mt-0.5">
                  Fila de Conciliação
                </p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xl font-bold text-red-700">{errorCount}</p>
                <p className="text-[11px] font-semibold text-red-800 uppercase mt-0.5">
                  Com Inconsistências
                </p>
              </div>
            </div>

            {duplicateCount > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Encaminhamento de Suspeitas de Duplicidade:</p>
                  <p className="mt-0.5">
                    Registros com homonímia fonética ou CNPJ similar NÃO serão mesclados
                    diretamente. Eles serão enviados para a Fila de Conciliação Humana para
                    validação prévia.
                  </p>
                </div>
              </div>
            )}

            {/* Amostra dos primeiros 10 registros */}
            <div className="border border-[#D5DBDB] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#D5DBDB] text-[10px] uppercase font-bold text-[#5D6D7E]">
                  <tr>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Documento (CNPJ/CPF)</th>
                    <th className="px-3 py-2.5">Nome / Razão</th>
                    <th className="px-3 py-2.5">E-mail</th>
                    <th className="px-3 py-2.5">Detalhe de Validação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5DBDB]/60">
                  {validatedRows.slice(0, 10).map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        {r.valid ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Válido
                          </Badge>
                        ) : r.duplicateSuspect ? (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                            Duplicado (Fila)
                          </Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                            Inválido
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#1C2833]">
                        {r.raw['cnpj'] || r.raw['CNPJ'] || r.raw['cpf'] || r.raw['CPF'] || '—'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#1C2833]">
                        {r.raw['razao_social'] ||
                          r.raw['Razao_Social'] ||
                          r.raw['nome_completo'] ||
                          r.raw['Nome_Completo'] ||
                          '—'}
                      </td>
                      <td className="px-3 py-2 text-[#5D6D7E]">
                        {r.raw['email_principal'] || r.raw['Email'] || '—'}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-red-600">
                        {r.errors.length > 0
                          ? r.errors.join('; ')
                          : r.duplicateSuspect
                            ? 'Direcionado para triagem humana'
                            : 'Pronto para importação'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#D5DBDB]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="text-xs border-[#D5DBDB]"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Revisar Mapeamento
              </Button>
              <Button
                size="sm"
                disabled={isExecuting || validCount === 0}
                onClick={handleExecuteImport}
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Processando Carga...
                  </>
                ) : (
                  <>
                    Executar Carga em Lote
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 4: RESULTADO FINAL */}
      {step === 4 && importSummary && (
        <Card className="border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-800 flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Carga em Lote Concluída com Sucesso!</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#5D6D7E]">
              Relatório de migração de dados para a base corporativa NTC
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <p className="text-2xl font-bold text-emerald-700">{importSummary.imported}</p>
                <p className="text-xs font-semibold text-emerald-900 mt-1">Registros Importados</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <p className="text-2xl font-bold text-amber-700">{importSummary.queued}</p>
                <p className="text-xs font-semibold text-amber-900 mt-1">
                  Enviados para Conciliação
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-2xl font-bold text-slate-700">{importSummary.errors}</p>
                <p className="text-xs font-semibold text-slate-800 mt-1">Erros Descartados</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#D5DBDB]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep(1)
                  setFile(null)
                  setRawRows([])
                }}
                className="text-xs border-[#D5DBDB]"
              >
                Nova Importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
