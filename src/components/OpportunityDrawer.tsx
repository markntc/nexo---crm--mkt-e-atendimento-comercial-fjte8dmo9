// src/components/OpportunityDrawer.tsx
import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import type {
  Oportunidade,
  Atividade,
  PreferenciaComunicacao,
  ClienteB2B,
  ClienteB2C,
} from '@/types'
import { formatCurrencyBRL, formatDateBR, getFollowUpStatus } from '@/lib/formatters'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  Building2,
  User,
  ShieldCheck,
  Briefcase,
  Loader2,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface OpportunityDrawerProps {
  opportunityId: string | null
  onClose: () => void
  onUpdate: () => void
}

export const OpportunityDrawer: React.FC<OpportunityDrawerProps> = ({
  opportunityId,
  onClose,
  onUpdate,
}) => {
  const [opportunity, setOpportunity] = useState<Oportunidade | null>(null)
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [preferencias, setPreferencias] = useState<PreferenciaComunicacao[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Edição inline dos dados da oportunidade
  const [isEditing, setIsEditing] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [valorEstimado, setValorEstimado] = useState<number>(0)
  const [proximaAcaoData, setProximaAcaoData] = useState('')
  const [proximaAcaoDescricao, setProximaAcaoDescricao] = useState('')

  // Modal Nova Atividade
  const [newAtivOpen, setNewAtivOpen] = useState(false)
  const [ativTipo, setAtivTipo] = useState<Atividade['tipo']>('Ligação')
  const [ativDescricao, setAtivDescricao] = useState('')
  const [ativVencimento, setAtivVencimento] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
  )
  const [isSavingAtiv, setIsSavingAtiv] = useState(false)

  // Exclusão com confirmação
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchDetail = async (id: string) => {
    setIsLoading(true)
    try {
      const opp = await pb.collection('oportunidades').getOne<Oportunidade>(id, {
        expand: 'marca_id,funil_id,equipe_id,cliente_b2b_id,cliente_b2c_id,vendedor_id',
      })
      setOpportunity(opp)
      setTitulo(opp.titulo)
      setValorEstimado(opp.valor_estimado || 0)
      setProximaAcaoData(opp.proxima_acao_data ? opp.proxima_acao_data.split('T')[0] : '')
      setProximaAcaoDescricao(opp.proxima_acao_descricao || '')

      // Atividades associadas
      const ativList = await pb.collection('atividades').getFullList<Atividade>({
        filter: `oportunidade_id = "${id}"`,
        sort: 'data_vencimento',
        expand: 'responsavel_id',
      })
      setAtividades(ativList)

      // Preferências de comunicação do cliente vinculado
      let prefFilter = ''
      if (opp.cliente_b2b_id) {
        prefFilter = `cliente_b2b_id = "${opp.cliente_b2b_id}"`
      } else if (opp.cliente_b2c_id) {
        prefFilter = `cliente_b2c_id = "${opp.cliente_b2c_id}"`
      }

      if (prefFilter) {
        const prefList = await pb
          .collection('preferencias_comunicacao')
          .getFullList<PreferenciaComunicacao>({
            filter: prefFilter,
            expand: 'marca_id',
          })
        setPreferencias(prefList)
      } else {
        setPreferencias([])
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes da oportunidade:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (opportunityId) {
      fetchDetail(opportunityId)
    } else {
      setOpportunity(null)
    }
  }, [opportunityId])

  if (!opportunityId) return null

  const handleSaveOpportunity = async () => {
    if (!opportunity) return
    try {
      await pb.collection('oportunidades').update(opportunity.id, {
        titulo,
        valor_estimado: Number(valorEstimado),
        proxima_acao_data: proximaAcaoData ? new Date(proximaAcaoData).toISOString() : null,
        proxima_acao_descricao: proximaAcaoDescricao,
      })
      toast({
        title: 'Oportunidade atualizada',
        description: 'Os dados foram salvos com sucesso.',
      })
      setIsEditing(false)
      fetchDetail(opportunity.id)
      onUpdate()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar oportunidade'
      toast({
        variant: 'destructive',
        title: 'Falha ao atualizar',
        description: msg,
      })
    }
  }

  const handleToggleAtividade = async (at: Atividade) => {
    try {
      await pb.collection('atividades').update(at.id, {
        concluida: !at.concluida,
      })
      fetchDetail(opportunityId)
      onUpdate()
    } catch (err) {
      console.error('Erro ao alternar atividade:', err)
    }
  }

  const handleCreateAtividade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opportunity) return
    setIsSavingAtiv(true)
    try {
      await pb.collection('atividades').create({
        marca_id: opportunity.marca_id,
        oportunidade_id: opportunity.id,
        responsavel_id: pb.authStore.record?.id,
        tipo: ativTipo,
        descricao: ativDescricao,
        data_vencimento: new Date(ativVencimento).toISOString(),
        concluida: false,
      })

      // Se a oportunidade estava sem follow-up, atualiza automaticamente a próxima ação
      if (!opportunity.proxima_acao_data) {
        await pb.collection('oportunidades').update(opportunity.id, {
          proxima_acao_data: new Date(ativVencimento).toISOString(),
          proxima_acao_descricao: ativDescricao,
        })
      }

      setNewAtivOpen(false)
      setAtivDescricao('')
      toast({
        title: 'Atividade agendada',
        description: 'Nova tarefa inserida na esteira comercial.',
      })
      fetchDetail(opportunity.id)
      onUpdate()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar atividade'
      toast({
        variant: 'destructive',
        title: 'Falha ao cadastrar atividade',
        description: msg,
      })
    } finally {
      setIsSavingAtiv(false)
    }
  }

  const handleToggleConsent = async (pref: PreferenciaComunicacao) => {
    const novoStatus = pref.status_consentimento === 'Opt-in' ? 'Opt-out' : 'Opt-in'
    try {
      await pb.collection('preferencias_comunicacao').update(pref.id, {
        status_consentimento: novoStatus,
        data_atualizacao: new Date().toISOString(),
      })
      toast({
        title: `Consentimento alterado para ${novoStatus}`,
        description: `Canal ${pref.canal} atualizado de acordo com a LGPD.`,
      })
      fetchDetail(opportunityId)
    } catch (err) {
      console.error('Erro ao alternar consentimento:', err)
    }
  }

  const handleDeleteOpportunity = async () => {
    if (!opportunity) return
    setIsDeleting(true)
    try {
      await pb.collection('oportunidades').delete(opportunity.id)
      toast({
        title: 'Oportunidade excluída',
        description: 'Registro removido da base comercial.',
      })
      setDeleteConfirmOpen(false)
      onClose()
      onUpdate()
    } catch (err) {
      console.error('Erro ao excluir oportunidade:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const clienteB2B = opportunity?.expand?.cliente_b2b_id
  const clienteB2C = opportunity?.expand?.cliente_b2c_id
  const clienteNome = clienteB2B
    ? clienteB2B.razao_social
    : clienteB2C
      ? clienteB2C.nome_completo
      : 'Sem vínculo'
  const followStatus = getFollowUpStatus(opportunity?.proxima_acao_data)

  return (
    <>
      <Sheet open={!!opportunityId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-white border-l border-[#D5DBDB] shadow-2xl z-50"
        >
          {isLoading || !opportunity ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#1B4F72]" />
              <p className="text-xs text-[#5D6D7E]">Carregando dados da negociação...</p>
            </div>
          ) : (
            <>
              {/* TOP DRAWER HEADER */}
              <SheetHeader className="p-5 border-b border-[#D5DBDB] bg-slate-50/70 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: opportunity.expand?.marca_id?.cor_destaque || '#1B4F72',
                      }}
                    />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold border-[#D5DBDB] uppercase tracking-wider"
                    >
                      {opportunity.expand?.marca_id?.nome}
                    </Badge>
                    <Badge className="bg-[#1B4F72] text-white text-[10px]">
                      {opportunity.etapa_atual}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="text-xs text-red-600 hover:bg-red-50 h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Excluir
                  </Button>
                </div>

                <SheetTitle className="text-lg font-bold text-[#1C2833] mt-2">
                  {opportunity.titulo}
                </SheetTitle>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#5D6D7E] mt-1">
                  <span className="flex items-center">
                    {clienteB2B ? (
                      <Building2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    ) : (
                      <User className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    )}
                    <strong>{clienteNome}</strong>
                  </span>
                  <span>•</span>
                  <span>Funil: {opportunity.expand?.funil_id?.nome_funil}</span>
                  <span>•</span>
                  <span className="font-bold text-[#1C2833]">
                    {formatCurrencyBRL(opportunity.valor_estimado)}
                  </span>
                </div>
              </SheetHeader>

              {/* TABS DO DRAWER: DETALHES, ATIVIDADES, LGPD */}
              <Tabs defaultValue="detalhes" className="flex-1 flex flex-col min-h-0">
                <div className="px-5 border-b border-[#D5DBDB] bg-white">
                  <TabsList className="h-11 bg-transparent p-0 space-x-4">
                    <TabsTrigger
                      value="detalhes"
                      className="text-xs font-semibold data-[state=active]:border-b-2 data-[state=active]:border-[#1B4F72] rounded-none px-1 py-2.5"
                    >
                      Detalhes & Trava Follow-up
                    </TabsTrigger>
                    <TabsTrigger
                      value="atividades"
                      className="text-xs font-semibold data-[state=active]:border-b-2 data-[state=active]:border-[#1B4F72] rounded-none px-1 py-2.5"
                    >
                      Atividades ({atividades.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="lgpd"
                      className="text-xs font-semibold data-[state=active]:border-b-2 data-[state=active]:border-[#1B4F72] rounded-none px-1 py-2.5"
                    >
                      Consentimento LGPD
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* ABA 1: DETALHES */}
                <TabsContent value="detalhes" className="flex-1 overflow-y-auto p-5 space-y-5 m-0">
                  {/* ALERTA DE TRAVA DE FOLLOW-UP */}
                  {followStatus === 'missing' && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-start space-x-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Trava de Follow-up Ativa</p>
                        <p className="mt-0.5 text-red-700">
                          Esta negociação não possui data de retorno agendada. Conforme a regra de
                          negócio da NTC, ela não poderá avançar de etapa no Kanban até que um
                          follow-up seja definido.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                        Dados da Negociação
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-xs h-7 border-[#D5DBDB]"
                      >
                        {isEditing ? 'Cancelar Edição' : 'Editar Oportunidade'}
                      </Button>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3.5 p-4 bg-slate-50 border border-[#D5DBDB] rounded-lg">
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-[#1C2833]">
                            Título da Oportunidade
                          </Label>
                          <Input
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            className="h-9 text-xs bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-[#1C2833]">
                            Valor Estimado (R$)
                          </Label>
                          <Input
                            type="number"
                            value={valorEstimado}
                            onChange={(e) => setValorEstimado(Number(e.target.value))}
                            className="h-9 text-xs bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-[#1C2833]">
                            Próxima Ação - Data
                          </Label>
                          <Input
                            type="date"
                            value={proximaAcaoData}
                            onChange={(e) => setProximaAcaoData(e.target.value)}
                            className="h-9 text-xs bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-[#1C2833]">
                            Próxima Ação - Descrição
                          </Label>
                          <Input
                            value={proximaAcaoDescricao}
                            onChange={(e) => setProximaAcaoDescricao(e.target.value)}
                            placeholder="ex: Apresentar proposta comercial revisada"
                            className="h-9 text-xs bg-white"
                          />
                        </div>

                        <Button
                          onClick={handleSaveOpportunity}
                          className="w-full h-8 text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
                        >
                          Salvar Alterações
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg border border-[#D5DBDB]/60">
                          <p className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                            Valor da Venda
                          </p>
                          <p className="text-sm font-bold text-[#1C2833] mt-0.5">
                            {formatCurrencyBRL(opportunity.valor_estimado)}
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-[#D5DBDB]/60">
                          <p className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                            Vendedor Responsável
                          </p>
                          <p className="text-sm font-semibold text-[#1C2833] mt-0.5 truncate">
                            {opportunity.expand?.vendedor_id?.name || 'Administrador NTC'}
                          </p>
                        </div>
                        <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-[#D5DBDB]/60">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                              Próximo Follow-up
                            </p>
                            {followStatus === 'missing' && (
                              <Badge className="bg-red-50 text-red-700 text-[10px]">Sem data</Badge>
                            )}
                            {followStatus === 'overdue' && (
                              <Badge className="bg-red-50 text-red-700 text-[10px]">Vencido</Badge>
                            )}
                            {followStatus === 'soon' && (
                              <Badge className="bg-amber-50 text-amber-800 text-[10px]">
                                Em 48h
                              </Badge>
                            )}
                            {followStatus === 'ok' && (
                              <Badge className="bg-emerald-50 text-emerald-800 text-[10px]">
                                Em dia
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-[#1C2833] mt-1">
                            {formatDateBR(opportunity.proxima_acao_data)}
                          </p>
                          <p className="text-xs text-[#5D6D7E] mt-0.5">
                            {opportunity.proxima_acao_descricao || 'Nenhuma descrição adicionada.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Dados do Cliente Vinculado */}
                    <div className="pt-2 border-t border-[#D5DBDB]/60">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                        Ficha do Cliente
                      </span>
                      <div className="mt-2 p-3 rounded-lg border border-[#D5DBDB] bg-white space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#5D6D7E]">Nome/Razão Social:</span>
                          <span className="font-bold text-[#1C2833]">{clienteNome}</span>
                        </div>
                        {clienteB2B && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5D6D7E]">CNPJ:</span>
                              <span className="font-mono text-[#1C2833]">{clienteB2B.cnpj}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5D6D7E]">E-mail Corporativo:</span>
                              <span className="text-[#1C2833]">
                                {clienteB2B.email_principal || '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5D6D7E]">Telefone:</span>
                              <span className="text-[#1C2833]">{clienteB2B.telefone || '—'}</span>
                            </div>
                          </>
                        )}
                        {clienteB2C && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5D6D7E]">CPF:</span>
                              <span className="font-mono text-[#1C2833]">{clienteB2C.cpf}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5D6D7E]">E-mail Pessoal:</span>
                              <span className="text-[#1C2833]">
                                {clienteB2C.email_principal || '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#5D6D7E]">Telefone:</span>
                              <span className="text-[#1C2833]">{clienteB2C.telefone || '—'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ABA 2: ATIVIDADES */}
                <TabsContent
                  value="atividades"
                  className="flex-1 overflow-y-auto p-5 space-y-4 m-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                      Linha do Tempo de Atividades
                    </span>
                    <Button
                      size="sm"
                      onClick={() => setNewAtivOpen(true)}
                      className="text-xs h-7 bg-[#1B4F72] hover:bg-[#154360] text-white"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Nova Atividade
                    </Button>
                  </div>

                  {atividades.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400 stroke-1" />
                      <p>Nenhuma atividade ou tarefa vinculada a esta negociação.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNewAtivOpen(true)}
                        className="mt-3 text-xs"
                      >
                        Agendar Primeira Tarefa
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {atividades.map((at) => (
                        <div
                          key={at.id}
                          className="p-3 rounded-lg border border-[#D5DBDB] bg-white hover:bg-slate-50 transition-colors flex items-start space-x-3 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleAtividade(at)}
                            className="mt-0.5 w-4 h-4 rounded border border-[#5D6D7E] hover:border-emerald-600 hover:bg-emerald-50 flex items-center justify-center shrink-0"
                          >
                            {at.concluida && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] border-[#D5DBDB] font-semibold"
                              >
                                {at.tipo}
                              </Badge>
                              <span className="text-[11px] text-[#5D6D7E]">
                                Vencimento: {formatDateBR(at.data_vencimento)}
                              </span>
                            </div>
                            <p
                              className={`mt-1 font-medium ${
                                at.concluida ? 'line-through text-[#5D6D7E]' : 'text-[#1C2833]'
                              }`}
                            >
                              {at.descricao}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ABA 3: LGPD CONSENTIMENTO */}
                <TabsContent value="lgpd" className="flex-1 overflow-y-auto p-5 space-y-4 m-0">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-[#1B4F72] flex items-start space-x-2.5">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#1B4F72]" />
                    <div>
                      <p className="font-bold">Segregação de Consentimento por Marca (LGPD)</p>
                      <p className="text-[11px] text-blue-900/80 mt-0.5">
                        A autorização concedida para uma marca NÃO permite comunicação promocional
                        em nome de outra unidade da NTC. O descadastramento (opt-out) tem efeito
                        estrito sobre a marca sinalizada.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                    Preferências Registradas
                  </span>

                  {preferencias.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                      <p>Nenhum consentimento explícito cadastrado ainda para este cliente.</p>
                      <p className="text-[11px] mt-1">
                        Consulte a aba de Preferências LGPD para adicionar novo consentimento
                        formal.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {preferencias.map((pref) => {
                        const isOptIn = pref.status_consentimento === 'Opt-in'
                        return (
                          <div
                            key={pref.id}
                            className="p-3 rounded-lg border border-[#D5DBDB] bg-white flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-[#1C2833]">{pref.canal}</span>
                                <Badge
                                  className={`text-[10px] ${
                                    isOptIn
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {pref.status_consentimento}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-[#5D6D7E] mt-0.5">
                                Marca: {pref.expand?.marca_id?.nome || 'Marca Ativa'} • Atualizado
                                em: {formatDateBR(pref.data_atualizacao || pref.updated)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleConsent(pref)}
                              className="text-[11px] h-7 border-[#D5DBDB]"
                            >
                              Alternar para {isOptIn ? 'Opt-out' : 'Opt-in'}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* MODAL NOVA ATIVIDADE */}
      <Dialog open={newAtivOpen} onOpenChange={setNewAtivOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Nova Atividade Comercial
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAtividade} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Tipo de Atividade</Label>
              <Select value={ativTipo} onValueChange={(v) => setAtivTipo(v as Atividade['tipo'])}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ligação">Ligação</SelectItem>
                  <SelectItem value="Reunião">Reunião</SelectItem>
                  <SelectItem value="Visita">Visita</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">
                Descrição do Compromisso
              </Label>
              <Input
                required
                value={ativDescricao}
                onChange={(e) => setAtivDescricao(e.target.value)}
                placeholder="ex: Apresentação de laudo técnico ou alinhamento de proposta"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Data de Vencimento</Label>
              <Input
                type="date"
                required
                value={ativVencimento}
                onChange={(e) => setAtivVencimento(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewAtivOpen(false)}
                className="text-xs border-[#D5DBDB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingAtiv}
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                {isSavingAtiv ? 'Agendando...' : 'Agendar Atividade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600">
              Excluir Oportunidade?
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#5D6D7E]">
            Tem certeza de que deseja remover permanentemente esta oportunidade e seus vínculos
            comerciais? Esta ação será registrada no log de auditoria corporativo.
          </p>
          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
              className="text-xs border-[#D5DBDB]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteOpportunity}
              className="text-xs font-semibold"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir Oportunidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
