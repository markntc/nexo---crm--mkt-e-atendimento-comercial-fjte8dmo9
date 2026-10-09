// src/pages/Pipelines.tsx
// Tela Unificada de Negócios / Pipelines estilo Pipedrive (Imagem 1 de referência)
// Barra de alternância: Kanban (ícone colunas), Lista (ícone lista), Tabela (ícone grade/planilha)
// Botão verde primário "+ Negócio", seletor de Funil de vendas, ordenação e filtros rápidos
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Funil, Oportunidade, Equipe, ClienteB2B, ClienteB2C, EtapaConfig } from '@/types'
import { getEtapaNome, isWonStage, isLostStage } from '@/lib/relationshipStatus'
import { OpportunityDrawer } from '@/components/OpportunityDrawer'
import { AddDealModal } from '@/components/AddDealModal'
import { formatCurrencyBRL, formatDateBR, getFollowUpStatus } from '@/lib/formatters'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Kanban,
  List,
  Table as TableIcon,
  ChevronDown,
  ArrowUpDown,
  Sparkles,
  Calendar,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type ViewMode = 'kanban' | 'list' | 'table'
type SortOption = 'proxima_acao' | 'valor_desc' | 'valor_asc' | 'created_desc' | 'titulo'

export default function Pipelines() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeBrand, isConsolidated } = useBrand()
  const {
    user,
    isAdmin,
    isDiretoria,
    isSupervisor,
    isVendedor,
    isRepresentante,
    escopoVisibilidade,
  } = useAuth()

  // Modo de visualização (Kanban, Lista, Tabela)
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'kanban',
  )

  const [funis, setFunis] = useState<Funil[]>([])
  const [activeFunilId, setActiveFunilId] = useState<string>('')
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [selectedEquipeFilter, setSelectedEquipeFilter] = useState<string>('all')
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('proxima_acao')
  const [isLoading, setIsLoading] = useState(true)

  // Filtro de status estilo Pipedrive ("Status é Aberto" / "Todos")
  const [statusFilter, setStatusFilter] = useState<'aberto' | 'todos'>('aberto')
  // Chip de filtro rápido de data esperada de fechamento: todos | 30d | 60d | 90d | atrasados
  const [quickDateFilter, setQuickDateFilter] = useState<
    'todos' | '30d' | '60d' | '90d' | 'atrasados'
  >('todos')

  // Deep linking para OpportunityDrawer
  const selectedOppId = searchParams.get('oppId')

  // Modal Nova Oportunidade (+ Negócio)
  const [isNewOppModalOpen, setIsNewOppModalOpen] = useState(false)
  const [dealModalInitialValues, setDealModalInitialValues] = useState<
    | {
        titulo?: string
        valor?: number | string
        etapa_atual?: string
        cliente_b2b_id?: string
        cliente_b2c_id?: string
        documento_faturamento?: 'CPF' | 'CNPJ' | 'AMBOS'
        observacoes?: string
        origem?: string
      }
    | undefined
  >(undefined)
  const [newTitulo, setNewTitulo] = useState('')
  const [newValor, setNewValor] = useState<number>(0)
  const [newFunilId, setNewFunilId] = useState('')
  const [newEtapa, setNewEtapa] = useState('')
  const [newClienteTipo, setNewClienteTipo] = useState<'b2b' | 'b2c' | 'ambos'>('b2b')
  const [newClienteId, setNewClienteId] = useState('')
  const [newPessoaId, setNewPessoaId] = useState('')
  const [newDocFaturamento, setNewDocFaturamento] = useState<'CPF' | 'CNPJ' | 'AMBOS' | ''>('')
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

  // 2. Carrega oportunidades do funil ativo com escopo de visibilidade por perfil
  const loadOportunidades = async () => {
    if (!activeFunilId) {
      setOportunidades([])
      return
    }
    try {
      const filters: string[] = [`funil_id = "${activeFunilId}"`]

      // Marca ativa: para Supervisor e Vendedor é estritamente a marca ativa
      if (activeBrand) {
        filters.push(`marca_id = "${activeBrand.id}"`)
      }

      if (selectedEquipeFilter && selectedEquipeFilter !== 'all') {
        filters.push(`equipe_id = "${selectedEquipeFilter}"`)
      }

      // Escopo de visibilidade:
      // Vendedor e Representante: vê apenas seus próprios negócios (Representante é sempre 'proprios')
      // Supervisor: vê a marca ativa (já aplicado via activeBrand)
      // Admin/Diretoria: consolidado ou marca
      if (user && !isAdmin && !isDiretoria) {
        if (isRepresentante || isVendedor || escopoVisibilidade === 'proprios') {
          filters.push(`vendedor_id = "${user.id}"`)
        }
      }

      const filter = filters.join(' && ')

      const res = await pb.collection('oportunidades').getFullList<Oportunidade>({
        filter,
        expand: 'marca_id,funil_id,equipe_id,cliente_b2b_id,cliente_b2c_id,vendedor_id',
        sort: '-created',
      })
      setOportunidades(res)
    } catch (err) {
      console.error('Erro ao carregar oportunidades:', err)
    }
  }

  useEffect(() => {
    loadOportunidades()
  }, [activeFunilId, selectedEquipeFilter, user?.id, escopoVisibilidade, activeBrand])

  // Estado para inline "+ Adicionar nova etapa" no fim do Kanban (Admin Only)
  const [isAddingKanbanStage, setIsAddingKanbanStage] = useState(false)
  const [kanbanStageNome, setKanbanStageNome] = useState('')
  const [kanbanStageValor, setKanbanStageValor] = useState<string>('')
  const [isSavingKanbanStage, setIsSavingKanbanStage] = useState(false)

  // Salvar nova etapa inline no fim do Kanban
  const handleSaveKanbanStageInline = async () => {
    const trimmed = kanbanStageNome.trim()
    if (!trimmed || !activeFunilId) return

    const activeF = funis.find((f) => f.id === activeFunilId)
    if (!activeF) return

    setIsSavingKanbanStage(true)
    try {
      const numValor = parseFloat(kanbanStageValor) || 0
      const currentEtapas = (activeF.etapas_ordenadas || []).map((item) => {
        if (typeof item === 'string') return item
        return item
      })

      const novaEtapaObj: EtapaConfig = {
        nome: trimmed,
        valor_referencia: numValor,
        is_won: false,
        is_lost: false,
      }

      const novasEtapas = [...currentEtapas, novaEtapaObj]

      const updatedF = await pb.collection('funis').update<Funil>(activeF.id, {
        etapas_ordenadas: novasEtapas,
      })

      // Atualiza lista de funis em memória
      setFunis((prev) => prev.map((f) => (f.id === updatedF.id ? updatedF : f)))
      setIsAddingKanbanStage(false)
      setKanbanStageNome('')
      setKanbanStageValor('')

      toast({
        title: 'Nova etapa adicionada!',
        description: `"${trimmed}" agora faz parte do funil "${updatedF.nome_funil}".`,
      })
    } catch (err) {
      console.error('Erro ao adicionar etapa no Kanban:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível adicionar a nova etapa.',
      })
    } finally {
      setIsSavingKanbanStage(false)
    }
  }

  // Carrega opções de clientes para o modal
  const loadClientesOptions = async () => {
    try {
      const [b2b, b2c] = await Promise.all([
        pb.collection('organizacoes').getFullList<ClienteB2B>({ sort: 'razao_social' }),
        pb.collection('pessoas').getFullList<ClienteB2C>({ sort: 'nome_completo' }),
      ])
      setClientesB2BList(b2b)
      setClientesB2CList(b2c)
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
    }
  }

  useEffect(() => {
    if (isNewOppModalOpen) {
      loadClientesOptions()
      setNewFunilId(activeFunilId)
      const currFunil = funis.find((f) => f.id === activeFunilId)
      if (currFunil && currFunil.etapas_ordenadas?.length > 0) {
        setNewEtapa(getEtapaNome(currFunil.etapas_ordenadas[0]))
      }
    }
  }, [isNewOppModalOpen])

  const activeFunil = funis.find((f) => f.id === activeFunilId)
  const etapas = (activeFunil?.etapas_ordenadas || []).map(getEtapaNome)

  // Alterna view mode e sincroniza na URL
  const handleChangeViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    searchParams.set('view', mode)
    setSearchParams(searchParams)
  }

  // Drag and Drop handlers (Kanban)
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

    // TRAVA DE FOLLOW-UP (Padrão Pipedrive obrigatório)
    const currentIndex = etapas.indexOf(opp.etapa_atual)
    const targetIndex = etapas.indexOf(targetColEtapa)

    if (targetIndex > currentIndex && !opp.proxima_acao_data) {
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

    setDraggedOpportunity(opp)
    setTargetEtapa(targetColEtapa)
    setDragFollowUpDesc(
      opp.proxima_acao_descricao || `Follow-up para acompanhamento da etapa ${targetColEtapa}`,
    )
    setDragConfirmModalOpen(true)
  }

  // Avanço rápido via Lista/Tabela com verificação de trava
  const handleQuickChangeEtapa = (opp: Oportunidade, newEtapaTarget: string) => {
    if (opp.etapa_atual === newEtapaTarget) return
    const currentIndex = etapas.indexOf(opp.etapa_atual)
    const targetIndex = etapas.indexOf(newEtapaTarget)

    if (targetIndex > currentIndex && !opp.proxima_acao_data) {
      setShakingOppId(opp.id)
      setTimeout(() => setShakingOppId(null), 1000)

      toast({
        variant: 'destructive',
        title: 'Trava de Follow-up Ativa!',
        description:
          'Proibido avançar etapa sem follow-up agendado. Defina a data da próxima ação antes de mover.',
      })
      return
    }

    setDraggedOpportunity(opp)
    setTargetEtapa(newEtapaTarget)
    setDragFollowUpDesc(
      opp.proxima_acao_descricao || `Follow-up para acompanhamento da etapa ${newEtapaTarget}`,
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
        description: `Negócio movido para "${targetEtapa}" com follow-up agendado.`,
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

      let b2bFinal: string | null = null
      let b2cFinal: string | null = null

      if (newClienteTipo === 'b2b') {
        b2bFinal = newClienteId || null
      } else if (newClienteTipo === 'b2c') {
        b2cFinal = newClienteId || null
      } else if (newClienteTipo === 'ambos') {
        b2bFinal = newClienteId || null
        b2cFinal = newPessoaId || null
      }

      await pb.collection('oportunidades').create({
        marca_id: marcaId,
        funil_id: newFunilId,
        titulo: newTitulo,
        valor_estimado: Number(newValor),
        etapa_atual: newEtapa,
        vendedor_id: pb.authStore.record?.id,
        cliente_b2b_id: b2bFinal,
        cliente_b2c_id: b2cFinal,
        documento_faturamento: newDocFaturamento || null,
        proxima_acao_data: newFollowUpData ? new Date(newFollowUpData).toISOString() : null,
        proxima_acao_descricao: newFollowUpDesc,
      })

      toast({
        title: 'Negócio adicionado!',
        description: 'Nova negociação criada com sucesso no funil.',
      })

      setIsNewOppModalOpen(false)
      setNewTitulo('')
      setNewValor(0)
      setNewClienteId('')
      loadOportunidades()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar negócio'
      toast({
        variant: 'destructive',
        title: 'Falha ao cadastrar',
        description: msg,
      })
    } finally {
      setIsSubmittingNewOpp(false)
    }
  }

  // Filtra cards por busca rápida e por chip rápido de data_fechamento_esperada
  const filteredOpps = oportunidades.filter((op) => {
    // 1. Filtro de status se ativo
    if (statusFilter === 'aberto') {
      const activeF = funis.find((f) => f.id === op.funil_id)
      const isWon = isWonStage(op.etapa_atual, activeF?.etapas_ordenadas)
      const isLost = isLostStage(op.etapa_atual, activeF?.etapas_ordenadas)
      if (isWon || isLost) return false
    }

    // 2. Filtro de data esperada de fechamento (30d / 60d / 90d / atrasados)
    if (quickDateFilter !== 'todos') {
      const activeF = funis.find((f) => f.id === op.funil_id)
      const isWon = isWonStage(op.etapa_atual, activeF?.etapas_ordenadas)
      const isLost = isLostStage(op.etapa_atual, activeF?.etapas_ordenadas)
      const rawDate = op.data_fechamento_esperada
      if (!rawDate) return false

      const closeDate = new Date(rawDate)
      const now = new Date()
      // Zerando horas para comparação de datas puras
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const targetDate = new Date(
        closeDate.getFullYear(),
        closeDate.getMonth(),
        closeDate.getDate(),
      )
      const diffTime = targetDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (quickDateFilter === 'atrasados') {
        // Negócios cuja data_fechamento_esperada já passou e NÃO estão ganhos/perdidos
        if (isWon || isLost) return false
        if (diffDays >= 0) return false
      } else if (quickDateFilter === '30d') {
        if (diffDays < 0 || diffDays > 30) return false
      } else if (quickDateFilter === '60d') {
        if (diffDays < 0 || diffDays > 60) return false
      } else if (quickDateFilter === '90d') {
        if (diffDays < 0 || diffDays > 90) return false
      }
    }

    // 3. Busca em texto
    if (!searchFilter.trim()) return true
    const q = searchFilter.toLowerCase()
    const tituloMatch = op.titulo.toLowerCase().includes(q)
    const b2b = op.expand?.organizacao_id || op.expand?.cliente_b2b_id
    const b2c = op.expand?.pessoa_id || op.expand?.cliente_b2c_id
    const b2bMatch = b2b?.razao_social?.toLowerCase().includes(q)
    const b2cMatch = b2c?.nome_completo?.toLowerCase().includes(q)
    return tituloMatch || b2bMatch || b2cMatch
  })

  // Ordenação das oportunidades
  const sortedOpps = [...filteredOpps].sort((a, b) => {
    if (sortBy === 'proxima_acao') {
      if (!a.proxima_acao_data) return 1
      if (!b.proxima_acao_data) return -1
      return new Date(a.proxima_acao_data).getTime() - new Date(b.proxima_acao_data).getTime()
    }
    if (sortBy === 'valor_desc') {
      return (b.valor_estimado || 0) - (a.valor_estimado || 0)
    }
    if (sortBy === 'valor_asc') {
      return (a.valor_estimado || 0) - (b.valor_estimado || 0)
    }
    if (sortBy === 'created_desc') {
      return new Date(b.created).getTime() - new Date(a.created).getTime()
    }
    if (sortBy === 'titulo') {
      return a.titulo.localeCompare(b.titulo)
    }
    return 0
  })

  const totalGeralValor = filteredOpps.reduce((sum, o) => sum + (o.valor_estimado || 0), 0)

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-3.5">
      {/*
        BARRA DE FERRAMENTAS SUPERIOR ESTILO PIPEDRIVE (Captura 1):
        - Alternância de visualização: Kanban (ícone colunas), Lista (ícone lista), Tabela (ícone grade)
        - Botão verde Pipedrive "+ Negócio"
        - Totalizador R$ do funil
        - Seletor de "Funil de vendas"
        - Filtro
        - Ordenação ("Ordenar por: Próxima atividade")
      */}
      <div className="bg-white border border-[#E3E7EB] rounded-2xl p-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternância de Visualização */}
          <div className="inline-flex items-center bg-[#F4F6F8] rounded-xl p-1 border border-[#E3E7EB]">
            <button
              type="button"
              onClick={() => handleChangeViewMode('kanban')}
              title="Visualização em Kanban"
              className={cn(
                'p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all',
                viewMode === 'kanban'
                  ? 'bg-white text-[#017848] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Kanban className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangeViewMode('list')}
              title="Visualização em Lista Compacta"
              className={cn(
                'p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all',
                viewMode === 'list'
                  ? 'bg-white text-[#017848] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangeViewMode('table')}
              title="Visualização em Tabela Detalhada"
              className={cn(
                'p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all',
                viewMode === 'table'
                  ? 'bg-white text-[#017848] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
          </div>

          {/* Botão Primário Verde Pipedrive "+ Negócio" */}
          <Button
            size="sm"
            onClick={() => setIsNewOppModalOpen(true)}
            className="h-9 px-3.5 rounded-xl font-bold text-xs bg-[#017848] hover:bg-[#01653c] text-white shadow-sm flex items-center space-x-1 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 mr-0.5" />
            <span>Negócio</span>
          </Button>

          {/* Seletor de Funil de Vendas */}
          {funis.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-[#E3E7EB] bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center space-x-2 transition-colors"
                >
                  <Kanban className="w-3.5 h-3.5 text-slate-500" />
                  <span className="max-w-[160px] truncate">
                    {activeFunil?.nome_funil || 'Funil de vendas'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-xl border-[#E3E7EB]">
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Funis Disponíveis
                </DropdownMenuLabel>
                {funis.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => setActiveFunilId(f.id)}
                    className={cn(
                      'text-xs cursor-pointer font-medium rounded-lg',
                      f.id === activeFunilId ? 'bg-emerald-50 text-[#017848] font-bold' : '',
                    )}
                  >
                    {f.nome_funil}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Filtro de Equipe */}
          {equipes.length > 0 && (
            <Select value={selectedEquipeFilter} onValueChange={setSelectedEquipeFilter}>
              <SelectTrigger className="h-9 text-xs w-36 rounded-xl bg-white border-[#E3E7EB]">
                <SelectValue placeholder="Equipes" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas as Equipes</SelectItem>
                {equipes.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.nome_equipe}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Lado Direito da Barra: Total R$, Busca e Ordenação */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Totalizador Financeiro */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-100/80 border border-[#E3E7EB] text-xs font-bold text-slate-800">
            <span className="text-[11px] text-slate-500 font-normal mr-1">Total:</span>
            {formatCurrencyBRL(totalGeralValor)}
          </div>

          {/* Busca Rápida */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Pesquisar negócio..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-9 pl-8 pr-2 text-xs rounded-xl bg-white border-[#E3E7EB]"
            />
          </div>

          {/* Ordenação estilo Pipedrive ("Ordenar por: Próxima atividade") */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-9 px-3 rounded-xl border border-[#E3E7EB] bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1.5 transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline text-slate-500">Ordenar por:</span>
                <span className="font-bold text-slate-800">
                  {sortBy === 'proxima_acao' && 'Próxima atividade'}
                  {sortBy === 'valor_desc' && 'Maior valor'}
                  {sortBy === 'valor_asc' && 'Menor valor'}
                  {sortBy === 'created_desc' && 'Recentes'}
                  {sortBy === 'titulo' && 'Nome'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-[#E3E7EB]">
              <DropdownMenuItem
                onClick={() => setSortBy('proxima_acao')}
                className="text-xs cursor-pointer rounded-lg"
              >
                Próxima atividade (Follow-up)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy('valor_desc')}
                className="text-xs cursor-pointer rounded-lg"
              >
                Maior valor (R$)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy('valor_asc')}
                className="text-xs cursor-pointer rounded-lg"
              >
                Menor valor (R$)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy('created_desc')}
                className="text-xs cursor-pointer rounded-lg"
              >
                Mais recentes primeiro
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy('titulo')}
                className="text-xs cursor-pointer rounded-lg"
              >
                Título do negócio (A-Z)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sub-barra de Filtros com Chips Pipedrive ("Status é Aberto", Chips 30/60/90 dias e Atrasados) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Chip Status Aberto */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'aberto' ? 'todos' : 'aberto')}
            className={cn(
              'inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer',
              statusFilter === 'aberto'
                ? 'bg-emerald-100 text-[#017848] border border-emerald-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200',
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                statusFilter === 'aberto' ? 'bg-[#017848]' : 'bg-slate-400',
              )}
            />
            <span>{statusFilter === 'aberto' ? 'Status: Em aberto' : 'Status: Todos'}</span>
          </button>

          <span className="text-slate-300">|</span>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Fechamento:
          </span>

          {/* Chip Todos */}
          <button
            type="button"
            onClick={() => setQuickDateFilter('todos')}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
              quickDateFilter === 'todos'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-[#E3E7EB] text-slate-600 hover:bg-slate-50',
            )}
          >
            Todos
          </button>

          {/* Chip Próximos 30 dias */}
          <button
            type="button"
            onClick={() => setQuickDateFilter(quickDateFilter === '30d' ? 'todos' : '30d')}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center space-x-1',
              quickDateFilter === '30d'
                ? 'bg-[#017848] text-white shadow-xs'
                : 'bg-white border border-[#E3E7EB] text-slate-700 hover:border-[#017848] hover:text-[#017848]',
            )}
          >
            <span>Próximos 30 dias</span>
          </button>

          {/* Chip 60 dias */}
          <button
            type="button"
            onClick={() => setQuickDateFilter(quickDateFilter === '60d' ? 'todos' : '60d')}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
              quickDateFilter === '60d'
                ? 'bg-[#017848] text-white shadow-xs'
                : 'bg-white border border-[#E3E7EB] text-slate-700 hover:border-[#017848] hover:text-[#017848]',
            )}
          >
            60 dias
          </button>

          {/* Chip 90 dias */}
          <button
            type="button"
            onClick={() => setQuickDateFilter(quickDateFilter === '90d' ? 'todos' : '90d')}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
              quickDateFilter === '90d'
                ? 'bg-[#017848] text-white shadow-xs'
                : 'bg-white border border-[#E3E7EB] text-slate-700 hover:border-[#017848] hover:text-[#017848]',
            )}
          >
            90 dias
          </button>

          {/* Chip Atrasados */}
          <button
            type="button"
            onClick={() =>
              setQuickDateFilter(quickDateFilter === 'atrasados' ? 'todos' : 'atrasados')
            }
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center space-x-1',
              quickDateFilter === 'atrasados'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100',
            )}
          >
            <Clock className="w-3 h-3" />
            <span>Atrasados</span>
          </button>

          <span className="text-slate-400 text-[11px] ml-2">
            ({filteredOpps.length} {filteredOpps.length === 1 ? 'negócio' : 'negócios'})
          </span>
        </div>

        <div className="text-[11px] text-slate-500">
          Trava de follow-up: <strong className="text-emerald-700">Ativa</strong>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: KANBAN, LISTA OU TABELA */}
      <div className="flex-1 overflow-hidden min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 bg-white rounded-2xl border border-[#E3E7EB]">
            <Loader2 className="w-6 h-6 animate-spin text-[#017848] mr-2" />
            Carregando esteira de negócios...
          </div>
        ) : etapas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#E3E7EB] rounded-2xl bg-white p-8">
            <p className="text-sm font-semibold text-slate-800">Nenhum funil ativo selecionado.</p>
            <p className="text-xs text-slate-500 mt-1">Selecione uma marca ou cadastre um funil.</p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* ================= VISUALIZAÇÃO KANBAN ================= */
          <div className="h-full overflow-x-auto overflow-y-hidden pb-2 scrollbar-thin">
            <div className="flex items-stretch space-x-3.5 h-full min-w-max">
              {etapas.map((etapa, idx) => {
                const colOpps = sortedOpps.filter((o) => o.etapa_atual === etapa)
                const colTotalValor = colOpps.reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
                const isFirstCol = idx === 0

                return (
                  <div
                    key={etapa}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, etapa)}
                    className={cn(
                      'w-[295px] flex flex-col rounded-2xl border border-[#E3E7EB] bg-[#F6F7F9] shadow-xs select-none transition-colors',
                      isFirstCol ? 'bg-slate-100/70 border-slate-300' : '',
                    )}
                  >
                    {/* Cabeçalho da Coluna estilo Pipedrive (Chevron estilizado/topo arredondado) */}
                    <div className="p-3 border-b border-[#E3E7EB] bg-white rounded-t-2xl flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800 truncate">{etapa}</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#1C2833] text-white">
                            {colOpps.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          {formatCurrencyBRL(colTotalValor)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewEtapa(etapa)
                          setDealModalInitialValues({
                            etapa_atual: etapa,
                          })
                          setIsNewOppModalOpen(true)
                        }}
                        title={`Adicionar negócio em ${etapa}`}
                        className="w-6 h-6 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Lista de Cards com Scroll Vertical */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin">
                      {colOpps.map((opp) => {
                        const b2b = opp.expand?.organizacao_id || opp.expand?.cliente_b2b_id
                        const b2c = opp.expand?.pessoa_id || opp.expand?.cliente_b2c_id
                        const clienteNome =
                          b2b?.razao_social || b2c?.nome_completo || 'Cliente Não Vinculado'
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
                              'p-3.5 rounded-xl border bg-white shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all relative group',
                              isShaking
                                ? 'animate-shake border-red-500 ring-2 ring-red-400 bg-red-50/20'
                                : 'border-[#E3E7EB] hover:border-slate-400',
                            )}
                          >
                            {/* Marca visual quando em consolidado */}
                            {isConsolidated && opp.expand?.marca_id && (
                              <span
                                className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 text-white"
                                style={{ backgroundColor: opp.expand.marca_id.cor_destaque }}
                              >
                                {opp.expand.marca_id.nome}
                              </span>
                            )}

                            <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                              {opp.titulo}
                            </p>

                            <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-slate-600 truncate">
                              {b2b ? (
                                <Building2 className="w-3 h-3 text-sky-600 shrink-0" />
                              ) : (
                                <User className="w-3 h-3 text-emerald-600 shrink-0" />
                              )}
                              <span className="truncate">{clienteNome}</span>
                              {opp.tipo_cliente && (
                                <span
                                  className={cn(
                                    'text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0',
                                    opp.tipo_cliente === 'Recompra'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-emerald-100 text-emerald-800',
                                  )}
                                >
                                  {opp.tipo_cliente}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                              <span className="text-xs font-black text-slate-900">
                                {formatCurrencyBRL(opp.valor_estimado)}
                              </span>

                              <div className="w-6 h-6 rounded-full bg-[#017848] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                                {opp.expand?.vendedor_id?.name?.slice(0, 2).toUpperCase() || 'AD'}
                              </div>
                            </div>

                            {/* BADGE DE FOLLOW-UP / TRAVA PIPEDRIVE */}
                            <div className="mt-2.5">
                              {followStatus === 'missing' && (
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                                  <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                  <span className="truncate">Sem follow-up agendado</span>
                                </div>
                              )}
                              {followStatus === 'overdue' && (
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-medium">
                                  <Clock className="w-3 h-3 text-red-600 shrink-0" />
                                  <span className="truncate">
                                    Vencido: {formatDateBR(opp.proxima_acao_data)}
                                  </span>
                                </div>
                              )}
                              {followStatus === 'soon' && (
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium">
                                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="truncate">
                                    Em 48h ({formatDateBR(opp.proxima_acao_data)})
                                  </span>
                                </div>
                              )}
                              {followStatus === 'ok' && (
                                <div className="text-[10px] text-slate-500 flex items-center space-x-1">
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
                        <div className="h-28 flex flex-col items-center justify-center text-[11px] text-slate-400 border border-dashed border-[#E3E7EB] rounded-xl bg-white/50">
                          <span>Nenhum negócio aqui</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Arraste cards para cá
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* FRENTE 2: BOTÃO DISCRETO NO FIM DA ÚLTIMA COLUNA "+ Adicionar nova etapa" (ADMIN ONLY) */}
              {isAdmin && (
                <div className="w-[280px] shrink-0 select-none flex flex-col justify-start">
                  {!isAddingKanbanStage ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingKanbanStage(true)}
                      className="w-full h-12 rounded-2xl border-2 border-dashed border-[#D5DBDB] hover:border-[#017848] bg-white/50 hover:bg-emerald-50/40 text-slate-600 hover:text-[#017848] text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar nova etapa</span>
                    </button>
                  ) : (
                    <div className="p-3.5 bg-white border border-[#E3E7EB] rounded-2xl shadow-md space-y-2.5 animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">
                          Nova Etapa do Funil
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddingKanbanStage(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      </div>

                      <div>
                        <Label className="text-[10px] font-semibold text-slate-600">
                          Nome da Etapa
                        </Label>
                        <Input
                          autoFocus
                          value={kanbanStageNome}
                          onChange={(e) => setKanbanStageNome(e.target.value)}
                          placeholder="ex: Envio de Amostra"
                          className="h-8 text-xs rounded-lg mt-0.5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveKanbanStageInline()
                          }}
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] font-semibold text-slate-600">
                          Valor de Referência (R$)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={kanbanStageValor}
                          onChange={(e) => setKanbanStageValor(e.target.value)}
                          placeholder="0,00"
                          className="h-8 text-xs rounded-lg mt-0.5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveKanbanStageInline()
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-end space-x-1.5 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsAddingKanbanStage(false)}
                          className="h-7 text-xs text-slate-500 rounded-lg px-2"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSavingKanbanStage || !kanbanStageNome.trim()}
                          onClick={handleSaveKanbanStageInline}
                          className="h-7 text-xs font-bold rounded-lg bg-[#017848] hover:bg-[#01653c] text-white px-3"
                        >
                          {isSavingKanbanStage ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Salvar'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'list' ? (
          /* ================= VISUALIZAÇÃO EM LISTA ================= */
          <Card className="h-full overflow-y-auto border-[#E3E7EB] bg-white rounded-2xl shadow-xs p-3">
            <div className="space-y-2">
              {sortedOpps.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhum negócio encontrado com os filtros atuais.
                </div>
              ) : (
                sortedOpps.map((opp) => {
                  const b2b = opp.expand?.organizacao_id || opp.expand?.cliente_b2b_id
                  const b2c = opp.expand?.pessoa_id || opp.expand?.cliente_b2c_id
                  const clienteNome =
                    b2b?.razao_social || b2c?.nome_completo || 'Cliente Não Vinculado'
                  const followStatus = getFollowUpStatus(opp.proxima_acao_data)
                  const isShaking = shakingOppId === opp.id

                  return (
                    <div
                      key={opp.id}
                      onClick={() => {
                        searchParams.set('oppId', opp.id)
                        setSearchParams(searchParams)
                      }}
                      className={cn(
                        'p-3.5 rounded-xl border border-[#E3E7EB] hover:border-slate-400 bg-white hover:bg-slate-50/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer',
                        isShaking &&
                          'animate-shake border-red-500 ring-2 ring-red-400 bg-red-50/20',
                      )}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#017848]/10 text-[#017848] flex items-center justify-center shrink-0">
                          <Kanban className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-bold text-xs text-slate-900 truncate">
                              {opp.titulo}
                            </p>
                            {isConsolidated && opp.expand?.marca_id && (
                              <span
                                className="text-[9px] font-bold px-2 py-0.2 rounded-full text-white shrink-0"
                                style={{ backgroundColor: opp.expand.marca_id.cor_destaque }}
                              >
                                {opp.expand.marca_id.nome}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5 truncate">
                            {b2b ? (
                              <Building2 className="w-3 h-3 text-sky-600 shrink-0" />
                            ) : (
                              <User className="w-3 h-3 text-emerald-600 shrink-0" />
                            )}
                            <span className="truncate">{clienteNome}</span>
                            {opp.tipo_cliente && (
                              <>
                                <span>•</span>
                                <span
                                  className={cn(
                                    'text-[10px] font-bold px-1.5 py-0.5 rounded',
                                    opp.tipo_cliente === 'Recompra'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-emerald-100 text-emerald-800',
                                  )}
                                >
                                  {opp.tipo_cliente}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span>Resp: {opp.expand?.vendedor_id?.name || 'Administrador'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ações e Etapa da Lista */}
                      <div className="flex items-center space-x-4 shrink-0 justify-between md:justify-end">
                        {/* Seletor rápido de Etapa */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1.5"
                        >
                          <span className="text-[10px] text-slate-400 font-medium">Etapa:</span>
                          <Select
                            value={opp.etapa_atual}
                            onValueChange={(val) => handleQuickChangeEtapa(opp, val)}
                          >
                            <SelectTrigger className="h-8 text-xs w-36 rounded-lg bg-white border-[#E3E7EB]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {etapas.map((et) => (
                                <SelectItem key={et} value={et}>
                                  {et}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status de Follow-up */}
                        <div className="w-36 text-right">
                          {followStatus === 'missing' && (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] rounded-full">
                              Sem follow-up
                            </Badge>
                          )}
                          {followStatus === 'overdue' && (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] rounded-full">
                              Vencido ({formatDateBR(opp.proxima_acao_data)})
                            </Badge>
                          )}
                          {followStatus === 'soon' && (
                            <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] rounded-full">
                              Em 48h ({formatDateBR(opp.proxima_acao_data)})
                            </Badge>
                          )}
                          {followStatus === 'ok' && (
                            <span className="text-[11px] text-slate-600 font-medium">
                              {formatDateBR(opp.proxima_acao_data)}
                            </span>
                          )}
                        </div>

                        {/* Valor Estimado */}
                        <span className="font-black text-xs text-slate-900 w-28 text-right">
                          {formatCurrencyBRL(opp.valor_estimado)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        ) : (
          /* ================= VISUALIZAÇÃO EM TABELA ================= */
          <Card className="h-full overflow-hidden border-[#E3E7EB] bg-white rounded-2xl shadow-xs flex flex-col">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E3E7EB] text-[10px] uppercase font-bold tracking-wider text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Negócio</th>
                    <th className="px-4 py-3">Contato / Organização</th>
                    <th className="px-4 py-3">Etapa Atual</th>
                    <th className="px-4 py-3 text-right">Valor Estimado</th>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Próximo Follow-up</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EB]/60">
                  {sortedOpps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        Nenhum negócio cadastrado com estes filtros.
                      </td>
                    </tr>
                  ) : (
                    sortedOpps.map((op) => {
                      const b2b = op.expand?.organizacao_id || op.expand?.cliente_b2b_id
                      const b2c = op.expand?.pessoa_id || op.expand?.cliente_b2c_id
                      const clienteNome =
                        b2b?.razao_social || b2c?.nome_completo || 'Cliente Não Vinculado'
                      const followStatus = getFollowUpStatus(op.proxima_acao_data)
                      const isShaking = shakingOppId === op.id

                      return (
                        <tr
                          key={op.id}
                          onClick={() => {
                            searchParams.set('oppId', op.id)
                            setSearchParams(searchParams)
                          }}
                          className={cn(
                            'hover:bg-slate-50/80 cursor-pointer transition-colors',
                            isShaking && 'bg-red-50/40',
                          )}
                        >
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{op.titulo}</p>
                            {isConsolidated && op.expand?.marca_id && (
                              <span
                                className="text-[10px] font-semibold"
                                style={{ color: op.expand.marca_id.cor_destaque }}
                              >
                                {op.expand.marca_id.nome}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex items-center space-x-1.5 truncate">
                              {b2b ? (
                                <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                              <span className="truncate">{clienteNome}</span>
                              {op.tipo_cliente && (
                                <span
                                  className={cn(
                                    'text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0',
                                    op.tipo_cliente === 'Recompra'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-emerald-100 text-emerald-800',
                                  )}
                                >
                                  {op.tipo_cliente}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={op.etapa_atual}
                              onValueChange={(val) => handleQuickChangeEtapa(op, val)}
                            >
                              <SelectTrigger className="h-7 text-xs w-36 rounded-lg bg-white border-[#E3E7EB]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {etapas.map((et) => (
                                  <SelectItem key={et} value={et}>
                                    {et}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">
                            {formatCurrencyBRL(op.valor_estimado)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {op.expand?.vendedor_id?.name || 'Administrador NTC'}
                          </td>
                          <td className="px-4 py-3">
                            {followStatus === 'missing' && (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] rounded-full">
                                Sem follow-up
                              </Badge>
                            )}
                            {followStatus === 'overdue' && (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] rounded-full">
                                Vencido ({formatDateBR(op.proxima_acao_data)})
                              </Badge>
                            )}
                            {followStatus === 'soon' && (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] rounded-full">
                                Em 48h ({formatDateBR(op.proxima_acao_data)})
                              </Badge>
                            )}
                            {followStatus === 'ok' && (
                              <span className="text-[11px] text-slate-600">
                                {formatDateBR(op.proxima_acao_data)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-[#017848] hover:bg-emerald-50 h-7 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                searchParams.set('oppId', op.id)
                                setSearchParams(searchParams)
                              }}
                            >
                              Ver Ficha
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* DRAWER DE DETALHES DE OPORTUNIDADE COMPARTILHADO */}
      <OpportunityDrawer
        opportunityId={selectedOppId}
        onClose={() => {
          searchParams.delete('oppId')
          setSearchParams(searchParams)
        }}
        onUpdate={loadOportunidades}
        onDuplicate={(opp) => {
          searchParams.delete('oppId')
          setSearchParams(searchParams)
          setDealModalInitialValues({
            titulo: `${opp.titulo} (Cópia)`,
            valor: opp.valor_estimado,
            etapa_atual: opp.etapa_atual,
            cliente_b2b_id: opp.cliente_b2b_id || opp.organizacao_id,
            cliente_b2c_id: opp.cliente_b2c_id || opp.pessoa_id,
            documento_faturamento: opp.documento_faturamento,
            observacoes: opp.observacoes,
            origem: opp.origem,
          })
          setIsNewOppModalOpen(true)
        }}
      />

      {/* MODAL NOVO NEGÓCIO IDÊNTICO AO PIPEDRIVE */}
      <AddDealModal
        open={isNewOppModalOpen}
        onOpenChange={(val) => {
          setIsNewOppModalOpen(val)
          if (!val) {
            setDealModalInitialValues(undefined)
            setNewEtapa('')
          }
        }}
        defaultFunilId={activeFunilId}
        defaultEtapaNome={newEtapa || dealModalInitialValues?.etapa_atual}
        initialValues={dealModalInitialValues}
        onSuccess={() => {
          setDealModalInitialValues(undefined)
          setNewEtapa('')
          loadOportunidades()
        }}
      />

      {/* MODAL DE CONFIRMAÇÃO DE AVANÇO DE ETAPA COM PRÓXIMO FOLLOW-UP OBRIGATÓRIO */}
      <Dialog open={dragConfirmModalOpen} onOpenChange={setDragConfirmModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Confirmar Avanço de Etapa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-600">
              Movendo <strong>{draggedOpportunity?.titulo}</strong> para a etapa:{' '}
              <Badge className="bg-[#017848] text-white text-[11px] ml-1 rounded-full">
                {targetEtapa}
              </Badge>
            </p>

            <div className="p-3 bg-slate-50 border border-[#E3E7EB] rounded-xl space-y-2">
              <p className="font-bold text-slate-900">Agendar Próxima Ação (Follow-up)</p>
              <div>
                <Label className="text-[10px] font-semibold text-slate-600">
                  Data da Próxima Interação{' '}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input
                  type="date"
                  value={dragFollowUpData}
                  onChange={(e) => setDragFollowUpData(e.target.value)}
                  className="h-8 text-xs bg-white rounded-lg"
                />
              </div>
              <div>
                <Label className="text-[10px] font-semibold text-slate-600">
                  Descrição da Ação <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input
                  value={dragFollowUpDesc}
                  onChange={(e) => setDragFollowUpDesc(e.target.value)}
                  placeholder="ex: Enviar minuta contratual ou agendar reunião técnica (opcional)"
                  className="h-8 text-xs bg-white rounded-lg"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDragConfirmModalOpen(false)}
              className="text-xs rounded-xl border-[#E3E7EB]"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={confirmMoveEtapa}
              className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
            >
              Confirmar & Salvar Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
