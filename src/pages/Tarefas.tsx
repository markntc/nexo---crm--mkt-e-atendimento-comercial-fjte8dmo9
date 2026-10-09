// src/pages/Tarefas.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Atividade, Oportunidade } from '@/types'
import { formatDateBR } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  CheckSquare,
  Plus,
  Phone,
  Video,
  MapPin,
  Mail,
  MessageCircle,
  HelpCircle,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Briefcase,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Tarefas() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { activeBrand, marcas } = useBrand()
  const {
    user,
    isAdmin,
    isDiretoria,
    isSupervisor,
    isVendedor,
    isRepresentante,
    escopoVisibilidade,
  } = useAuth()

  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [tipoFilter, setTipoFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'concluida'>('all')

  // Estados de colapso das seções
  const [openVencidas, setOpenVencidas] = useState(true)
  const [openProximas, setOpenProximas] = useState(true)
  const [openPosteriores, setOpenPosteriores] = useState(true)
  const [openConcluidas, setOpenConcluidas] = useState(false)

  // Modal Nova Tarefa
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [newTipo, setNewTipo] = useState<Atividade['tipo']>('Ligação')
  const [newDescricao, setNewDescricao] = useState('')
  const [newVencimento, setNewVencimento] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
  )
  const [newOppId, setNewOppId] = useState('')
  const [oppList, setOppList] = useState<Oportunidade[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchTarefas = async () => {
    setIsLoading(true)
    try {
      const filters: string[] = []
      if (activeBrand) {
        filters.push(`marca_id = "${activeBrand.id}"`)
      }
      if (tipoFilter !== 'all') {
        filters.push(`tipo = "${tipoFilter}"`)
      }
      if (statusFilter === 'pendente') {
        filters.push(`concluida = false`)
      } else if (statusFilter === 'concluida') {
        filters.push(`concluida = true`)
      }

      // Escopo de visibilidade:
      if (user && !isAdmin && !isDiretoria) {
        if (isVendedor && escopoVisibilidade === 'proprios') {
          filters.push(`responsavel_id = "${user.id}"`)
        } else if (escopoVisibilidade === 'proprios') {
          filters.push(`responsavel_id = "${user.id}"`)
        }
      }

      const filter = filters.join(' && ')

      const res = await pb.collection('atividades').getFullList<Atividade>({
        filter: filter || undefined,
        expand: 'marca_id,oportunidade_id,responsavel_id',
        sort: 'data_vencimento',
      })
      setAtividades(res)
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTarefas()
  }, [activeBrand, tipoFilter, statusFilter, user?.id, escopoVisibilidade])
  // Carrega lista de oportunidades para vincular no modal
  const loadOpportunitiesForTask = async () => {
    try {
      const res = await pb.collection('oportunidades').getFullList<Oportunidade>({
        filter: activeBrand ? `marca_id = "${activeBrand.id}"` : undefined,
        sort: '-created',
      })
      setOppList(res)
      if (res.length > 0 && !newOppId) {
        setNewOppId(res[0].id)
      }
    } catch (err) {
      console.error('Erro ao buscar oportunidades:', err)
    }
  }

  useEffect(() => {
    if (isNewTaskOpen) {
      loadOpportunitiesForTask()
    }
  }, [isNewTaskOpen])

  const handleToggleConcluir = async (at: Atividade) => {
    try {
      await pb.collection('atividades').update(at.id, {
        concluida: !at.concluida,
      })
      fetchTarefas()
    } catch (err) {
      console.error('Erro ao alternar conclusão da tarefa:', err)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOppId) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma oportunidade',
        description: 'Toda tarefa comercial deve estar ancorada em uma negociação.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const opp = oppList.find((o) => o.id === newOppId)
      const marcaId = opp ? opp.marca_id : activeBrand?.id || (marcas[0]?.id ?? '')

      await pb.collection('atividades').create({
        marca_id: marcaId,
        oportunidade_id: newOppId,
        responsavel_id: pb.authStore.record?.id,
        tipo: newTipo,
        descricao: newDescricao.trim(),
        data_vencimento: new Date(newVencimento).toISOString(),
        concluida: false,
      })

      // Atualiza o follow up da oportunidade vinculada
      await pb.collection('oportunidades').update(newOppId, {
        proxima_acao_data: new Date(newVencimento).toISOString(),
        proxima_acao_descricao: newDescricao.trim(),
      })

      toast({
        title: 'Tarefa cadastrada',
        description: 'Compromisso agendado na esteira comercial da oportunidade.',
      })

      setIsNewTaskOpen(false)
      setNewDescricao('')
      fetchTarefas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar tarefa'
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: msg,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Ícones por tipo de atividade
  const getTipoIcon = (tipo: Atividade['tipo']) => {
    switch (tipo) {
      case 'Ligação':
        return <Phone className="w-3.5 h-3.5 text-blue-600" />
      case 'Reunião':
        return <Video className="w-3.5 h-3.5 text-purple-600" />
      case 'Visita':
        return <MapPin className="w-3.5 h-3.5 text-amber-600" />
      case 'E-mail':
        return <Mail className="w-3.5 h-3.5 text-emerald-600" />
      case 'WhatsApp':
        return <MessageCircle className="w-3.5 h-3.5 text-green-600" />
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
    }
  }

  // Separação em seções: Vencidas, Próximas 7 dias, Posteriores, Concluídas
  const now = new Date()
  const next7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

  const tarefasConcluidas = atividades.filter((a) => a.concluida)
  const tarefasPendentes = atividades.filter((a) => !a.concluida)

  const tarefasVencidas = tarefasPendentes.filter((a) => {
    const d = new Date(a.data_vencimento)
    return d.getTime() < now.getTime()
  })

  const tarefasProximas7 = tarefasPendentes.filter((a) => {
    const d = new Date(a.data_vencimento)
    return d.getTime() >= now.getTime() && d.getTime() <= next7Days.getTime()
  })

  const tarefasPosteriores = tarefasPendentes.filter((a) => {
    const d = new Date(a.data_vencimento)
    return d.getTime() > next7Days.getTime()
  })

  const renderTaskRow = (at: Atividade) => {
    const isOverdue = !at.concluida && new Date(at.data_vencimento).getTime() < now.getTime()
    const isWithin48h =
      !at.concluida &&
      new Date(at.data_vencimento).getTime() >= now.getTime() &&
      new Date(at.data_vencimento).getTime() <= now.getTime() + 48 * 3600 * 1000

    return (
      <div
        key={at.id}
        className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs border-b border-[#D5DBDB]/50 last:border-0"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={() => handleToggleConcluir(at)}
            className="w-4 h-4 rounded border border-[#5D6D7E] hover:border-emerald-600 hover:bg-emerald-50 flex items-center justify-center shrink-0 transition-colors"
          >
            {at.concluida && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          </button>

          <div className="p-1.5 rounded-md bg-slate-100 shrink-0">{getTipoIcon(at.tipo)}</div>

          <div className="min-w-0">
            <p
              className={cn(
                'font-bold truncate',
                at.concluida ? 'line-through text-[#5D6D7E]' : 'text-[#1C2833]',
              )}
            >
              {at.descricao}
            </p>
            <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-[#5D6D7E] truncate">
              {at.expand?.oportunidade_id ? (
                <button
                  type="button"
                  onClick={() => navigate(`/negocios?oppId=${at.expand?.oportunidade_id?.id}`)}
                  className="font-medium text-[#1B4F72] hover:underline flex items-center truncate"
                >
                  <Briefcase className="w-3 h-3 mr-1 inline shrink-0" />
                  <span className="truncate">{at.expand.oportunidade_id.titulo}</span>
                </button>
              ) : (
                <span>Oportunidade Geral</span>
              )}
              <span>•</span>
              <span>Resp: {at.expand?.responsavel_id?.name || 'Administrador'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <div
            className={cn(
              'flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded',
              isOverdue
                ? 'bg-red-50 text-red-600'
                : isWithin48h
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-[#5D6D7E]',
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDateBR(at.data_vencimento)}</span>
          </div>
        </div>
      </div>
    )
  }

  if (isRepresentante) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
            Gestão Comercial de Tarefas & Follow-ups
          </h1>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Controle disciplinado de compromissos por oportunidade para assegurar avanço de funil
          </p>
        </div>

        <Button
          onClick={() => setIsNewTaskOpen(true)}
          size="sm"
          className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Tarefa
        </Button>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="h-9 text-xs w-40 bg-white border-[#D5DBDB]">
            <SelectValue placeholder="Tipo de Tarefa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="Ligação">Ligação</SelectItem>
            <SelectItem value="Reunião">Reunião</SelectItem>
            <SelectItem value="Visita">Visita</SelectItem>
            <SelectItem value="E-mail">E-mail</SelectItem>
            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
            <SelectItem value="Outro">Outro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 text-xs w-40 bg-white border-[#D5DBDB]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Tarefas</SelectItem>
            <SelectItem value="pendente">Apenas Pendentes</SelectItem>
            <SelectItem value="concluida">Apenas Concluídas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SEÇÕES COLAPSÁVEIS */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-xs text-[#5D6D7E]">
          <Loader2 className="w-6 h-6 animate-spin text-[#1B4F72] mb-2" />
          Carregando agenda comercial...
        </div>
      ) : (
        <div className="space-y-4">
          {/* SEÇÃO 1: VENCIDAS */}
          <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenVencidas(!openVencidas)}
              className="w-full px-4 py-3 bg-red-50/60 border-b border-[#D5DBDB] flex items-center justify-between text-left hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-red-900 uppercase tracking-wider">
                  Vencidas ({tarefasVencidas.length})
                </span>
              </div>
              {openVencidas ? (
                <ChevronDown className="w-4 h-4 text-red-800" />
              ) : (
                <ChevronRight className="w-4 h-4 text-red-800" />
              )}
            </button>
            {openVencidas && (
              <div>
                {tarefasVencidas.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#5D6D7E]">
                    Nenhuma tarefa em atraso. Excelente ritmo de execução!
                  </div>
                ) : (
                  tarefasVencidas.map(renderTaskRow)
                )}
              </div>
            )}
          </Card>

          {/* SEÇÃO 2: PRÓXIMOS 7 DIAS */}
          <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenProximas(!openProximas)}
              className="w-full px-4 py-3 bg-slate-50 border-b border-[#D5DBDB] flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#1B4F72]" />
                <span className="text-xs font-bold text-[#1C2833] uppercase tracking-wider">
                  Próximos 7 Dias ({tarefasProximas7.length})
                </span>
              </div>
              {openProximas ? (
                <ChevronDown className="w-4 h-4 text-[#5D6D7E]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#5D6D7E]" />
              )}
            </button>
            {openProximas && (
              <div>
                {tarefasProximas7.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#5D6D7E]">
                    Nenhuma tarefa agendada para os próximos 7 dias.
                  </div>
                ) : (
                  tarefasProximas7.map(renderTaskRow)
                )}
              </div>
            )}
          </Card>

          {/* SEÇÃO 3: POSTERIORES */}
          <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenPosteriores(!openPosteriores)}
              className="w-full px-4 py-3 bg-slate-50 border-b border-[#D5DBDB] flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#5D6D7E]" />
                <span className="text-xs font-bold text-[#1C2833] uppercase tracking-wider">
                  Posteriores ({tarefasPosteriores.length})
                </span>
              </div>
              {openPosteriores ? (
                <ChevronDown className="w-4 h-4 text-[#5D6D7E]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#5D6D7E]" />
              )}
            </button>
            {openPosteriores && (
              <div>
                {tarefasPosteriores.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#5D6D7E]">
                    Nenhuma tarefa com prazo além de 7 dias.
                  </div>
                ) : (
                  tarefasPosteriores.map(renderTaskRow)
                )}
              </div>
            )}
          </Card>

          {/* SEÇÃO 4: CONCLUÍDAS */}
          <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenConcluidas(!openConcluidas)}
              className="w-full px-4 py-3 bg-slate-50 border-b border-[#D5DBDB] flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-[#1C2833] uppercase tracking-wider">
                  Concluídas ({tarefasConcluidas.length})
                </span>
              </div>
              {openConcluidas ? (
                <ChevronDown className="w-4 h-4 text-[#5D6D7E]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#5D6D7E]" />
              )}
            </button>
            {openConcluidas && (
              <div>
                {tarefasConcluidas.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#5D6D7E]">
                    Nenhuma tarefa finalizada no momento.
                  </div>
                ) : (
                  tarefasConcluidas.map(renderTaskRow)
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL NOVA TAREFA */}
      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Agendar Nova Tarefa Comercial
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Oportunidade Vinculada</Label>
              <Select value={newOppId} onValueChange={setNewOppId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a oportunidade..." />
                </SelectTrigger>
                <SelectContent>
                  {oppList.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Tipo</Label>
                <Select value={newTipo} onValueChange={(v) => setNewTipo(v as Atividade['tipo'])}>
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
                  Data de Vencimento <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input
                  type="date"
                  value={newVencimento}
                  onChange={(e) => setNewVencimento(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">
                Descrição do Compromisso{' '}
                <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Input
                placeholder="ex: Enviar orçamento ou confirmar horário de visita (opcional)"
                value={newDescricao}
                onChange={(e) => setNewDescricao(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewTaskOpen(false)}
                className="text-xs border-[#D5DBDB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Agendar Tarefa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
