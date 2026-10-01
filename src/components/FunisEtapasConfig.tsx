// src/components/FunisEtapasConfig.tsx
// Tela de Gestão de Funis e Etapas (Frente 1) no Padrão Pipedrive
// Apenas Administradores: CRUD completo de Funis por marca ativa, reordenação com Drag & Drop,
// definição de isWonStage / isLostStage, valor monetário de referência por etapa,
// detecção de concorrência e remanejamento obrigatório de oportunidades ao excluir etapa.

import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type { Funil, EtapaConfig, EtapaItem, Oportunidade } from '@/types'
import { getEtapaNome, isWonStage, isLostStage } from '@/lib/relationshipStatus'
import { formatCurrencyBRL } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  GripVertical,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Trophy,
  XCircle,
  DollarSign,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface FunisEtapasConfigProps {
  isAdmin: boolean
}

export function FunisEtapasConfig({ isAdmin }: FunisEtapasConfigProps) {
  const { activeBrand, marcas } = useBrand()

  const [funis, setFunis] = useState<Funil[]>([])
  const [selectedFunilId, setSelectedFunilId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  // Estado local para edição do funil selecionado
  const [editingFunil, setEditingFunil] = useState<Funil | null>(null)
  const [nomeFunilInput, setNomeFunilInput] = useState('')
  const [etapasList, setEtapasList] = useState<EtapaConfig[]>([])
  const [lastKnownUpdated, setLastKnownUpdated] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Modal Novo Funil
  const [isNewFunilModalOpen, setIsNewFunilModalOpen] = useState(false)
  const [newFunilNome, setNewFunilNome] = useState('')
  const [newFunilMarcaId, setNewFunilMarcaId] = useState('')

  // Modal Adicionar/Editar Etapa
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false)
  const [editingEtapaIndex, setEditingEtapaIndex] = useState<number | null>(null)
  const [modalEtapaNome, setModalEtapaNome] = useState('')
  const [modalEtapaValor, setModalEtapaValor] = useState<string>('')
  const [modalEtapaIsWon, setModalEtapaIsWon] = useState(false)
  const [modalEtapaIsLost, setModalEtapaIsLost] = useState(false)

  // Modal de Exclusão de Etapa com Remanejamento Obrigatório de Negócios (Estilo Pipedrive)
  const [deleteStageIndex, setDeleteStageIndex] = useState<number | null>(null)
  const [stageDealsCount, setStageDealsCount] = useState<number>(0)
  const [destinationStageName, setDestinationStageName] = useState<string>('')
  const [isMigratingDeals, setIsMigratingDeals] = useState(false)

  // Modal Concorrência Detectada
  const [concurrencyModalOpen, setConcurrencyModalOpen] = useState(false)

  // Drag and Drop de etapas
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Carregar funis da marca
  const loadFunis = async () => {
    setIsLoading(true)
    try {
      const filter = activeBrand ? `marca_id = "${activeBrand.id}"` : undefined
      const res = await pb.collection('funis').getFullList<Funil>({
        filter,
        sort: 'nome_funil',
      })
      setFunis(res)

      if (res.length > 0) {
        const target =
          selectedFunilId && res.some((f) => f.id === selectedFunilId)
            ? res.find((f) => f.id === selectedFunilId)!
            : res[0]
        selectFunil(target)
      } else {
        setEditingFunil(null)
        setSelectedFunilId('')
        setEtapasList([])
      }
    } catch (err) {
      console.error('Erro ao carregar funis:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar funis',
        description: 'Não foi possível carregar a lista de funis da marca.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFunis()
  }, [activeBrand])

  // Normaliza etapas do formato antigo (strings) para EtapaConfig
  const normalizeEtapas = (raw: EtapaItem[]): EtapaConfig[] => {
    if (!Array.isArray(raw)) return []
    return raw.map((item) => {
      if (typeof item === 'string') {
        const won = isWonStage(item)
        const lost = isLostStage(item)
        return {
          nome: item,
          valor_referencia: 0,
          is_won: won,
          is_lost: lost,
        }
      }
      return {
        nome: item.nome || '',
        valor_referencia: item.valor_referencia || 0,
        is_won: item.is_won !== undefined ? item.is_won : isWonStage(item.nome),
        is_lost: item.is_lost !== undefined ? item.is_lost : isLostStage(item.nome),
      }
    })
  }

  const selectFunil = (f: Funil) => {
    setSelectedFunilId(f.id)
    setEditingFunil(f)
    setNomeFunilInput(f.nome_funil)
    setLastKnownUpdated(f.updated)
    setEtapasList(normalizeEtapas(f.etapas_ordenadas || []))
  }

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const updated = [...etapasList]
    const [removed] = updated.splice(draggedIndex, 1)
    updated.splice(dropIndex, 0, removed)
    setEtapasList(updated)
    setDraggedIndex(null)
  }

  // Modal de Nova / Editar Etapa
  const openNewEtapaModal = () => {
    setEditingEtapaIndex(null)
    setModalEtapaNome('')
    setModalEtapaValor('')
    setModalEtapaIsWon(false)
    setModalEtapaIsLost(false)
    setIsEtapaModalOpen(true)
  }

  const openEditEtapaModal = (index: number) => {
    const item = etapasList[index]
    if (!item) return
    setEditingEtapaIndex(index)
    setModalEtapaNome(item.nome)
    setModalEtapaValor(item.valor_referencia ? String(item.valor_referencia) : '')
    setModalEtapaIsWon(Boolean(item.is_won))
    setModalEtapaIsLost(Boolean(item.is_lost))
    setIsEtapaModalOpen(true)
  }

  const handleSaveEtapaModal = () => {
    const trimmedNome = modalEtapaNome.trim()
    if (!trimmedNome) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe um nome válido para a etapa.',
      })
      return
    }

    const numValor = parseFloat(modalEtapaValor) || 0

    // Regra: se marcou como ganho, desmarca perdido; e vice-versa
    let isWon = modalEtapaIsWon
    let isLost = modalEtapaIsLost
    if (isWon && isLost) {
      isLost = false
    }

    const newConfig: EtapaConfig = {
      nome: trimmedNome,
      valor_referencia: numValor,
      is_won: isWon,
      is_lost: isLost,
    }

    const updated = [...etapasList]

    // Se marcou como ganho único ou perdido, garante que outras não colidam caso desejado
    if (editingEtapaIndex !== null) {
      updated[editingEtapaIndex] = newConfig
    } else {
      updated.push(newConfig)
    }

    setEtapasList(updated)
    setIsEtapaModalOpen(false)
  }

  // Iniciar exclusão de etapa com verificação de negócios vinculados
  const handlePromptDeleteEtapa = async (index: number) => {
    const stage = etapasList[index]
    if (!stage || !editingFunil) return

    if (etapasList.length <= 1) {
      toast({
        variant: 'destructive',
        title: 'Operação não permitida',
        description: 'Um funil precisa ter ao menos uma etapa cadastrada.',
      })
      return
    }

    try {
      // Conta quantas oportunidades estão na etapa
      const opps = await pb.collection('oportunidades').getFullList<Oportunidade>({
        filter: `funil_id = "${editingFunil.id}" && etapa_atual = "${stage.nome}"`,
      })

      setStageDealsCount(opps.length)
      setDeleteStageIndex(index)

      // Seleciona uma etapa de destino padrão diferente da que está sendo excluída
      const otherStages = etapasList.filter((_, i) => i !== index)
      setDestinationStageName(otherStages[0]?.nome || '')
    } catch (err) {
      console.error('Erro ao verificar oportunidades da etapa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao verificar negócios',
        description: 'Não foi possível consultar os negócios desta etapa.',
      })
    }
  }

  // Confirmação de exclusão com migração (remanejamento) de negócios
  const handleConfirmDeleteEtapa = async () => {
    if (deleteStageIndex === null || !editingFunil) return

    const stageToDelete = etapasList[deleteStageIndex]
    if (!stageToDelete) return

    setIsMigratingDeals(true)
    try {
      if (stageDealsCount > 0) {
        if (!destinationStageName) {
          toast({
            variant: 'destructive',
            title: 'Etapa de destino obrigatória',
            description: 'Selecione para qual etapa os negócios devem ser remanejados.',
          })
          setIsMigratingDeals(false)
          return
        }

        // Remaneja todas as oportunidades para a nova etapa
        const opps = await pb.collection('oportunidades').getFullList<Oportunidade>({
          filter: `funil_id = "${editingFunil.id}" && etapa_atual = "${stageToDelete.nome}"`,
        })

        for (const op of opps) {
          await pb.collection('oportunidades').update(op.id, {
            etapa_atual: destinationStageName,
          })
        }

        toast({
          title: `${opps.length} negócio(s) remanejado(s)`,
          description: `Negócios movidos para "${destinationStageName}" com sucesso.`,
        })
      }

      // Remove a etapa da lista local
      const updated = etapasList.filter((_, i) => i !== deleteStageIndex)
      setEtapasList(updated)
      setDeleteStageIndex(null)

      toast({
        title: 'Etapa removida da lista',
        description: 'Clique em "Salvar Alterações" para persistir o funil.',
      })
    } catch (err) {
      console.error('Erro ao remanejar e excluir etapa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no remanejamento',
        description: 'Falha ao mover negócios para a nova etapa.',
      })
    } finally {
      setIsMigratingDeals(false)
    }
  }

  // Salvar Funil com detecção de concorrência
  const handleSaveFunil = async (forceOverwrite = false) => {
    if (!editingFunil) return
    const trimmedNome = nomeFunilInput.trim()
    if (!trimmedNome) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'O funil precisa ter um nome válido.',
      })
      return
    }

    if (etapasList.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Ao menos uma etapa',
        description: 'O funil deve conter ao menos 1 etapa.',
      })
      return
    }

    setIsSaving(true)
    try {
      // 1. Verifica concorrência buscando o registro fresco no backend
      const freshRecord = await pb.collection('funis').getOne<Funil>(editingFunil.id)
      if (!forceOverwrite && freshRecord.updated !== lastKnownUpdated) {
        // Concorrência detectada!
        setConcurrencyModalOpen(true)
        setIsSaving(false)
        return
      }

      // 2. Persiste formato JSON preservando a estrutura
      const updatedRecord = await pb.collection('funis').update<Funil>(editingFunil.id, {
        nome_funil: trimmedNome,
        etapas_ordenadas: etapasList,
      })

      setEditingFunil(updatedRecord)
      setLastKnownUpdated(updatedRecord.updated)
      setConcurrencyModalOpen(false)

      toast({
        title: 'Funil salvo com sucesso!',
        description: `As etapas de "${trimmedNome}" foram atualizadas no CRM.`,
      })

      // Atualiza lista em memória
      setFunis((prev) => prev.map((f) => (f.id === updatedRecord.id ? updatedRecord : f)))
    } catch (err: unknown) {
      console.error('Erro ao salvar funil:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar funil'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Criar Novo Funil
  const handleCreateNewFunil = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newFunilNome.trim()
    const marcaId = newFunilMarcaId || activeBrand?.id || (marcas[0]?.id ?? '')

    if (!trimmed || !marcaId) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o nome do funil e a marca correspondente.',
      })
      return
    }

    try {
      // Etapas padrão Pipedrive inicial
      const defaultEtapas: EtapaConfig[] = [
        { nome: 'Contato Inicial', valor_referencia: 10000, is_won: false, is_lost: false },
        { nome: 'Qualificação Técnica', valor_referencia: 25000, is_won: false, is_lost: false },
        { nome: 'Proposta Comercial', valor_referencia: 50000, is_won: false, is_lost: false },
        { nome: 'Negociação', valor_referencia: 50000, is_won: false, is_lost: false },
        { nome: 'Fechado Ganho', valor_referencia: 50000, is_won: true, is_lost: false },
        { nome: 'Fechado Perdido', valor_referencia: 0, is_won: false, is_lost: true },
      ]

      const newRec = await pb.collection('funis').create<Funil>({
        nome_funil: trimmed,
        marca_id: marcaId,
        etapas_ordenadas: defaultEtapas,
      })

      toast({
        title: 'Funil criado com sucesso!',
        description: `"${trimmed}" agora está disponível para a equipe.`,
      })

      setIsNewFunilModalOpen(false)
      setNewFunilNome('')
      await loadFunis()
      selectFunil(newRec)
    } catch (err: unknown) {
      console.error('Erro ao criar funil:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao criar novo funil'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    }
  }

  if (!isAdmin) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-6 flex items-center space-x-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Acesso Restrito</p>
            <p className="text-xs text-amber-800">
              Apenas administradores têm permissão para criar e gerenciar funis e etapas.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA SEÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833] flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#017848]" />
            Funis e Etapas de Vendas
          </h2>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Personalize a jornada comercial no padrão Pipedrive: ordene etapas, defina valores de
            referência e configure metas de ganho/perda da marca{' '}
            <strong className="text-slate-800">
              {activeBrand ? activeBrand.nome : 'Consolidada'}
            </strong>
            .
          </p>
        </div>

        <Button
          onClick={() => {
            setNewFunilMarcaId(activeBrand?.id || (marcas[0]?.id ?? ''))
            setIsNewFunilModalOpen(true)
          }}
          size="sm"
          className="text-xs font-bold bg-[#017848] hover:bg-[#01653c] text-white shadow-xs self-start sm:self-auto rounded-xl"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Funil
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-xs text-slate-500 bg-white rounded-2xl border border-[#E3E7EB]">
          <Loader2 className="w-6 h-6 animate-spin text-[#017848] mb-2" />
          Carregando funis da marca...
        </div>
      ) : funis.length === 0 ? (
        <Card className="border-dashed border-slate-300 p-8 text-center bg-white rounded-2xl">
          <Layers className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800">
            Nenhum funil cadastrado para esta marca
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Crie o primeiro funil de vendas para habilitar o Kanban de negócios.
          </p>
          <Button
            onClick={() => {
              setNewFunilMarcaId(activeBrand?.id || (marcas[0]?.id ?? ''))
              setIsNewFunilModalOpen(true)
            }}
            size="sm"
            className="mt-4 text-xs font-bold bg-[#017848] hover:bg-[#01653c] text-white rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Criar Primeiro Funil
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SELETOR LATERAL DE FUNIS (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Funis Disponíveis ({funis.length})
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadFunis}
                className="h-7 text-[11px] text-slate-500 hover:text-slate-900"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Atualizar
              </Button>
            </div>

            <div className="space-y-2">
              {funis.map((f) => {
                const isSelected = f.id === selectedFunilId
                const stagesCount = Array.isArray(f.etapas_ordenadas)
                  ? f.etapas_ordenadas.length
                  : 0

                return (
                  <div
                    key={f.id}
                    onClick={() => selectFunil(f)}
                    className={cn(
                      'p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between',
                      isSelected
                        ? 'border-[#017848] bg-emerald-50/50 shadow-xs ring-1 ring-[#017848]'
                        : 'border-[#E3E7EB] bg-white hover:bg-slate-50',
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-900 truncate">{f.nome_funil}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {stagesCount} etapas configuradas
                      </p>
                    </div>

                    <Badge
                      className={cn(
                        'text-[10px] shrink-0 font-bold',
                        isSelected
                          ? 'bg-[#017848] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      {isSelected ? 'Ativo na Edição' : 'Selecionar'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>

          {/* PAINEL DE CONFIGURAÇÃO DE ETAPAS (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            {editingFunil && (
              <Card className="border-[#E3E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="p-4 sm:p-5 border-b border-[#E3E7EB] bg-slate-50/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 max-w-md">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Nome do Funil
                      </Label>
                      <Input
                        value={nomeFunilInput}
                        onChange={(e) => setNomeFunilInput(e.target.value)}
                        placeholder="ex: Funil NTC Agro – Obras"
                        className="mt-1 h-9 text-xs font-bold bg-white rounded-xl border-[#D5DBDB] focus:border-[#017848]"
                      />
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-auto">
                      <Button
                        type="button"
                        onClick={openNewEtapaModal}
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs font-semibold rounded-xl border-[#D5DBDB] hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Adicionar Etapa
                      </Button>

                      <Button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveFunil(false)}
                        size="sm"
                        className="h-9 text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white shadow-xs"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar Alterações'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                    <div className="flex items-center space-x-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>Arraste os itens pelo ícone para reordenar a sequência no Kanban</span>
                    </div>
                    <span className="font-bold text-slate-700">{etapasList.length} etapas</span>
                  </div>

                  {/* LISTA ORDENADA DE ETAPAS COM DRAG & DROP */}
                  <div className="space-y-2">
                    {etapasList.map((etapa, idx) => {
                      const isFirst = idx === 0
                      const isLast = idx === etapasList.length - 1

                      return (
                        <div
                          key={`${etapa.nome}-${idx}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={(e) => handleDrop(e, idx)}
                          className={cn(
                            'p-3 rounded-xl border bg-white flex items-center justify-between gap-3 transition-all select-none',
                            draggedIndex === idx
                              ? 'opacity-40 border-dashed border-[#017848] bg-emerald-50/30'
                              : 'border-[#E3E7EB] hover:border-slate-300 shadow-2xs',
                          )}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            {/* Drag Handle */}
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing p-1"
                              title="Arraste para reordenar"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>

                            {/* Posição numérico estilo chevron */}
                            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                              {idx + 1}
                            </div>

                            {/* Informações da Etapa */}
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {etapa.nome}
                                </span>

                                {etapa.is_won && (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold rounded-full">
                                    <Trophy className="w-2.5 h-2.5 mr-1" />
                                    Ganho (isWon)
                                  </Badge>
                                )}

                                {etapa.is_lost && (
                                  <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] font-bold rounded-full">
                                    <XCircle className="w-2.5 h-2.5 mr-1" />
                                    Perdido
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="flex items-center">
                                  <DollarSign className="w-3 h-3 text-slate-400 mr-0.5" />
                                  Ref: {formatCurrencyBRL(etapa.valor_referencia || 0)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Ações da Etapa */}
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditEtapaModal(idx)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                              title="Editar etapa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePromptDeleteEtapa(idx)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              title="Excluir etapa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* MODAL NOVO FUNIL */}
      <Dialog open={isNewFunilModalOpen} onOpenChange={setIsNewFunilModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Criar Novo Funil de Vendas
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cada funil organiza a jornada de negociação para uma unidade de negócio ou processo
              específico.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNewFunil} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nome do Funil</Label>
              <Input
                required
                value={newFunilNome}
                onChange={(e) => setNewFunilNome(e.target.value)}
                placeholder="ex: Funil NTC Agro – Obras"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Marca Associada</Label>
              <Select value={newFunilMarcaId} onValueChange={setNewFunilMarcaId}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-white">
                  <SelectValue placeholder="Selecione a marca..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {marcas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewFunilModalOpen(false)}
                className="text-xs rounded-xl border-[#E3E7EB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
              >
                Criar Funil
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR / EDITAR ETAPA */}
      <Dialog open={isEtapaModalOpen} onOpenChange={setIsEtapaModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingEtapaIndex !== null ? 'Editar Etapa' : 'Nova Etapa'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure os parâmetros comerciais no padrão Pipedrive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nome da Etapa</Label>
              <Input
                value={modalEtapaNome}
                onChange={(e) => setModalEtapaNome(e.target.value)}
                placeholder="ex: Qualificação Técnica"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Valor Monetário de Referência (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={modalEtapaValor}
                onChange={(e) => setModalEtapaValor(e.target.value)}
                placeholder="0,00"
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-slate-500">
                Ticket médio de referência para negócios que atingem esta etapa.
              </p>
            </div>

            {/* Configurações de status de fechamento */}
            <div className="p-3 bg-slate-50 border border-[#E3E7EB] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-slate-800">
                    Conta como "Fechado Ganho" (isWonStage)
                  </Label>
                  <p className="text-[10px] text-slate-500">
                    Oportunidades nesta etapa convertem contatos em status definitivo de "Cliente".
                  </p>
                </div>
                <Switch
                  checked={modalEtapaIsWon}
                  onCheckedChange={(checked) => {
                    setModalEtapaIsWon(checked)
                    if (checked) setModalEtapaIsLost(false)
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <div>
                  <Label className="text-xs font-bold text-slate-800">
                    Conta como "Fechado Perdido"
                  </Label>
                  <p className="text-[10px] text-slate-500">
                    Indica negócios descartados ou desqualificados comercialmente.
                  </p>
                </div>
                <Switch
                  checked={modalEtapaIsLost}
                  onCheckedChange={(checked) => {
                    setModalEtapaIsLost(checked)
                    if (checked) setModalEtapaIsWon(false)
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEtapaModalOpen(false)}
              className="text-xs rounded-xl border-[#E3E7EB]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEtapaModal}
              className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REMANEJAMENTO OBRIGATÓRIO AO EXCLUIR ETAPA (ESTILO PIPEDRIVE) */}
      <Dialog
        open={deleteStageIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteStageIndex(null)
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Excluir Etapa do Funil
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Regra de integridade comercial: uma etapa não pode ser removida se houver negócios
              ativos nela sem destino definido.
            </DialogDescription>
          </DialogHeader>

          {deleteStageIndex !== null && (
            <div className="space-y-3 py-2 text-xs">
              <p className="text-slate-700">
                Você está excluindo a etapa: <strong>"{etapasList[deleteStageIndex]?.nome}"</strong>
                .
              </p>

              {stageDealsCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
                  <p className="font-bold">
                    Existem {stageDealsCount} negócio(s) atualmente nesta etapa!
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Como no Pipedrive, você é obrigado a mover estes negócios para outra etapa antes
                    de prosseguir com a exclusão.
                  </p>

                  <div className="pt-2">
                    <Label className="text-[11px] font-bold text-amber-950">
                      Mover negócios existentes para:
                    </Label>
                    <Select value={destinationStageName} onValueChange={setDestinationStageName}>
                      <SelectTrigger className="h-8 text-xs bg-white border-amber-300 rounded-lg mt-1">
                        <SelectValue placeholder="Selecione a etapa de destino..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {etapasList
                          .filter((_, i) => i !== deleteStageIndex)
                          .map((et) => (
                            <SelectItem key={et.nome} value={et.nome}>
                              {et.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">
                  Nenhum negócio ativo está vinculado a esta etapa. A remoção é segura.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteStageIndex(null)}
              className="text-xs rounded-xl border-[#E3E7EB]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isMigratingDeals}
              onClick={handleConfirmDeleteEtapa}
              className="text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {isMigratingDeals ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Remanejando...
                </>
              ) : (
                'Remanejar e Excluir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONCORRÊNCIA DETECTADA */}
      <Dialog open={concurrencyModalOpen} onOpenChange={setConcurrencyModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Aviso de Concorrência
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-slate-600 space-y-2">
            <p>
              Outro usuário ou administrador modificou este funil enquanto você realizava edições.
            </p>
            <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
              Para evitar perda involuntária de dados, você pode optar por recarregar a versão mais
              recente do servidor ou sobrescrever com as suas modificações atuais.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConcurrencyModalOpen(false)
                loadFunis()
              }}
              className="text-xs rounded-xl border-[#E3E7EB]"
            >
              Recarregar do Servidor
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSaveFunil(true)}
              className="text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
            >
              Sobrescrever Mesmo Assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default FunisEtapasConfig
