// src/pages/Pipelines.tsx
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type { Funil, Oportunidade, Equipe, ClienteB2B, ClienteB2C } from '@/types'
import { OpportunityDrawer } from '@/components/OpportunityDrawer'
import { formatCurrencyBRL, formatDateBR, getFollowUpStatus } from '@/lib/formatters'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Plus,
  Search,
  AlertTriangle,
  Building2,
  User,
  Filter,
  CheckCircle2,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Pipelines() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { marcas, activeBrand, isConsolidated, currentBrandColor } = useBrand()

  const [funis, setFunis] = useState<Funil[]>([])
  const [activeFunilId, setActiveFunilId] = useState<string>('')
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [selectedEquipeFilter, setSelectedEquipeFilter] = useState<string>('all')
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Deep linking para OpportunityDrawer
  const selectedOppId = searchParams.get('oppId')

  // Modal Nova Oportunidade
  const [isNewOppModalOpen, setIsNewOppModalOpen] = useState(false)
  const [newTitulo, setNewTitulo] = useState('')
  const [newValor, setNewValor] = useState<number>(0)
  const [newFunilId, setNewFunilId] = useState('')
  const [newEtapa, setNewEtapa] = useState('')
  const [newClienteTipo, setNewClienteTipo] = useState<'b2b' | 'b2c'>('b2b')
  const [newClienteId, setNewClienteId] = useState('')
  const [newFollowUpData, setNewFollowUpData] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
  )
  const [newFollowUpDesc, setNewFollowUpDesc] = useState(
    'Primeiro contato de alinhamento comercial',
  )
  const [clientesB2BList, setClientesB2BList] = useState<ClienteB2B[]>([])
  const [clientesB2CList, setClientesB2CList] = useState<ClienteB2C[]>([])
  const [isSubmittingNewOpp, setIsSubmittingNewOpp] = useState(false)

  // Efeito Shake de Trava de Follow-up
  const [shakingOppId, setShakingOppId] = useState<string | null>(null)

  // Modal de Drag & Drop para confirmação de avanço com novo follow-up obrigatório
  const [dragConfirmModalOpen, setDragConfirmModalOpen] = useState(false)
  const [draggedOpportunity, setDraggedOpportunity] = useState<Oportunidade | null>(null)
  const [targetEtapa, setTargetEtapa] = useState('')
  const [dragFollowUpData, setDragFollowUpData] = useState(
    new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0],
  )
  const [dragFollowUpDesc, setDragFollowUpDesc] = useState('')

  // 1. Carrega funis e equipes da marca ativa
  const loadFunisAndEquipes = async () => {
    setIsLoading(true)
    try {
      let fFilter = ''
      let eqFilter = ''
      if (activeBrand) {
        fFilter = `marca_id = "${activeBrand.id}"`
        eqFilter = `marca_id = "${activeBrand.id}"`
      }
      const [funisRes, equipesRes] = await Promise.all([
        pb.collection('funis').getFullList<Funil>({
          filter: fFilter || undefined,
          sort: 'nome_funil',
        }),
        pb.collection('equipes').getFullList<Equipe>({
          filter: eqFilter || undefined,
          sort: 'nome_equipe',
        }),
      ])

      setFunis(funisRes)
      setEquipes(equipesRes)

      if (funisRes.length > 0) {
        // Se o funil ativo atual não estiver na nova lista, seleciona o primeiro
        if (!activeFunilId || !funisRes.some((f) => f.id === activeFunilId)) {
          setActiveFunilId(funisRes[0].id)
        }
      } else {
        setActiveFunilId('')
      }
    } catch (err) {
      console.error('Erro ao carregar funis:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFunisAndEquipes()
  }, [activeBrand])

  // Se a rota tiver action=new na query string, abre modal de nova oportunidade
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsNewOppModalOpen(true)
      searchParams.delete('action')
      setSearchParams(searchParams)
    }
  }, [searchParams])

  // 2. Carrega oportunidades do funil ativo
  const loadOportunidades = async () => {
    if (!activeFunilId) {
      setOportunidades([])
      return
    }
    try {
      let filter = `funil_id = "${activeFunilId}"`
      if (selectedEquipeFilter && selectedEquipeFilter !== 'all') {
        filter += ` && equipe_id = "${selectedEquipeFilter}"`
      }

      const res = await pb.collection('oportunidades').getFullList<Oportunidade>({
        filter,
        expand: 'marca_id,cliente_b2b_id,cliente_b2c_id,vendedor_id',
        sort: '-created',
      })
      setOportunidades(res)
    } catch (err) {
      console.error('Erro ao carregar oportunidades:', err)
    }
  }

  useEffect(() => {
    loadOportunidades()
  }, [activeFunilId, selectedEquipeFilter])

  // Carrega lista de clientes para o modal de criação
  const loadClientesOptions = async () => {
    try {
      const [b2b, b2c] = await Promise.all([
        pb.collection('clientes_b2b').getFullList<ClienteB2B>({ sort: 'razao_social' }),
        pb.collection('clientes_b2c').getFullList<ClienteB2C>({ sort: 'nome_completo' }),
      ])
      setClientesB2BList(b2b)
      setClientesB2CList(b2c)
    } catch (err) {
      console.error('Erro ao carregar opções de clientes:', err)
    }
  }

  useEffect(() => {
    if (isNewOppModalOpen) {
      loadClientesOptions()
      setNewFunilId(activeFunilId)
      const currFunil = funis.find((f) => f.id === activeFunilId)
      if (currFunil && currFunil.etapas_ordenadas?.length > 0) {
        setNewEtapa(currFunil.etapas_ordenadas[0])
      }
    }
  }, [isNewOppModalOpen])

  const activeFunil = funis.find((f) => f.id === activeFunilId)
  const etapas = activeFunil?.etapas_ordenadas || []

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, opp: Oportunidade) => {
    e.dataTransfer.setData('text/plain', opp.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetColEtapa: string) => {
    e.preventDefault()
    const oppId = e.dataTransfer.getData('text/plain')
    const opp = oportunidades.find((o) => o.id === oppId)
    if (!opp) return

    if (opp.etapa_atual === targetColEtapa) return

    // TRAVA DE FOLLOW-UP (Padrão Pipedrive obrigatório pelo documento):
    // Se a oportunidade não tiver proxima_acao_data cadastrada e estiver tentando avançar para uma etapa posterior
    const currentIndex = etapas.indexOf(opp.etapa_atual)
    const targetIndex = etapas.indexOf(targetColEtapa)

    if (targetIndex > currentIndex && !opp.proxima_acao_data) {
      // Bloqueia e faz o card tremer
      setShakingOppId(opp.id)
      setTimeout(() => setShakingOppId(null), 1000)

      toast({
        variant: 'destructive',
        title: 'Trava de Follow-up Ativa!',
        description:
          'Proibido avançar etapa sem follow-up agendado. Clique no card e defina uma data de próxima ação primeiro.',
      })
      return
    }

    // Abre modal de confirmação para reforçar a atualização de follow-up na nova etapa
    setDraggedOpportunity(opp)
    setTargetEtapa(targetColEtapa)
    setDragFollowUpDesc(
      opp.proxima_acao_descricao || `Follow-up para acompanhamento da etapa ${targetColEtapa}`,
    )
    setDragConfirmModalOpen(true)
  }

  const confirmMoveEtapa = async () => {
    if (!draggedOpportunity || !targetEtapa) return

    if (!dragFollowUpData) {
      toast({
        variant: 'destructive',
        title: 'Data de follow-up obrigatória',
        description: 'Informe a data do próximo contato para concluir a transição.',
      })
      return
    }

    try {
      await pb.collection('oportunidades').update(draggedOpportunity.id, {
        etapa_atual: targetEtapa,
        proxima_acao_data: new Date(dragFollowUpData).toISOString(),
        proxima_acao_descricao: dragFollowUpDesc,
      })

      toast({
        title: 'Etapa atualizada com sucesso!',
        description: `Oportunidade movida para "${targetEtapa}" com follow-up agendado.`,
      })

      setDragConfirmModalOpen(false)
      setDraggedOpportunity(null)
      loadOportunidades()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao movimentar negociação'
      toast({
        variant: 'destructive',
        title: 'Erro na transição de etapa',
        description: msg,
      })
    }
  }

  // Criação de nova oportunidade
  const handleCreateNewOpp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeBrand && !newFunilId) return

    setIsSubmittingNewOpp(true)
    try {
      const targetFunil = funis.find((f) => f.id === newFunilId)
      const marcaId = targetFunil ? targetFunil.marca_id : activeBrand?.id

      await pb.collection('oportunidades').create({
        marca_id: marcaId,
        funil_id: newFunilId,
        titulo: newTitulo,
        valor_estimado: Number(newValor),
        etapa_atual: newEtapa,
        vendedor_id: pb.authStore.record?.id,
        cliente_b2b_id: newClienteTipo === 'b2b' && newClienteId ? newClienteId : null,
        cliente_b2c_id: newClienteTipo === 'b2c' && newClienteId ? newClienteId : null,
        proxima_acao_data: newFollowUpData ? new Date(newFollowUpData).toISOString() : null,
        proxima_acao_descricao: newFollowUpDesc,
      })

      toast({
        title: 'Oportunidade criada!',
        description: 'Nova negociação adicionada com sucesso ao funil.',
      })

      setIsNewOppModalOpen(false)
      setNewTitulo('')
      setNewValor(0)
      setNewClienteId('')
      loadOportunidades()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar oportunidade'
      toast({
        variant: 'destructive',
        title: 'Falha ao cadastrar',
        description: msg,
      })
    } finally {
      setIsSubmittingNewOpp(false)
    }
  }

  // Filtra cards por busca rápida
  const filteredOpps = oportunidades.filter((op) => {
    if (!searchFilter.trim()) return true
    const q = searchFilter.toLowerCase()
    const tituloMatch = op.titulo.toLowerCase().includes(q)
    const b2bMatch = op.expand?.cliente_b2b_id?.razao_social?.toLowerCase().includes(q)
    const b2cMatch = op.expand?.cliente_b2c_id?.nome_completo?.toLowerCase().includes(q)
    return tituloMatch || b2bMatch || b2cMatch
  })

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] space-y-4">
      {/* BARRA SUPERIOR: SELETOR DE FUNIL EM ABAS + FILTRO EQUIPE + BUSCA + NOVA OPP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {funis.length > 0 ? (
            <Tabs value={activeFunilId} onValueChange={setActiveFunilId} className="w-auto">
              <TabsList className="bg-white border border-[#D5DBDB] p-1 h-9 shadow-xs">
                {funis.map((f) => (
                  <TabsTrigger
                    key={f.id}
                    value={f.id}
                    className="text-xs font-semibold px-3 py-1 data-[state=active]:bg-[#1B4F72] data-[state=active]:text-white rounded-md"
                  >
                    {f.nome_funil}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <span className="text-xs text-[#5D6D7E]">
              Nenhum funil cadastrado para esta unidade comercial.
            </span>
          )}

          {/* Filtro por Equipe */}
          {equipes.length > 0 && (
            <div className="flex items-center space-x-1.5 ml-2">
              <Filter className="w-3.5 h-3.5 text-[#5D6D7E]" />
              <Select value={selectedEquipeFilter} onValueChange={setSelectedEquipeFilter}>
                <SelectTrigger className="h-8 text-xs w-44 bg-white border-[#D5DBDB]">
                  <SelectValue placeholder="Todas as Equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Equipes</SelectItem>
                  {equipes.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.nome_equipe}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Busca Rápida no Board */}
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#5D6D7E]" />
            <Input
              type="text"
              placeholder="Filtrar por nome ou cliente..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 pl-8 pr-2 text-xs bg-white border-[#D5DBDB]"
            />
          </div>

          <Button
            size="sm"
            onClick={() => setIsNewOppModalOpen(true)}
            className="h-8 text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* BOARD KANBAN (SCROLL HORIZONTAL COM COLUNAS DE MÍNIMO 280px) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-[#5D6D7E]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B4F72] mr-2" />
            Carregando esteira de vendas...
          </div>
        ) : etapas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#D5DBDB] rounded-xl bg-white p-8">
            <p className="text-sm font-semibold text-[#1C2833]">Nenhum funil ativo selecionado.</p>
            <p className="text-xs text-[#5D6D7E] mt-1">Selecione uma marca ou cadastre um funil.</p>
          </div>
        ) : (
          <div className="flex items-stretch space-x-3.5 h-full min-w-max">
            {etapas.map((etapa, idx) => {
              const colOpps = filteredOpps.filter((o) => o.etapa_atual === etapa)
              const colTotalValor = colOpps.reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
              const isFirstCol = idx === 0

              return (
                <div
                  key={etapa}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, etapa)}
                  className={cn(
                    'w-[290px] flex flex-col rounded-xl border border-[#D5DBDB] bg-[#F4F6F7]/60 shadow-xs select-none transition-colors',
                    isFirstCol ? 'bg-slate-100/70 border-slate-300' : '',
                  )}
                >
                  {/* Cabeçalho da Coluna */}
                  <div className="p-3 border-b border-[#D5DBDB] bg-white rounded-t-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#1C2833]">{etapa}</span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1.5 font-bold bg-slate-100 text-[#5D6D7E]"
                        >
                          {colOpps.length}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-[#5D6D7E] mt-0.5 font-medium">
                        {formatCurrencyBRL(colTotalValor)}
                      </p>
                    </div>
                  </div>

                  {/* Lista de Cards com Scroll Vertical */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    {colOpps.map((opp) => {
                      const clienteNome =
                        opp.expand?.cliente_b2b_id?.razao_social ||
                        opp.expand?.cliente_b2c_id?.nome_completo ||
                        'Cliente Não Vinculado'
                      const followStatus = getFollowUpStatus(opp.proxima_acao_data)
                      const isShaking = shakingOppId === opp.id

                      return (
                        <div
                          key={opp.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, opp)}
                          onClick={() => {
                            searchParams.set('oppId', opp.id)
                            setSearchParams(searchParams)
                          }}
                          className={cn(
                            'p-3.5 rounded-lg border bg-white shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all relative group',
                            isShaking
                              ? 'animate-shake border-red-500 ring-2 ring-red-400 bg-red-50/20'
                              : 'border-[#D5DBDB] hover:border-slate-400',
                          )}
                        >
                          {/* Marca visual quando em consolidado */}
                          {isConsolidated && opp.expand?.marca_id && (
                            <span
                              className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded mb-1.5 text-white"
                              style={{ backgroundColor: opp.expand.marca_id.cor_destaque }}
                            >
                              {opp.expand.marca_id.nome}
                            </span>
                          )}

                          <p className="text-xs font-bold text-[#1C2833] line-clamp-2 leading-tight">
                            {opp.titulo}
                          </p>

                          <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-[#5D6D7E] truncate">
                            {opp.expand?.cliente_b2b_id ? (
                              <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                            ) : (
                              <User className="w-3 h-3 text-emerald-600 shrink-0" />
                            )}
                            <span className="truncate">{clienteNome}</span>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#D5DBDB]/50">
                            <span className="text-xs font-bold text-[#1C2833]">
                              {formatCurrencyBRL(opp.valor_estimado)}
                            </span>

                            <div className="w-6 h-6 rounded-full bg-[#1B4F72] text-white flex items-center justify-center text-[10px] font-bold">
                              {opp.expand?.vendedor_id?.name?.slice(0, 2).toUpperCase() || 'AD'}
                            </div>
                          </div>

                          {/* BADGE DE FOLLOW-UP / TRAVA PIPEDRIVE */}
                          <div className="mt-2.5">
                            {followStatus === 'missing' && (
                              <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                <span className="truncate">Sem follow-up agendado</span>
                              </div>
                            )}
                            {followStatus === 'overdue' && (
                              <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-medium">
                                <Clock className="w-3 h-3 text-red-600 shrink-0" />
                                <span className="truncate">
                                  Vencido: {formatDateBR(opp.proxima_acao_data)}
                                </span>
                              </div>
                            )}
                            {followStatus === 'soon' && (
                              <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium">
                                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                <span className="truncate">
                                  Em 48h ({formatDateBR(opp.proxima_acao_data)})
                                </span>
                              </div>
                            )}
                            {followStatus === 'ok' && (
                              <div className="text-[10px] text-[#5D6D7E] flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate">
                                  Follow-up: {formatDateBR(opp.proxima_acao_data)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {colOpps.length === 0 && (
                      <div className="h-24 flex items-center justify-center text-[11px] text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                        Arraste cards para cá
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* DRAWER DE DETALHES DE OPORTUNIDADE (DEEP LINK VIA QUERY STRING) */}
      <OpportunityDrawer
        opportunityId={selectedOppId}
        onClose={() => {
          searchParams.delete('oppId')
          setSearchParams(searchParams)
        }}
        onUpdate={loadOportunidades}
      />

      {/* MODAL NOVA OPORTUNIDADE */}
      <Dialog open={isNewOppModalOpen} onOpenChange={setIsNewOppModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Nova Oportunidade de Venda
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNewOpp} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Título da Negociação</Label>
              <Input
                required
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                placeholder="ex: Fornecimento de 5.000 caixas geológicas ou Pier 24m"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Funil / Pipeline</Label>
                <Select value={newFunilId} onValueChange={setNewFunilId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {funis.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_funil}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Etapa Inicial</Label>
                <Select value={newEtapa} onValueChange={setNewEtapa}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {funis
                      .find((f) => f.id === newFunilId)
                      ?.etapas_ordenadas?.map((et) => (
                        <SelectItem key={et} value={et}>
                          {et}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vínculo de Cliente B2B ou B2C */}
            <div className="space-y-1.5 p-3 bg-slate-50 border border-[#D5DBDB] rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#1C2833]">Cliente Relacionado</Label>
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewClienteTipo('b2b')}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px] font-semibold',
                      newClienteTipo === 'b2b'
                        ? 'bg-[#1B4F72] text-white'
                        : 'bg-white text-[#5D6D7E] border border-[#D5DBDB]',
                    )}
                  >
                    Conta B2B (CNPJ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewClienteTipo('b2c')}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px] font-semibold',
                      newClienteTipo === 'b2c'
                        ? 'bg-[#1B4F72] text-white'
                        : 'bg-white text-[#5D6D7E] border border-[#D5DBDB]',
                    )}
                  >
                    Consumidor B2C (CPF)
                  </button>
                </div>
              </div>

              <Select value={newClienteId} onValueChange={setNewClienteId}>
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue
                    placeholder={
                      newClienteTipo === 'b2b'
                        ? 'Selecione uma conta B2B...'
                        : 'Selecione um consumidor B2C...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {newClienteTipo === 'b2b'
                    ? clientesB2BList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.razao_social} ({c.cnpj})
                        </SelectItem>
                      ))
                    : clientesB2CList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_completo} ({c.cpf})
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Valor Estimado (R$)</Label>
              <Input
                type="number"
                required
                value={newValor}
                onChange={(e) => setNewValor(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>

            {/* Follow-up Inicial Obrigatório */}
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-900 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Próxima Ação de Follow-up (Exigido pelo CRM)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-semibold text-[#5D6D7E]">Data</Label>
                  <Input
                    type="date"
                    required
                    value={newFollowUpData}
                    onChange={(e) => setNewFollowUpData(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-semibold text-[#5D6D7E]">Ação Prevista</Label>
                  <Input
                    required
                    value={newFollowUpDesc}
                    onChange={(e) => setNewFollowUpDesc(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewOppModalOpen(false)}
                className="text-xs border-[#D5DBDB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingNewOpp}
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                {isSubmittingNewOpp ? 'Criando...' : 'Cadastrar Oportunidade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE DRAG & DROP (GARANTIA DE PRÓXIMO FOLLOW-UP) */}
      <Dialog open={dragConfirmModalOpen} onOpenChange={setDragConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Confirmar Avanço de Etapa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-[#5D6D7E]">
              Movendo <strong>{draggedOpportunity?.titulo}</strong> para a etapa:{' '}
              <Badge className="bg-[#1B4F72] text-white text-[11px] ml-1">{targetEtapa}</Badge>
            </p>

            <div className="p-3 bg-slate-50 border border-[#D5DBDB] rounded-lg space-y-2">
              <p className="font-bold text-[#1C2833]">Agendar Próxima Ação (Follow-up)</p>
              <div>
                <Label className="text-[10px] font-semibold text-[#5D6D7E]">
                  Data da Próxima Interação
                </Label>
                <Input
                  type="date"
                  required
                  value={dragFollowUpData}
                  onChange={(e) => setDragFollowUpData(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div>
                <Label className="text-[10px] font-semibold text-[#5D6D7E]">
                  Descrição da Ação
                </Label>
                <Input
                  required
                  value={dragFollowUpDesc}
                  onChange={(e) => setDragFollowUpDesc(e.target.value)}
                  placeholder="ex: Enviar minuta contratual ou agendar reunião técnica"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDragConfirmModalOpen(false)}
              className="text-xs border-[#D5DBDB]"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={confirmMoveEtapa}
              className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
            >
              Confirmar & Salvar Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
