// src/pages/Conciliacao.tsx
import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import type { Duplicidade, Organizacao, Pessoa } from '@/types'
import { formatDateBR } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Building2,
  User,
  Plus,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Conciliacao() {
  const [duplicidades, setDuplicidades] = useState<Duplicidade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<Duplicidade | null>(null)

  // Modal de Confirmação de Mesclagem
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchQueue = async () => {
    setIsLoading(true)
    try {
      const res = await pb.collection('duplicidades').getFullList<Duplicidade>({
        expand: 'cliente_b2b_id_1,cliente_b2b_id_2,cliente_b2c_id_1,cliente_b2c_id_2',
        sort: '-created',
      })
      setDuplicidades(res)
      if (res.length > 0 && !selectedCase) {
        setSelectedCase(res[0])
      }
    } catch (err) {
      console.error('Erro ao buscar fila de conciliação:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const handleUpdateStatus = async (item: Duplicidade, newStatus: Duplicidade['status']) => {
    try {
      await pb.collection('duplicidades').update(item.id, {
        status: newStatus,
      })
      toast({
        title: `Status alterado para ${newStatus}`,
        description: 'Fila de revisão humana atualizada.',
      })
      fetchQueue()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    }
  }

  const handleConfirmMerge = async () => {
    if (!selectedCase) return
    setIsProcessing(true)
    try {
      // O registro primário mantém a identidade principal
      await pb.collection('duplicidades').update(selectedCase.id, {
        status: 'Resolvida',
        observacoes:
          (selectedCase.observacoes || '') + ' [Mesclagem manual homologada pelo encarregado]',
      })

      toast({
        title: 'Registros conciliados com sucesso',
        description: 'Vínculos consolidados na base única corporativa.',
      })
      setMergeModalOpen(false)
      fetchQueue()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na conciliação'
      toast({
        variant: 'destructive',
        title: 'Erro na mesclagem',
        description: msg,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getDivergenciaBadge = (tipo: Duplicidade['tipo_divergencia']) => {
    switch (tipo) {
      case 'CNPJ Similar':
      case 'CPF Similar':
        return <Badge className="bg-red-50 text-red-700 border-red-200">{tipo}</Badge>
      case 'Homonímia':
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200">{tipo}</Badge>
      case 'E-mail Duplicado':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">{tipo}</Badge>
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  const getStatusBadge = (status: Duplicidade['status']) => {
    switch (status) {
      case 'Aberta':
        return <Badge className="bg-red-100 text-red-800">Aberta</Badge>
      case 'Em Revisão':
        return <Badge className="bg-amber-100 text-amber-800">Em Revisão</Badge>
      case 'Resolvida':
        return <Badge className="bg-emerald-100 text-emerald-800">Resolvida</Badge>
      case 'Bloqueada':
        return <Badge className="bg-slate-200 text-slate-800">Bloqueada</Badge>
    }
  }

  // Extrai nomes dos lados A e B
  const getNomeLado = (item: Duplicidade, lado: 1 | 2) => {
    if (lado === 1) {
      return (
        item.expand?.cliente_b2b_id_1?.razao_social ||
        item.expand?.cliente_b2c_id_1?.nome_completo ||
        'Registro A'
      )
    }
    return (
      item.expand?.cliente_b2b_id_2?.razao_social ||
      item.expand?.cliente_b2c_id_2?.nome_completo ||
      'Registro B'
    )
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
            Fila de Conciliação e Revisão Humana de Duplicidades
          </h1>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Governança cadastral: análise assistida de divergências sem mesclagem automática
            arbitrária
          </p>
        </div>

        <Badge variant="outline" className="px-3 py-1 bg-white border-[#D5DBDB] text-xs">
          Regra Dura: Proibido mesclar por telefone
        </Badge>
      </div>

      {/* AVISO DE GOVERNANÇA LGPD / CADASTRO */}
      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start space-x-3 text-xs text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Diretriz Arquitetural NTC (Anti-Corrupção de Dados):</p>
          <p>
            É estritamente vedada a unificação automática de cadastros apoiada exclusivamente no
            número de telefone celular ou fixo, uma vez que linhas institucionais e ramais de
            compras são amplamente compartilhados no mercado B2B. Suspeitas de duplicidade devem
            passar por esta fila para julgamento do encarregado de dados.
          </p>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL: LISTA DE CASOS + PAINEL DE COMPARAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LISTA DE CASOS (4 colunas) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
              Casos Pendentes ({duplicidades.length})
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-[#5D6D7E] bg-white rounded-xl border border-[#D5DBDB]">
              <Loader2 className="w-6 h-6 animate-spin text-[#1B4F72] mx-auto mb-2" />
              Carregando fila de conciliação...
            </div>
          ) : duplicidades.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#5D6D7E] bg-white rounded-xl border border-[#D5DBDB]">
              <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-emerald-600" />
              <p className="font-semibold text-[#1C2833]">Fila de Conciliação Limpa!</p>
              <p className="text-[11px] mt-1">
                Nenhuma suspeita de duplicidade pendente de análise.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {duplicidades.map((item) => {
                const isSelected = selectedCase?.id === item.id
                const nomeA = getNomeLado(item, 1)
                const nomeB = getNomeLado(item, 2)

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedCase(item)}
                    className={cn(
                      'p-3.5 rounded-xl border bg-white shadow-xs cursor-pointer transition-all',
                      isSelected
                        ? 'border-[#1B4F72] ring-2 ring-[#1B4F72]/20 shadow-md'
                        : 'border-[#D5DBDB] hover:border-slate-400',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {getDivergenciaBadge(item.tipo_divergencia)}
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="mt-2.5 space-y-1 text-xs">
                      <div className="flex items-center space-x-1.5 text-[#1C2833] font-bold truncate">
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        <span className="truncate">{nomeA}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[#5D6D7E] font-medium truncate">
                        <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                        <span className="truncate">{nomeB}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-[#5D6D7E] mt-2">
                      Registrado em: {formatDateBR(item.created)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PAINEL DE COMPARAÇÃO LADO A LADO (7 colunas) */}
        <div className="lg:col-span-7">
          {selectedCase ? (
            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardHeader className="pb-3 border-b border-[#D5DBDB]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GitCompare className="w-5 h-5 text-[#1B4F72]" />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                      Comparação Lado a Lado
                    </CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getDivergenciaBadge(selectedCase.tipo_divergencia)}
                    {getStatusBadge(selectedCase.status)}
                  </div>
                </div>
                {selectedCase.observacoes && (
                  <CardDescription className="text-xs text-[#5D6D7E] mt-1">
                    Nota do sistema: {selectedCase.observacoes}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                {/* LADO A vs LADO B */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CANDIDATO 1 (PRIMÁRIO) */}
                  <div className="p-4 rounded-xl border-2 border-blue-100 bg-blue-50/20 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-blue-900">
                        Registro 1 (Primário)
                      </span>
                      {selectedCase.expand?.cliente_b2b_id_1 ? (
                        <Badge variant="outline" className="text-[10px] border-blue-200">
                          B2B
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-emerald-200">
                          B2C
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                          Identificação
                        </p>
                        <p className="font-bold text-[#1C2833]">{getNomeLado(selectedCase, 1)}</p>
                      </div>

                      {selectedCase.expand?.cliente_b2b_id_1 && (
                        <>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">CNPJ</p>
                            <p className="font-mono text-[#1C2833]">
                              {selectedCase.expand.cliente_b2b_id_1.cnpj}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">E-mail</p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2b_id_1.email_principal || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                              Telefone
                            </p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2b_id_1.telefone || '—'}
                            </p>
                          </div>
                        </>
                      )}

                      {selectedCase.expand?.cliente_b2c_id_1 && (
                        <>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">CPF</p>
                            <p className="font-mono text-[#1C2833]">
                              {selectedCase.expand.cliente_b2c_id_1.cpf}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">E-mail</p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2c_id_1.email_principal || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                              Telefone
                            </p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2c_id_1.telefone || '—'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* CANDIDATO 2 (SECUNDÁRIO) */}
                  <div className="p-4 rounded-xl border-2 border-amber-100 bg-amber-50/20 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-900">
                        Registro 2 (Secundário)
                      </span>
                      {selectedCase.expand?.cliente_b2b_id_2 ? (
                        <Badge variant="outline" className="text-[10px] border-blue-200">
                          B2B
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-emerald-200">
                          B2C
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                          Identificação
                        </p>
                        <p className="font-bold text-[#1C2833]">{getNomeLado(selectedCase, 2)}</p>
                      </div>

                      {selectedCase.expand?.cliente_b2b_id_2 && (
                        <>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">CNPJ</p>
                            <p className="font-mono text-[#1C2833]">
                              {selectedCase.expand.cliente_b2b_id_2.cnpj}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">E-mail</p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2b_id_2.email_principal || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                              Telefone
                            </p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2b_id_2.telefone || '—'}
                            </p>
                          </div>
                        </>
                      )}

                      {selectedCase.expand?.cliente_b2c_id_2 && (
                        <>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">CPF</p>
                            <p className="font-mono text-[#1C2833]">
                              {selectedCase.expand.cliente_b2c_id_2.cpf}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">E-mail</p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2c_id_2.email_principal || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                              Telefone
                            </p>
                            <p className="text-[#1C2833]">
                              {selectedCase.expand.cliente_b2c_id_2.telefone || '—'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* BARRA DE AÇÕES DO ENCARREGADO DE DADOS */}
                <div className="pt-4 border-t border-[#D5DBDB] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => setMergeModalOpen(true)}
                      size="sm"
                      className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
                    >
                      Mesclar Registros
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedCase, 'Resolvida')}
                      variant="outline"
                      size="sm"
                      className="text-xs border-[#D5DBDB]"
                    >
                      Manter Separados
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => handleUpdateStatus(selectedCase, 'Em Revisão')}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-amber-700 hover:bg-amber-50"
                    >
                      Em Revisão
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedCase, 'Bloqueada')}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-700 hover:bg-red-50"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1" />
                      Bloquear Mesclagem Futura
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-xl bg-white">
              Selecione um caso na lista para visualizar a comparação lado a lado.
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE MESCLAGEM */}
      <Dialog open={mergeModalOpen} onOpenChange={setMergeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Confirmar Mesclagem de Cadastros?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-[#5D6D7E]">
            <p>
              Você está prestes a unificar os registros sob a identidade do{' '}
              <strong className="text-[#1C2833]">Registro Primário (1)</strong>.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
              <p className="font-bold">Impacto da Operação:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Histórico de oportunidades e notas são transferidos para o mestre.</li>
                <li>Preferências LGPD serão consolidadas por marca.</li>
                <li>Operação append-only registrada na trilha de auditoria.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMergeModalOpen(false)}
              className="text-xs border-[#D5DBDB]"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isProcessing}
              onClick={handleConfirmMerge}
              className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
            >
              {isProcessing ? 'Processando...' : 'Confirmar Mesclagem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
