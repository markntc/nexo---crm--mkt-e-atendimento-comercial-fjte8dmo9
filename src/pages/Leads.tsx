// src/pages/Leads.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type { Lead, Funil, ClienteB2B, ClienteB2C } from '@/types'
import { formatDateBR } from '@/lib/formatters'
import { getEtapaNome } from '@/lib/relationshipStatus'
import { GeoSelector } from '@/components/GeoSelector'
import { extrairCidadeEstado } from '@/lib/geoUtils'
import { prepararInitialValuesDeLead } from '@/lib/leadConversionUtils'
import { AddDealModal } from '@/components/AddDealModal'
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
import { Target, Plus, Search, Briefcase, Trash2, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Leads() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { marcas, activeBrand } = useBrand()

  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [origemFilter, setOrigemFilter] = useState<string>('all')

  // Modal Novo Lead
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false)
  const [newOrigem, setNewOrigem] = useState<Lead['origem']>('Formulário Web')
  const [newDadosContato, setNewDadosContato] = useState('')
  const [newMarcaId, setNewMarcaId] = useState('')
  const [newCidade, setNewCidade] = useState('')
  const [newEstado, setNewEstado] = useState('')
  const [newPais, setNewPais] = useState('Brasil')
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)

  // Modal Converter Lead em Oportunidade via AddDealModal Pipedrive
  const [selectedLeadToConvert, setSelectedLeadToConvert] = useState<Lead | null>(null)
  const [isAddDealOpen, setIsAddDealOpen] = useState(false)
  const [dealInitialValues, setDealInitialValues] = useState<any>(null)

  const fetchLeads = async () => {
    setIsLoading(true)
    try {
      let filter = ''
      if (activeBrand) {
        filter = `marca_id = "${activeBrand.id}"`
      }
      if (statusFilter !== 'all') {
        filter = filter
          ? `${filter} && status_qualificacao = "${statusFilter}"`
          : `status_qualificacao = "${statusFilter}"`
      }
      if (origemFilter !== 'all') {
        filter = filter ? `${filter} && origem = "${origemFilter}"` : `origem = "${origemFilter}"`
      }
      if (searchTerm.trim()) {
        const clean = searchTerm.trim().replace(/['"]/g, '')
        const q = `dados_contato ~ "${clean}"`
        filter = filter ? `${filter} && (${q})` : q
      }

      const res = await pb.collection('leads').getFullList<Lead>({
        filter: filter || undefined,
        expand: 'marca_id,cliente_b2b_id,cliente_b2c_id',
        sort: '-created',
      })
      setLeads(res)
    } catch (err) {
      console.error('Erro ao buscar leads:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [activeBrand, statusFilter, origemFilter, searchTerm])

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    const mId = newMarcaId || activeBrand?.id || (marcas[0]?.id ?? '')
    setIsSubmittingLead(true)
    try {
      await pb.collection('leads').create({
        marca_id: mId,
        origem: newOrigem,
        dados_contato: newDadosContato.trim(),
        cidade: newCidade.trim() || null,
        estado: newEstado.trim() || null,
        pais: newPais.trim() || 'Brasil',
        status_qualificacao: 'Novo',
        criado_por_id: pb.authStore.record?.id,
      })

      toast({
        title: 'Lead registrado',
        description: 'Novo contato inicial pronto para triagem comercial.',
      })
      setIsNewLeadOpen(false)
      setNewDadosContato('')
      setNewCidade('')
      setNewEstado('')
      setNewPais('Brasil')
      fetchLeads()
    } catch (err) {
      console.error('Erro ao criar lead:', err)
    } finally {
      setIsSubmittingLead(false)
    }
  }

  const handleQualifyLead = (lead: Lead) => {
    setSelectedLeadToConvert(lead)
    const brandName = lead.expand?.marca_id?.nome || activeBrand?.nome
    const inits = prepararInitialValuesDeLead(lead, brandName)
    setDealInitialValues(inits)
    setIsAddDealOpen(true)
  }

  const handleDealCreatedSuccess = async (dealId: string) => {
    if (selectedLeadToConvert) {
      try {
        await pb.collection('leads').update(selectedLeadToConvert.id, {
          status_qualificacao: 'Convertido',
          convertido_para_id: dealId,
        })
        toast({
          title: 'Lead convertido com sucesso!',
          description: 'Negócio criado via rota atômica e lead atualizado para "Convertido".',
        })
      } catch (err) {
        console.error('Erro ao atualizar status do lead para Convertido:', err)
      }
    }
    setIsAddDealOpen(false)
    setSelectedLeadToConvert(null)
    setDealInitialValues(null)
    fetchLeads()
    navigate('/negocios')
  }

  const handleDesqualificarLead = async (lead: Lead) => {
    try {
      await pb.collection('leads').update(lead.id, {
        status_qualificacao: 'Desqualificado',
      })
      toast({
        title: 'Lead desqualificado',
        description: 'Status atualizado para desqualificado.',
      })
      fetchLeads()
    } catch (err) {
      console.error('Erro ao desqualificar lead:', err)
    }
  }

  const handleDeleteLead = async (id: string) => {
    try {
      await pb.collection('leads').delete(id)
      toast({
        title: 'Lead excluído',
        description: 'Registro removido da lista.',
      })
      fetchLeads()
    } catch (err) {
      console.error('Erro ao excluir lead:', err)
    }
  }

  const getStatusBadge = (status: Lead['status_qualificacao']) => {
    switch (status) {
      case 'Novo':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Novo</Badge>
      case 'Qualificado':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Qualificado</Badge>
        )
      case 'Desqualificado':
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-600">
            Desqualificado
          </Badge>
        )
      case 'Convertido':
        return <Badge className="bg-slate-800 text-white">Convertido</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
            Captação & Gestão de Leads
          </h1>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Qualificação preliminar de interesse multicanal e conversão orientada para funis
          </p>
        </div>

        <Button
          onClick={() => {
            setNewMarcaId(activeBrand?.id || (marcas[0]?.id ?? ''))
            setIsNewLeadOpen(true)
          }}
          size="sm"
          className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Lead
        </Button>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-36 bg-white border-[#D5DBDB]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="Novo">Novo</SelectItem>
              <SelectItem value="Qualificado">Qualificado</SelectItem>
              <SelectItem value="Desqualificado">Desqualificado</SelectItem>
              <SelectItem value="Convertido">Convertido</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro Origem */}
          <Select value={origemFilter} onValueChange={setOrigemFilter}>
            <SelectTrigger className="h-9 text-xs w-40 bg-white border-[#D5DBDB]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Origens</SelectItem>
              <SelectItem value="Formulário Web">Formulário Web</SelectItem>
              <SelectItem value="Landing Page">Landing Page</SelectItem>
              <SelectItem value="Indicação">Indicação</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              <SelectItem value="Feira">Feira</SelectItem>
              <SelectItem value="Importação">Importação</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Busca */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#5D6D7E]" />
          <Input
            type="text"
            placeholder="Buscar dados de contato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-white border-[#D5DBDB]"
          />
        </div>
      </div>

      {/* TABELA DE LEADS */}
      <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-xs text-[#5D6D7E]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B4F72] mb-2" />
            Carregando lista de leads...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#D5DBDB] text-[10px] uppercase font-bold tracking-wider text-[#5D6D7E]">
                <tr>
                  <th className="px-4 py-3">Contato / Empresa</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5DBDB]/60">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#5D6D7E]">
                      Nenhum lead encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#1C2833] max-w-xs truncate">
                        {l.dados_contato}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] border-[#D5DBDB]">
                          {l.origem}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(l.status_qualificacao)}</td>
                      <td className="px-4 py-3">
                        {l.expand?.marca_id ? (
                          <span
                            className="text-xs font-semibold"
                            style={{ color: l.expand.marca_id.cor_destaque }}
                          >
                            {l.expand.marca_id.nome}
                          </span>
                        ) : (
                          <span className="text-[#5D6D7E]">NTC Geral</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#5D6D7E]">{formatDateBR(l.created)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {l.status_qualificacao !== 'Convertido' && (
                            <Button
                              size="sm"
                              onClick={() => handleQualifyLead(l)}
                              className="text-[11px] h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Briefcase className="w-3 h-3 mr-1" />
                              Converter
                            </Button>
                          )}
                          {l.status_qualificacao === 'Novo' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDesqualificarLead(l)}
                              className="text-[11px] h-7 border-[#D5DBDB]"
                            >
                              Desqualificar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteLead(l.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL NOVO LEAD */}
      <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Cadastrar Novo Lead
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateLead} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Marca de Destino</Label>
              <Select value={newMarcaId} onValueChange={setNewMarcaId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a marca..." />
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

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Canal de Origem</Label>
              <Select value={newOrigem} onValueChange={(v) => setNewOrigem(v as Lead['origem'])}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Formulário Web">Formulário Web</SelectItem>
                  <SelectItem value="Landing Page">Landing Page</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Feira">Feira</SelectItem>
                  <SelectItem value="Importação">Importação</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">
                Dados de Contato e Demanda (Livre)
              </Label>
              <Input
                required
                placeholder="Nome, cargo, e-mail, telefone e interesse..."
                value={newDadosContato}
                onChange={(e) => setNewDadosContato(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <GeoSelector
                label="Localidade do Lead"
                cidade={newCidade}
                estado={newEstado}
                pais={newPais}
                onChange={(geo) => {
                  setNewCidade(geo.cidade)
                  setNewEstado(geo.estado)
                  setNewPais(geo.pais)
                }}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewLeadOpen(false)}
                className="text-xs border-[#D5DBDB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingLead}
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                {isSubmittingLead ? 'Salvando...' : 'Salvar Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR NEGÓCIO PRÉ-PREENCHIDO COM O LEAD (PADRÃO PIPEDRIVE) */}
      <AddDealModal
        open={isAddDealOpen}
        onOpenChange={(isOpen) => {
          setIsAddDealOpen(isOpen)
          if (!isOpen) {
            setSelectedLeadToConvert(null)
            setDealInitialValues(null)
          }
        }}
        initialValues={dealInitialValues}
        onSuccess={handleDealCreatedSuccess}
      />
    </div>
  )
}
