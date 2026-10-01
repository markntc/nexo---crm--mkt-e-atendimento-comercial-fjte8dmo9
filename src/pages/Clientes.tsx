// src/pages/Clientes.tsx
// Seção Unificada de Contatos estilo Pipedrive (Imagem 2 de referência):
// Menu secundário lateral interno: "Pessoas", "Organizações", "Linha do tempo de contatos", "Mesclar duplicatas"
// Botão primário verde "+ Pessoa" ou "+ Organização"
// Contador de contatos ("X pessoas", "Y organizações"), busca e filtro
// Integrado com regras de unicidade e validação de CPF / CNPJ matematicamente
import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type {
  Organizacao,
  Pessoa,
  ClienteB2B,
  ClienteB2C,
  Oportunidade,
  PreferenciaComunicacao,
  Atividade,
} from '@/types'
import { getClientStatusSets, getEtapaNome } from '@/lib/relationshipStatus'
import {
  formatCurrencyBRL,
  formatDateBR,
  isValidCNPJ,
  isValidCPF,
  maskCNPJ,
  maskCPF,
  maskPhone,
} from '@/lib/formatters'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  User,
  Plus,
  Search,
  Users2,
  Link2,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Clock,
  GitMerge,
  Filter,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Target,
  Briefcase,
  Trash2,
  Edit2,
  XCircle,
} from 'lucide-react'
import type { Lead, Funil } from '@/types'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type ContactSubNav = 'pessoas' | 'organizacoes' | 'leads' | 'timeline' | 'duplicatas'

export default function Clientes() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { marcas, activeBrand, isConsolidated } = useBrand()

  // Subnavegação lateral estilo captura 2 do Pipedrive
  const subnavParam = searchParams.get('sub') as ContactSubNav | null
  const [activeSubNav, setActiveSubNav] = useState<ContactSubNav>(
    subnavParam ||
      (searchParams.get('tab') === 'b2c'
        ? 'pessoas'
        : searchParams.get('tab') === 'leads'
          ? 'leads'
          : 'pessoas'),
  )

  useEffect(() => {
    if (subnavParam && subnavParam !== activeSubNav) {
      setActiveSubNav(subnavParam)
    }
  }, [subnavParam])

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [clientesB2B, setClientesB2B] = useState<ClienteB2B[]>([])
  const [clientesB2C, setClientesB2C] = useState<ClienteB2C[]>([])
  const [leadsList, setLeadsList] = useState<import('@/types').Lead[]>([])
  const [timelineAtividades, setTimelineAtividades] = useState<Atividade[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Estados e filtros de Leads
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all')
  const [leadOrigemFilter, setLeadOrigemFilter] = useState<string>('all')
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false)
  const [newLeadOrigem, setNewLeadOrigem] = useState<Lead['origem']>('Formulário Web')
  const [newLeadDados, setNewLeadDados] = useState('')
  const [newLeadMarcaId, setNewLeadMarcaId] = useState('')
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)

  // Edição de Lead
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [editLeadDados, setEditLeadDados] = useState('')
  const [editLeadOrigem, setEditLeadOrigem] = useState<Lead['origem']>('Formulário Web')
  const [editLeadStatus, setEditLeadStatus] = useState<Lead['status_qualificacao']>('Novo')

  // Conversão de Lead em Oportunidade
  const [selectedLeadToConvert, setSelectedLeadToConvert] = useState<Lead | null>(null)
  const [funis, setFunis] = useState<Funil[]>([])
  const [convFunilId, setConvFunilId] = useState('')
  const [convEtapa, setConvEtapa] = useState('')
  const [convTitulo, setConvTitulo] = useState('')
  const [convValor, setConvValor] = useState<number>(0)
  const [convFollowUpData, setConvFollowUpData] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
  )
  const [convFollowUpDesc, setConvFollowUpDesc] = useState('Contato inicial pós-qualificação')
  const [isConverting, setIsConverting] = useState(false)

  // Sets de IDs com negócio ganho (Status: Cliente vs Prospect)
  const [wonOrgIds, setWonOrgIds] = useState<Set<string>>(new Set())
  const [wonPessoaIds, setWonPessoaIds] = useState<Set<string>>(new Set())
  // Filtro de status de relacionamento comercial (Todos, Cliente, Prospect)
  const [statusFilter, setStatusFilter] = useState<'todos' | 'cliente' | 'prospect'>('todos')

  // Detail View State (Drawer)
  const [selectedB2B, setSelectedB2B] = useState<ClienteB2B | null>(null)
  const [selectedB2C, setSelectedB2C] = useState<ClienteB2C | null>(null)
  const [linkedPessoas, setLinkedPessoas] = useState<Pessoa[]>([])
  const [clientOpps, setClientOpps] = useState<Oportunidade[]>([])
  const [clientPrefs, setClientPrefs] = useState<PreferenciaComunicacao[]>([])

  // Modal Novo Contato (+ Pessoa ou + Organização)
  const [isNewContactOpen, setIsNewContactOpen] = useState(false)
  const [newTipo, setNewTipo] = useState<'b2b' | 'b2c'>('b2c')
  const [newCnpj, setNewCnpj] = useState('')
  const [newRazao, setNewRazao] = useState('')
  const [newFantasia, setNewFantasia] = useState('')
  const [newIE, setNewIE] = useState('')
  const [newEndereco, setNewEndereco] = useState('')
  const [newCpf, setNewCpf] = useState('')
  const [newNomeCompleto, setNewNomeCompleto] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newTelefone, setNewTelefone] = useState('')
  const [newMarcaCapturaId, setNewMarcaCapturaId] = useState('')
  const [newOrganizacaoId, setNewOrganizacaoId] = useState<string>('')
  const [newCargo, setNewCargo] = useState('')
  const [newDepartamento, setNewDepartamento] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Vincular Pessoa a esta Organização
  const [isAddContatoOpen, setIsAddContatoOpen] = useState(false)
  const [selectedB2CCandidateId, setSelectedB2CCandidateId] = useState('')
  const [contatoCargo, setContatoCargo] = useState('')
  const [contatoDepto, setContatoDepto] = useState('')

  // Modal Adicionar Preferência LGPD
  const [isAddPrefOpen, setIsAddPrefOpen] = useState(false)
  const [prefMarcaId, setPrefMarcaId] = useState('')
  const [prefCanal, setPrefCanal] = useState<'E-mail' | 'WhatsApp' | 'Telefone' | 'SMS'>('WhatsApp')
  const [prefStatus, setPrefStatus] = useState<'Opt-in' | 'Opt-out'>('Opt-in')

  const fetchContatos = async () => {
    setIsLoading(true)
    try {
      let filterB2B = ''
      let filterB2C = ''
      let filterLeads = ''

      if (activeBrand) {
        filterB2B = `marca_captura_id = "${activeBrand.id}"`
        filterB2C = `marca_captura_id = "${activeBrand.id}"`
        filterLeads = `marca_origem_id = "${activeBrand.id}"`
      }

      if (searchTerm.trim()) {
        const clean = searchTerm.trim().replace(/['"]/g, '')
        const qB2B = `razao_social ~ "${clean}" || cnpj ~ "${clean}" || email_principal ~ "${clean}"`
        const qB2C = `nome_completo ~ "${clean}" || cpf ~ "${clean}" || email_principal ~ "${clean}"`
        const qLead = `dados_contato ~ "${clean}" || origem ~ "${clean}"`
        filterB2B = filterB2B ? `(${filterB2B}) && (${qB2B})` : qB2B
        filterB2C = filterB2C ? `(${filterB2C}) && (${qB2C})` : qB2C
        filterLeads = filterLeads ? `(${filterLeads}) && (${qLead})` : qLead
      }

      const [b2bList, b2cList, leadsRes, ativList, statusSets, funisRes] = await Promise.all([
        pb.collection('organizacoes').getFullList<Organizacao>({
          filter: filterB2B || undefined,
          expand: 'marca_captura_id',
          sort: 'razao_social',
        }),
        pb.collection('pessoas').getFullList<Pessoa>({
          filter: filterB2C || undefined,
          expand: 'marca_captura_id,organizacao_id',
          sort: 'nome_completo',
        }),
        pb.collection('leads').getFullList<Lead>({
          filter: filterLeads || undefined,
          expand: 'marca_origem_id,convertido_para_id',
          sort: '-created',
        }),
        pb
          .collection('atividades')
          .getFullList<Atividade>({
            expand: 'marca_id,oportunidade_id,responsavel_id',
            sort: '-created',
            limit: 50,
          })
          .catch(() => []),
        getClientStatusSets(),
        pb
          .collection('funis')
          .getFullList<Funil>({
            filter: activeBrand ? `marca_id = "${activeBrand.id}" && ativo = true` : 'ativo = true',
          })
          .catch(() => []),
      ])

      setWonOrgIds(statusSets.wonOrgIds)
      setWonPessoaIds(statusSets.wonPessoaIds)
      setClientesB2B(b2bList)
      setClientesB2C(b2cList)
      setLeadsList(leadsRes)
      setTimelineAtividades(ativList)
      setFunis(funisRes)
      if (funisRes.length > 0 && !convFunilId) {
        setConvFunilId(funisRes[0].id)
        if (funisRes[0].etapas?.length > 0) {
          setConvEtapa(funisRes[0].etapas[0].nome)
        }
      }
    } catch (err) {
      console.error('Erro ao buscar contatos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchContatos()
  }, [activeBrand, searchTerm])

  const handleSelectSubNav = (item: ContactSubNav) => {
    if (item === 'duplicatas') {
      navigate('/conciliacao')
      return
    }
    setActiveSubNav(item)
    searchParams.set('sub', item)
    setSearchParams(searchParams)
  }

  // Carrega relacionamentos do contato selecionado no Drawer
  const loadClientDetails = async (b2bId?: string, b2cId?: string) => {
    try {
      if (b2bId) {
        const [pessoasRes, oppsRes, prefsRes] = await Promise.all([
          pb.collection('pessoas').getFullList<Pessoa>({
            filter: `organizacao_id = "${b2bId}"`,
            sort: 'nome_completo',
          }),
          pb.collection('oportunidades').getFullList<Oportunidade>({
            filter: `cliente_b2b_id = "${b2bId}"`,
            sort: '-created',
          }),
          pb.collection('preferencias_comunicacao').getFullList<PreferenciaComunicacao>({
            filter: `cliente_b2b_id = "${b2bId}"`,
            expand: 'marca_id',
          }),
        ])
        setLinkedPessoas(pessoasRes)
        setClientOpps(oppsRes)
        setClientPrefs(prefsRes)
      } else if (b2cId) {
        const [oppsRes, prefsRes] = await Promise.all([
          pb.collection('oportunidades').getFullList<Oportunidade>({
            filter: `cliente_b2c_id = "${b2cId}"`,
            sort: '-created',
          }),
          pb.collection('preferencias_comunicacao').getFullList<PreferenciaComunicacao>({
            filter: `cliente_b2c_id = "${b2cId}"`,
            expand: 'marca_id',
          }),
        ])
        setLinkedPessoas([])
        setClientOpps(oppsRes)
        setClientPrefs(prefsRes)
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes do contato:', err)
    }
  }

  const handleOpenB2B = (c: ClienteB2B) => {
    setSelectedB2B(c)
    setSelectedB2C(null)
    loadClientDetails(c.id, undefined)
  }

  const handleOpenB2C = (c: ClienteB2C) => {
    setSelectedB2C(c)
    setSelectedB2B(null)
    loadClientDetails(undefined, c.id)
  }

  // Criação de Contato com validação matemática de dígitos verificadores
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const marcaId = newMarcaCapturaId || activeBrand?.id || (marcas[0]?.id ?? '')
    if (!marcaId) {
      setValidationError('Selecione uma marca de captura.')
      return
    }

    if (newTipo === 'b2b') {
      if (!isValidCNPJ(newCnpj)) {
        setValidationError('O CNPJ informado possui dígitos verificadores inválidos.')
        return
      }
      if (!newRazao.trim()) {
        setValidationError('A Razão Social é obrigatória.')
        return
      }

      setIsSubmitting(true)
      try {
        await pb.collection('organizacoes').create({
          cnpj: maskCNPJ(newCnpj),
          razao_social: newRazao.trim(),
          nome_fantasia: newFantasia.trim(),
          inscricao_estadual: newIE.trim(),
          endereco_corporativo: newEndereco.trim(),
          email_principal: newEmail.trim(),
          telefone: newTelefone ? maskPhone(newTelefone) : '',
          marca_captura_id: marcaId,
          origem_sistema: 'Cadastro Manual Pipedrive NTC',
          data_criacao: new Date().toISOString(),
          criado_por_id: pb.authStore.record?.id,
        })

        toast({
          title: 'Organização cadastrada',
          description: 'Registro de organização incluído na base mestre unificada.',
        })
        setIsNewContactOpen(false)
        resetForm()
        fetchContatos()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar organização'
        setValidationError(msg)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // B2C / Pessoa
      if (!isValidCPF(newCpf)) {
        setValidationError('O CPF informado possui dígitos verificadores inválidos.')
        return
      }
      if (!newNomeCompleto.trim()) {
        setValidationError('O Nome Completo é obrigatório.')
        return
      }

      setIsSubmitting(true)
      try {
        await pb.collection('pessoas').create({
          cpf: maskCPF(newCpf),
          nome_completo: newNomeCompleto.trim(),
          email_principal: newEmail.trim(),
          telefone: newTelefone ? maskPhone(newTelefone) : '',
          marca_captura_id: marcaId,
          origem_sistema: 'Cadastro Manual Pipedrive NTC',
          data_criacao: new Date().toISOString(),
          criado_por_id: pb.authStore.record?.id,
          organizacao_id: newOrganizacaoId || null,
          cargo: newCargo.trim() || null,
          departamento: newDepartamento.trim() || null,
        })

        toast({
          title: 'Pessoa cadastrada',
          description: 'Registro de pessoa física incluído na base mestre de contatos.',
        })
        setIsNewContactOpen(false)
        resetForm()
        fetchContatos()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar pessoa'
        setValidationError(msg)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const resetForm = () => {
    setNewCnpj('')
    setNewRazao('')
    setNewFantasia('')
    setNewIE('')
    setNewEndereco('')
    setNewCpf('')
    setNewNomeCompleto('')
    setNewEmail('')
    setNewTelefone('')
    setNewOrganizacaoId('')
    setNewCargo('')
    setNewDepartamento('')
    setValidationError(null)
  }

  const openNewContactModal = (tipo: 'b2b' | 'b2c') => {
    resetForm()
    setNewTipo(tipo)
    setNewMarcaCapturaId(activeBrand?.id || (marcas[0]?.id ?? ''))
    setIsNewContactOpen(true)
  }

  // Vínculo Pessoa -> Organização (atualiza diretamente o registro da Pessoa com organizacao_id + cargo)
  const handleAddContato = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedB2B || !selectedB2CCandidateId) return

    try {
      await pb.collection('pessoas').update(selectedB2CCandidateId, {
        organizacao_id: selectedB2B.id,
        cargo: contatoCargo.trim() || null,
        departamento: contatoDepto.trim() || null,
      })

      toast({
        title: 'Pessoa vinculada à organização',
        description: 'Vínculo e cargo estabelecidos com sucesso na base mestre.',
      })
      setIsAddContatoOpen(false)
      setSelectedB2CCandidateId('')
      setContatoCargo('')
      setContatoDepto('')
      loadClientDetails(selectedB2B.id, undefined)
      fetchContatos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao vincular contato'
      toast({
        variant: 'destructive',
        title: 'Erro de vínculo',
        description: msg,
      })
    }
  }

  // Desvincular Pessoa da Organização
  const handleUnlinkPessoa = async (pessoaId: string) => {
    try {
      await pb.collection('pessoas').update(pessoaId, {
        organizacao_id: null,
        cargo: null,
        departamento: null,
      })
      toast({
        title: 'Pessoa desvinculada',
        description: 'O vínculo com a organização foi removido.',
      })
      if (selectedB2B) {
        loadClientDetails(selectedB2B.id, undefined)
      }
      fetchContatos()
    } catch (err) {
      console.error('Erro ao desvincular pessoa:', err)
    }
  }

  // Adicionar Preferência LGPD para este contato
  const handleAddPreference = async (e: React.FormEvent) => {
    e.preventDefault()
    const clienteB2bId = selectedB2B ? selectedB2B.id : null
    const clienteB2cId = selectedB2C ? selectedB2C.id : null
    const mId = prefMarcaId || activeBrand?.id || (marcas[0]?.id ?? '')

    try {
      await pb.collection('preferencias_comunicacao').create({
        cliente_b2b_id: clienteB2bId,
        cliente_b2c_id: clienteB2cId,
        marca_id: mId,
        canal: prefCanal,
        status_consentimento: prefStatus,
        data_atualizacao: new Date().toISOString(),
      })

      toast({
        title: 'Consentimento registrado',
        description: `Consentimento ${prefStatus} gravado para o canal ${prefCanal}.`,
      })
      setIsAddPrefOpen(false)
      loadClientDetails(selectedB2B?.id, selectedB2C?.id)
    } catch (err) {
      console.error('Erro ao adicionar preferência:', err)
    }
  }

  // Ações de Leads: Criar, Editar, Qualificar, Descartar, Converter
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLeadDados.trim()) return

    const marcaId = newLeadMarcaId || activeBrand?.id || marcas[0]?.id
    if (!marcaId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione uma marca para o lead.',
      })
      return
    }

    setIsSubmittingLead(true)
    try {
      await pb.collection('leads').create({
        origem: newLeadOrigem,
        dados_contato: newLeadDados.trim(),
        marca_origem_id: marcaId,
        status_qualificacao: 'Novo',
      })
      toast({
        title: 'Lead criado',
        description: 'Lead registrado com sucesso na esteira de pré-qualificação.',
      })
      setIsNewLeadOpen(false)
      setNewLeadDados('')
      fetchContatos()
    } catch (err) {
      console.error('Erro ao criar lead:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar o lead.',
      })
    } finally {
      setIsSubmittingLead(false)
    }
  }

  const handleUpdateLeadStatus = async (
    leadId: string,
    novoStatus: Lead['status_qualificacao'],
  ) => {
    try {
      await pb.collection('leads').update(leadId, {
        status_qualificacao: novoStatus,
      })
      toast({
        title: 'Status atualizado',
        description: `Lead alterado para "${novoStatus}".`,
      })
      fetchContatos()
    } catch (err) {
      console.error('Erro ao atualizar status do lead:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao atualizar status.',
      })
    }
  }

  const handleOpenEditLead = (lead: Lead) => {
    setEditingLead(lead)
    setEditLeadDados(lead.dados_contato)
    setEditLeadOrigem(lead.origem)
    setEditLeadStatus(lead.status_qualificacao)
  }

  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLead) return

    try {
      await pb.collection('leads').update(editingLead.id, {
        dados_contato: editLeadDados.trim(),
        origem: editLeadOrigem,
        status_qualificacao: editLeadStatus,
      })
      toast({
        title: 'Lead atualizado',
        description: 'As alterações foram salvas.',
      })
      setEditingLead(null)
      fetchContatos()
    } catch (err) {
      console.error('Erro ao salvar lead:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao salvar alterações do lead.',
      })
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este lead?')) return
    try {
      await pb.collection('leads').delete(leadId)
      toast({
        title: 'Lead removido',
        description: 'Registro excluído com sucesso.',
      })
      fetchContatos()
    } catch (err) {
      console.error('Erro ao excluir lead:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao excluir lead.',
      })
    }
  }

  const handleOpenConvert = (lead: Lead) => {
    setSelectedLeadToConvert(lead)
    setConvTitulo(`Negócio - ${lead.dados_contato.slice(0, 30)}`)
    setConvValor(0)
    if (funis.length > 0) {
      setConvFunilId(funis[0].id)
      if (funis[0].etapas_ordenadas && funis[0].etapas_ordenadas.length > 0) {
        setConvEtapa(getEtapaNome(funis[0].etapas_ordenadas[0]))
      }
    }
  }

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeadToConvert) return

    if (!convFollowUpData) {
      toast({
        variant: 'destructive',
        title: 'Follow-up obrigatório',
        description: 'Defina a data do próximo follow-up para avançar.',
      })
      return
    }

    setIsConverting(true)
    try {
      const currentUserId = pb.authStore.record?.id
      const marcaId =
        selectedLeadToConvert.marca_origem_id ||
        selectedLeadToConvert.marca_id ||
        activeBrand?.id ||
        marcas[0]?.id

      // 1. Criar Pessoa física na base de contatos
      const novaPessoa = await pb.collection('pessoas').create({
        nome_completo: selectedLeadToConvert.dados_contato,
        cpf: '00000000000', // CPF provisório para pré-cadastro
        marca_captura_id: marcaId,
        origem_sistema: `Lead (${selectedLeadToConvert.origem})`,
        data_criacao: new Date().toISOString(),
        criado_por_id: currentUserId,
      })

      // 2. Criar Negócio/Oportunidade com rastreamento lead_origem_id
      const novaOportunidade = await pb.collection('oportunidades').create({
        titulo: convTitulo.trim() || `Negócio - ${selectedLeadToConvert.dados_contato}`,
        valor_estimado: convValor,
        funil_id: convFunilId,
        etapa_atual: convEtapa,
        probabilidade: 20,
        marca_id: marcaId,
        cliente_b2c_id: novaPessoa.id,
        lead_origem_id: selectedLeadToConvert.id,
        tipo_documento_faturamento: 'CPF',
        responsavel_id: currentUserId,
        status: 'aberto',
      })

      // 3. Trava de follow-up: criar tarefa obrigatória
      await pb.collection('atividades').create({
        oportunidade_id: novaOportunidade.id,
        marca_id: marcaId,
        responsavel_id: currentUserId,
        tipo: 'Follow-up',
        descricao: convFollowUpDesc.trim() || 'Primeiro contato com cliente qualificado',
        data_vencimento: new Date(convFollowUpData).toISOString(),
        concluida: false,
      })

      // 4. Marcar o lead como Convertido e vincular à oportunidade
      await pb.collection('leads').update(selectedLeadToConvert.id, {
        status_qualificacao: 'Convertido',
        convertido_para_id: novaOportunidade.id,
      })

      toast({
        title: 'Lead convertido com sucesso!',
        description: 'Pessoa, oportunidade e follow-up foram criados com rastreamento completo.',
      })
      setSelectedLeadToConvert(null)
      fetchContatos()
    } catch (err: unknown) {
      console.error('Erro na conversão do lead:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao converter lead'
      toast({
        variant: 'destructive',
        title: 'Erro na conversão',
        description: msg,
      })
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-6.5rem)]">
      {/*
        SUB-MENU LATERAL ESTILO PIPEDRIVE (Captura 2):
        Pessoas / Organizações / Linha do tempo de contatos / Mesclar duplicatas
      */}
      <aside className="w-full lg:w-64 bg-white border border-[#E3E7EB] rounded-2xl p-3 shrink-0 shadow-xs h-fit space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Contatos
        </div>

        <button
          type="button"
          onClick={() => handleSelectSubNav('pessoas')}
          className={cn(
            'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
            activeSubNav === 'pessoas'
              ? 'bg-[#E8F5FA] text-[#0284C7] shadow-xs'
              : 'text-slate-700 hover:bg-slate-50',
          )}
        >
          <div className="flex items-center space-x-2.5">
            <User
              className={cn(
                'w-4 h-4',
                activeSubNav === 'pessoas' ? 'text-[#0284C7]' : 'text-slate-500',
              )}
            />
            <span>Pessoas</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1C2833] text-white">
            {clientesB2C.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubNav('organizacoes')}
          className={cn(
            'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
            activeSubNav === 'organizacoes'
              ? 'bg-[#E8F5FA] text-[#0284C7] shadow-xs'
              : 'text-slate-700 hover:bg-slate-50',
          )}
        >
          <div className="flex items-center space-x-2.5">
            <Building2
              className={cn(
                'w-4 h-4',
                activeSubNav === 'organizacoes' ? 'text-[#0284C7]' : 'text-slate-500',
              )}
            />
            <span>Organizações</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1C2833] text-white">
            {clientesB2B.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubNav('leads')}
          className={cn(
            'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
            activeSubNav === 'leads'
              ? 'bg-[#E8F5FA] text-[#0284C7] shadow-xs'
              : 'text-slate-700 hover:bg-slate-50',
          )}
        >
          <div className="flex items-center space-x-2.5">
            <Target
              className={cn(
                'w-4 h-4',
                activeSubNav === 'leads' ? 'text-[#0284C7]' : 'text-slate-500',
              )}
            />
            <span>Leads</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#017848] text-white">
            {leadsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubNav('timeline')}
          className={cn(
            'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
            activeSubNav === 'timeline'
              ? 'bg-[#E8F5FA] text-[#0284C7] shadow-xs'
              : 'text-slate-700 hover:bg-slate-50',
          )}
        >
          <div className="flex items-center space-x-2.5">
            <Clock
              className={cn(
                'w-4 h-4',
                activeSubNav === 'timeline' ? 'text-[#0284C7]' : 'text-slate-500',
              )}
            />
            <span>Linha do tempo de contatos</span>
          </div>
        </button>

        <div className="pt-2 border-t border-[#E3E7EB]/80 my-1" />

        <button
          type="button"
          onClick={() => handleSelectSubNav('duplicatas')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all text-left group"
        >
          <div className="flex items-center space-x-2.5">
            <GitMerge className="w-4 h-4 text-slate-500 group-hover:text-emerald-700" />
            <span>Mesclar duplicatas</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
        </button>
      </aside>

      {/* ÁREA PRINCIPAL DA LISTAGEM DE CONTATOS */}
      <div className="flex-1 flex flex-col space-y-3.5 min-w-0">
        {/* BARRA SUPERIOR ESTILO PIPEDRIVE (Captura 2):
            - Botão Verde primário "+ Pessoa" ou "+ Organização"
            - Contador: "X pessoas" / "Y organizações"
            - Filtro
            - Busca
        */}
        <div className="bg-white border border-[#E3E7EB] rounded-2xl p-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {/* Botão Verde Primário estilo Pipedrive */}
            {activeSubNav === 'pessoas' ? (
              <Button
                size="sm"
                onClick={() => openNewContactModal('b2c')}
                className="h-9 px-3.5 rounded-xl font-bold text-xs bg-[#017848] hover:bg-[#01653c] text-white shadow-sm flex items-center space-x-1"
              >
                <Plus className="w-4 h-4 mr-0.5" />
                <span>Pessoa</span>
              </Button>
            ) : activeSubNav === 'organizacoes' ? (
              <Button
                size="sm"
                onClick={() => openNewContactModal('b2b')}
                className="h-9 px-3.5 rounded-xl font-bold text-xs bg-[#017848] hover:bg-[#01653c] text-white shadow-sm flex items-center space-x-1"
              >
                <Plus className="w-4 h-4 mr-0.5" />
                <span>Organização</span>
              </Button>
            ) : activeSubNav === 'leads' ? (
              <Button
                size="sm"
                onClick={() => {
                  setNewLeadMarcaId(activeBrand?.id || marcas[0]?.id || '')
                  setNewLeadDados('')
                  setIsNewLeadOpen(true)
                }}
                className="h-9 px-3.5 rounded-xl font-bold text-xs bg-[#017848] hover:bg-[#01653c] text-white shadow-sm flex items-center space-x-1"
              >
                <Plus className="w-4 h-4 mr-0.5" />
                <span>Lead</span>
              </Button>
            ) : null}

            {/* Contador de Registros estilo Pipedrive ("0 pessoas" ou "12 pessoas") */}
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 px-2 py-1 rounded-lg bg-slate-50 border border-[#E3E7EB]">
              <span>
                {activeSubNav === 'pessoas' && `${clientesB2C.length} pessoas`}
                {activeSubNav === 'organizacoes' && `${clientesB2B.length} organizações`}
                {activeSubNav === 'leads' && `${leadsList.length} leads`}
                {activeSubNav === 'timeline' && `${timelineAtividades.length} atividades recentes`}
              </span>
            </div>
          </div>

          {/* Busca e Filtro */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Filtro por Status Comercial (Cliente / Prospect / Todos) */}
            {(activeSubNav === 'pessoas' || activeSubNav === 'organizacoes') && (
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('todos')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-semibold transition-all',
                    statusFilter === 'todos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('cliente')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center space-x-1',
                    statusFilter === 'cliente'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 hover:bg-emerald-50',
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  <span>Clientes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('prospect')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center space-x-1',
                    statusFilter === 'prospect'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-blue-700 hover:bg-blue-50',
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                  <span>Prospects</span>
                </button>
              </div>
            )}

            {/* Filtros rápidos da aba de Leads */}
            {activeSubNav === 'leads' && (
              <div className="flex items-center space-x-2">
                <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E3E7EB] bg-white min-w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Qualificado">Qualificado</SelectItem>
                    <SelectItem value="Descartado">Descartado</SelectItem>
                    <SelectItem value="Convertido">Convertido</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={leadOrigemFilter} onValueChange={setLeadOrigemFilter}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E3E7EB] bg-white min-w-[140px]">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Origens</SelectItem>
                    <SelectItem value="Formulário Web">Formulário Web</SelectItem>
                    <SelectItem value="Chat / WhatsApp">Chat / WhatsApp</SelectItem>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                    <SelectItem value="Evento / Feira">Evento / Feira</SelectItem>
                    <SelectItem value="Campanha Paga">Campanha Paga</SelectItem>
                    <SelectItem value="Prospecção Ativa">Prospecção Ativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <Input
                type="text"
                placeholder={
                  activeSubNav === 'pessoas'
                    ? 'Buscar pessoa por nome, CPF ou e-mail...'
                    : activeSubNav === 'organizacoes'
                      ? 'Buscar organização por razão, CNPJ...'
                      : 'Buscar lead por dados de contato ou origem...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 pr-3 text-xs rounded-xl bg-white border-[#E3E7EB]"
              />
            </div>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL (PESSOAS, ORGANIZAÇÕES OU TIMELINE) */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-xs text-slate-500 bg-white rounded-2xl border border-[#E3E7EB]">
            <Loader2 className="w-6 h-6 animate-spin text-[#017848] mb-2" />
            Carregando contatos corporativos...
          </div>
        ) : activeSubNav === 'pessoas' ? (
          /* TABELA DE PESSOAS */
          <Card className="border-[#E3E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E3E7EB] text-[10px] uppercase font-bold tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Nome da Pessoa</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Organização Vinculada</th>
                    <th className="px-4 py-3">CPF</th>
                    <th className="px-4 py-3">E-mail Principal</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Marca de Captura</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EB]/60">
                  {(() => {
                    const filteredPessoas = clientesB2C.filter((c) => {
                      const isCliente = wonPessoaIds.has(c.id)
                      if (statusFilter === 'cliente') return isCliente
                      if (statusFilter === 'prospect') return !isCliente
                      return true
                    })

                    if (filteredPessoas.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Users2 className="w-8 h-8 text-slate-300" />
                              <p className="font-semibold text-slate-700">
                                {statusFilter !== 'todos'
                                  ? `Nenhuma pessoa com status "${statusFilter === 'cliente' ? 'Cliente' : 'Prospect'}" encontrada.`
                                  : 'Nenhuma pessoa adicionada ainda'}
                              </p>
                              {statusFilter === 'todos' && (
                                <Button
                                  size="sm"
                                  onClick={() => openNewContactModal('b2c')}
                                  className="bg-[#017848] hover:bg-[#01653c] text-white text-xs font-bold rounded-xl mt-2"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />+ Pessoa
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return filteredPessoas.map((c) => {
                      const isCliente = wonPessoaIds.has(c.id)
                      const orgVinculada = c.expand?.organizacao_id
                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleOpenB2C(c)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-bold text-slate-900 flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {c.nome_completo.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="truncate">{c.nome_completo}</span>
                          </td>
                          <td className="px-4 py-3">
                            {isCliente ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                Cliente
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                                Prospect
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {orgVinculada ? (
                              <div className="flex items-center space-x-1.5 text-slate-800 font-medium truncate max-w-[200px]">
                                <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span className="truncate">{orgVinculada.razao_social}</span>
                                {c.cargo && (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    ({c.cargo})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">{c.cpf}</td>
                          <td className="px-4 py-3 text-slate-600">{c.email_principal || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{c.telefone || '—'}</td>
                          <td className="px-4 py-3">
                            {c.expand?.marca_captura_id ? (
                              <Badge
                                className="text-[10px] text-white rounded-full font-semibold"
                                style={{ backgroundColor: c.expand.marca_captura_id.cor_destaque }}
                              >
                                {c.expand.marca_captura_id.nome}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">NTC Geral</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-[#017848] hover:bg-emerald-50 h-7 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenB2C(c)
                              }}
                            >
                              Ver Ficha
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        ) : activeSubNav === 'leads' ? (
          /* TABELA DE LEADS (ENTRADA E PRÉ-QUALIFICAÇÃO) */
          <Card className="border-[#E3E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E3E7EB] text-[10px] uppercase font-bold tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Dados de Contato / Prospect</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Status de Qualificação</th>
                    <th className="px-4 py-3">Marca de Origem</th>
                    <th className="px-4 py-3">Data de Entrada</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EB]/60">
                  {(() => {
                    const filteredLeads = leadsList.filter((ld) => {
                      if (
                        leadStatusFilter !== 'all' &&
                        ld.status_qualificacao !== leadStatusFilter
                      ) {
                        return false
                      }
                      if (leadOrigemFilter !== 'all' && ld.origem !== leadOrigemFilter) {
                        return false
                      }
                      return true
                    })

                    if (filteredLeads.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Target className="w-8 h-8 text-slate-300" />
                              <p className="font-semibold text-slate-700">
                                Nenhum lead encontrado com os filtros selecionados
                              </p>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setNewLeadMarcaId(activeBrand?.id || marcas[0]?.id || '')
                                  setNewLeadDados('')
                                  setIsNewLeadOpen(true)
                                }}
                                className="bg-[#017848] hover:bg-[#01653c] text-white text-xs font-bold rounded-xl mt-2"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />+ Adicionar Lead
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return filteredLeads.map((ld) => {
                      const getStatusBadge = (status: Lead['status_qualificacao']) => {
                        switch (status) {
                          case 'Novo':
                            return (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                                Novo
                              </Badge>
                            )
                          case 'Qualificado':
                            return (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                Qualificado
                              </Badge>
                            )
                          case 'Descartado':
                          case 'Desqualificado':
                            return (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold">
                                Descartado
                              </Badge>
                            )
                          case 'Convertido':
                            return (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                                Convertido
                              </Badge>
                            )
                        }
                      }

                      return (
                        <tr key={ld.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <div className="flex items-center space-x-2">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#017848] flex items-center justify-center text-xs font-bold shrink-0">
                                <Target className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate max-w-xs">{ld.dados_contato}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <Badge variant="outline" className="text-[10px] rounded-md font-medium">
                              {ld.origem}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(ld.status_qualificacao)}
                              {ld.status_qualificacao === 'Novo' && (
                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLeadStatus(ld.id, 'Qualificado')}
                                    className="text-[10px] text-emerald-700 hover:underline font-semibold"
                                  >
                                    Qualificar
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLeadStatus(ld.id, 'Descartado')}
                                    className="text-[10px] text-slate-500 hover:text-slate-800"
                                  >
                                    Descartar
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {ld.expand?.marca_origem_id || ld.expand?.marca_id ? (
                              <Badge
                                className="text-[10px] text-white rounded-full font-semibold"
                                style={{
                                  backgroundColor:
                                    ld.expand?.marca_origem_id?.cor_destaque ||
                                    ld.expand?.marca_id?.cor_destaque ||
                                    '#017848',
                                }}
                              >
                                {ld.expand?.marca_origem_id?.nome || ld.expand?.marca_id?.nome}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">NTC Geral</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-[11px] font-mono">
                            {formatDateBR(ld.created)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {ld.status_qualificacao !== 'Convertido' ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenConvert(ld)}
                                  className="h-7 px-2.5 rounded-lg text-xs font-bold bg-[#017848] hover:bg-[#01653c] text-white shadow-xs"
                                >
                                  <Briefcase className="w-3.5 h-3.5 mr-1" />
                                  Converter
                                </Button>
                              ) : (
                                <span className="text-[11px] text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded-lg">
                                  Negócio Criado
                                </span>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditLead(ld)}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 rounded-lg"
                                title="Editar Lead"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteLead(ld.id)}
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                title="Excluir Lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        ) : activeSubNav === 'organizacoes' ? (
          /* TABELA DE ORGANIZAÇÕES */
          <Card className="border-[#E3E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E3E7EB] text-[10px] uppercase font-bold tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Razão Social / Nome Fantasia</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">CNPJ</th>
                    <th className="px-4 py-3">E-mail Corporativo</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Marca de Captura</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EB]/60">
                  {(() => {
                    const filteredOrgs = clientesB2B.filter((c) => {
                      const isCliente = wonOrgIds.has(c.id)
                      if (statusFilter === 'cliente') return isCliente
                      if (statusFilter === 'prospect') return !isCliente
                      return true
                    })

                    if (filteredOrgs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Building2 className="w-8 h-8 text-slate-300" />
                              <p className="font-semibold text-slate-700">
                                {statusFilter !== 'todos'
                                  ? `Nenhuma organização com status "${statusFilter === 'cliente' ? 'Cliente' : 'Prospect'}" encontrada.`
                                  : 'Nenhuma organização adicionada ainda'}
                              </p>
                              {statusFilter === 'todos' && (
                                <Button
                                  size="sm"
                                  onClick={() => openNewContactModal('b2b')}
                                  className="bg-[#017848] hover:bg-[#01653c] text-white text-xs font-bold rounded-xl mt-2"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />+ Organização
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return filteredOrgs.map((c) => {
                      const isCliente = wonOrgIds.has(c.id)
                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleOpenB2B(c)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">
                                  {c.razao_social}
                                </p>
                                {c.nome_fantasia && (
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {c.nome_fantasia}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isCliente ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                Cliente
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                                Prospect
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">{c.cnpj}</td>
                          <td className="px-4 py-3 text-slate-600">{c.email_principal || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{c.telefone || '—'}</td>
                          <td className="px-4 py-3">
                            {c.expand?.marca_captura_id ? (
                              <Badge
                                className="text-[10px] text-white rounded-full font-semibold"
                                style={{ backgroundColor: c.expand.marca_captura_id.cor_destaque }}
                              >
                                {c.expand.marca_captura_id.nome}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">NTC Geral</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-[#017848] hover:bg-emerald-50 h-7 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenB2B(c)
                              }}
                            >
                              Ver Ficha
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* LINHA DO TEMPO DE CONTATOS */
          <Card className="border-[#E3E7EB] bg-white rounded-2xl shadow-xs p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#017848]" />
              <span>Linha do Tempo Recente de Interações</span>
            </h3>

            {timelineAtividades.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Nenhuma interação recente registrada.
              </div>
            ) : (
              <div className="space-y-3">
                {timelineAtividades.map((at) => (
                  <div
                    key={at.id}
                    className="p-3.5 rounded-xl border border-[#E3E7EB] bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-xl bg-white border border-[#E3E7EB] text-[#017848] shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-[10px] rounded-full">
                            {at.tipo}
                          </Badge>
                          <span className="font-bold text-slate-900">{at.descricao}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Negócio:{' '}
                          <span className="font-semibold text-slate-700">
                            {at.expand?.oportunidade_id?.titulo || 'Negociação Geral'}
                          </span>{' '}
                          • Responsável: {at.expand?.responsavel_id?.name || 'Administrador'}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-500 font-medium shrink-0">
                      {formatDateBR(at.data_vencimento || at.created)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* DRAWER DE DETALHES DE CONTATO (B2B ou B2C) */}
      <Sheet
        open={!!selectedB2B || !!selectedB2C}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedB2B(null)
            setSelectedB2C(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-white border-l border-[#E3E7EB] shadow-2xl z-50 rounded-l-3xl"
        >
          {selectedB2B ? (
            /* DETALHES ORGANIZAÇÃO B2B */
            <>
              <SheetHeader className="p-5 border-b border-[#E3E7EB] bg-slate-50/70 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-5 h-5 text-sky-600" />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold border-slate-300 rounded-full"
                    >
                      Organização (B2B)
                    </Badge>
                  </div>
                  {wonOrgIds.has(selectedB2B.id) ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">
                      Cliente
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
                      Prospect
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-lg font-bold text-slate-900 mt-2">
                  {selectedB2B.razao_social}
                </SheetTitle>
                <p className="text-xs text-slate-500 font-mono">CNPJ: {selectedB2B.cnpj}</p>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* DADOS CADASTRAIS */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dados Cadastrais Oficiais
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs p-3.5 bg-slate-50 rounded-xl border border-[#E3E7EB]">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Nome Fantasia
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedB2B.nome_fantasia || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Inscrição Estadual
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedB2B.inscricao_estadual || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Endereço</p>
                      <p className="font-semibold text-slate-900">
                        {selectedB2B.endereco_corporativo || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">E-mail</p>
                      <p className="font-semibold text-slate-900">
                        {selectedB2B.email_principal || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Telefone</p>
                      <p className="font-semibold text-slate-900">{selectedB2B.telefone || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* PESSOAS VINCULADAS (PESSOAS FÍSICAS NA ORGANIZAÇÃO via pessoas.organizacao_id) */}
                <div className="space-y-3 pt-3 border-t border-[#E3E7EB]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Pessoas Vinculadas ({linkedPessoas.length})
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Compradores técnicos e contatos-chave desta organização
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsAddContatoOpen(true)}
                      className="text-xs h-8 bg-[#017848] hover:bg-[#01653c] text-white rounded-xl font-bold"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      Vincular Pessoa
                    </Button>
                  </div>

                  {linkedPessoas.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-[#E3E7EB] rounded-xl">
                      Nenhuma pessoa física vinculada a esta organização ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linkedPessoas.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl border border-[#E3E7EB] bg-white flex items-center justify-between text-xs shadow-xs"
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center space-x-2">
                              <p className="font-bold text-slate-900 truncate">{p.nome_completo}</p>
                              {wonPessoaIds.has(p.id) ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold">
                                  Cliente
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold">
                                  Prospect
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Cargo:{' '}
                              <strong className="text-slate-700">
                                {p.cargo || 'Não especificado'}
                              </strong>
                              {p.departamento && ` • Depto: ${p.departamento}`}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                              CPF: {p.cpf} • {p.email_principal || 'Sem e-mail'} •{' '}
                              {p.telefone || 'Sem tel'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkPessoa(p.id)}
                            className="text-[11px] text-red-600 hover:bg-red-50 h-7 rounded-lg shrink-0"
                          >
                            Desvincular
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* HISTÓRICO DE NEGÓCIOS / OPORTUNIDADES */}
                <div className="space-y-3 pt-3 border-t border-[#E3E7EB]">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Histórico de Negócios ({clientOpps.length})
                  </span>
                  {clientOpps.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-[#E3E7EB] rounded-xl">
                      Nenhum negócio registrado para este contato.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientOpps.map((op) => (
                        <div
                          key={op.id}
                          className="p-3 rounded-xl border border-[#E3E7EB] bg-white flex items-center justify-between text-xs shadow-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{op.titulo}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Etapa:{' '}
                              <Badge variant="outline" className="text-[10px] rounded-full">
                                {op.etapa_atual}
                              </Badge>
                            </p>
                          </div>
                          <span className="font-black text-slate-900">
                            {formatCurrencyBRL(op.valor_estimado)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PAINEL LGPD */}
                <div className="space-y-3 pt-3 border-t border-[#E3E7EB]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Consentimento LGPD por Marca
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddPrefOpen(true)}
                      className="text-xs h-7 rounded-lg border-[#E3E7EB]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Preferência
                    </Button>
                  </div>
                  {clientPrefs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-[#E3E7EB] rounded-xl">
                      Nenhuma preferência cadastrada.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientPrefs.map((pref) => (
                        <div
                          key={pref.id}
                          className="p-2.5 rounded-xl border border-[#E3E7EB] bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{pref.canal}</span>
                            <span className="text-slate-500 text-[11px] ml-2">
                              ({pref.expand?.marca_id?.nome})
                            </span>
                          </div>
                          <Badge
                            className={cn(
                              'text-[10px] rounded-full',
                              pref.status_consentimento === 'Opt-in'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200',
                            )}
                          >
                            {pref.status_consentimento}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : selectedB2C ? (
            /* DETALHES PESSOA B2C */
            <>
              <SheetHeader className="p-5 border-b border-[#E3E7EB] bg-slate-50/70 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-emerald-600" />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold border-slate-300 rounded-full"
                    >
                      Pessoa (B2C)
                    </Badge>
                  </div>
                  {wonPessoaIds.has(selectedB2C.id) ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">
                      Cliente
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
                      Prospect
                    </Badge>
                  )}
                </div>
                <SheetTitle className="text-lg font-bold text-slate-900 mt-2">
                  {selectedB2C.nome_completo}
                </SheetTitle>
                <p className="text-xs text-slate-500 font-mono">CPF: {selectedB2C.cpf}</p>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* DADOS CADASTRAIS */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dados Pessoais
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs p-3.5 bg-slate-50 rounded-xl border border-[#E3E7EB]">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">E-mail</p>
                      <p className="font-semibold text-slate-900">
                        {selectedB2C.email_principal || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Telefone</p>
                      <p className="font-semibold text-slate-900">{selectedB2C.telefone || '—'}</p>
                    </div>
                    {/* Organização Vinculada & Cargo */}
                    <div className="col-span-2 pt-2 border-t border-slate-200">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Organização Vinculada & Cargo
                      </p>
                      {selectedB2C.expand?.organizacao_id ? (
                        <div className="mt-1 flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-sky-600" />
                          <span className="font-semibold text-slate-900">
                            {selectedB2C.expand.organizacao_id.razao_social}
                          </span>
                          {selectedB2C.cargo && (
                            <Badge variant="outline" className="text-[10px] rounded-full">
                              {selectedB2C.cargo}
                            </Badge>
                          )}
                          {selectedB2C.departamento && (
                            <span className="text-[11px] text-slate-500">
                              • {selectedB2C.departamento}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-xs italic mt-0.5">
                          Atua de forma independente / sem vínculo a organização
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Origem de Cadastro
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedB2C.origem_sistema || 'NTC Pipedrive'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* HISTÓRICO DE NEGÓCIOS */}
                <div className="space-y-3 pt-3 border-t border-[#E3E7EB]">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Negócios Vinculados ({clientOpps.length})
                  </span>
                  {clientOpps.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-[#E3E7EB] rounded-xl">
                      Nenhum negócio registrado para esta pessoa.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientOpps.map((op) => (
                        <div
                          key={op.id}
                          className="p-3 rounded-xl border border-[#E3E7EB] bg-white flex items-center justify-between text-xs shadow-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{op.titulo}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Etapa:{' '}
                              <Badge variant="outline" className="text-[10px] rounded-full">
                                {op.etapa_atual}
                              </Badge>
                            </p>
                          </div>
                          <span className="font-black text-slate-900">
                            {formatCurrencyBRL(op.valor_estimado)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PAINEL LGPD */}
                <div className="space-y-3 pt-3 border-t border-[#E3E7EB]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Consentimento LGPD
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddPrefOpen(true)}
                      className="text-xs h-7 rounded-lg border-[#E3E7EB]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Preferência
                    </Button>
                  </div>
                  {clientPrefs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-[#E3E7EB] rounded-xl">
                      Nenhum consentimento formal cadastrado.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientPrefs.map((pref) => (
                        <div
                          key={pref.id}
                          className="p-2.5 rounded-xl border border-[#E3E7EB] bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{pref.canal}</span>
                            <span className="text-slate-500 text-[11px] ml-2">
                              ({pref.expand?.marca_id?.nome})
                            </span>
                          </div>
                          <Badge
                            className={cn(
                              'text-[10px] rounded-full',
                              pref.status_consentimento === 'Opt-in'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200',
                            )}
                          >
                            {pref.status_consentimento}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* MODAL NOVO CONTATO (+ PESSOA OU + ORGANIZAÇÃO) */}
      <Dialog open={isNewContactOpen} onOpenChange={setIsNewContactOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {newTipo === 'b2c' ? 'Adicionar Nova Pessoa' : 'Adicionar Nova Organização'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateContact} className="space-y-4">
            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Alternância de Tipo de Contato */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setNewTipo('b2c')
                  setValidationError(null)
                }}
                className={cn(
                  'py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2',
                  newTipo === 'b2c' ? 'bg-white text-[#017848] shadow-xs' : 'text-slate-600',
                )}
              >
                <User className="w-3.5 h-3.5" />
                <span>Pessoa (CPF)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewTipo('b2b')
                  setValidationError(null)
                }}
                className={cn(
                  'py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2',
                  newTipo === 'b2b' ? 'bg-white text-[#017848] shadow-xs' : 'text-slate-600',
                )}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Organização (CNPJ)</span>
              </button>
            </div>

            {newTipo === 'b2c' ? (
              /* CAMPOS PESSOA */
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-600">CPF (Validado)</Label>
                    {newCpf && (
                      <span
                        className={cn(
                          'text-[10px] font-bold',
                          isValidCPF(newCpf) ? 'text-emerald-600' : 'text-red-500',
                        )}
                      >
                        {isValidCPF(newCpf) ? 'Dígitos verificadores válidos' : 'CPF Inválido'}
                      </span>
                    )}
                  </div>
                  <Input
                    required
                    placeholder="000.000.000-00"
                    value={newCpf}
                    onChange={(e) => setNewCpf(maskCPF(e.target.value))}
                    className="h-9 text-xs font-mono rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Nome Completo</Label>
                  <Input
                    required
                    placeholder="Nome da pessoa"
                    value={newNomeCompleto}
                    onChange={(e) => setNewNomeCompleto(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                {/* Vínculo opcional a Organização */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">
                    Vincular a uma Organização (Opcional)
                  </Label>
                  <Select
                    value={newOrganizacaoId}
                    onValueChange={(val) => setNewOrganizacaoId(val === 'none' ? '' : val)}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Sem vínculo (Pessoa independente)" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">Sem vínculo (Pessoa independente)</SelectItem>
                      {clientesB2B.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.razao_social} (CNPJ: {b.cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Cargo</Label>
                    <Input
                      placeholder="ex: Comprador Técnico"
                      value={newCargo}
                      onChange={(e) => setNewCargo(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Departamento</Label>
                    <Input
                      placeholder="ex: Suprimentos"
                      value={newDepartamento}
                      onChange={(e) => setNewDepartamento(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* CAMPOS ORGANIZAÇÃO */
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-600">CNPJ (Validado)</Label>
                    {newCnpj && (
                      <span
                        className={cn(
                          'text-[10px] font-bold',
                          isValidCNPJ(newCnpj) ? 'text-emerald-600' : 'text-red-500',
                        )}
                      >
                        {isValidCNPJ(newCnpj) ? 'Dígitos verificadores válidos' : 'CNPJ Inválido'}
                      </span>
                    )}
                  </div>
                  <Input
                    required
                    placeholder="00.000.000/0000-00"
                    value={newCnpj}
                    onChange={(e) => setNewCnpj(maskCNPJ(e.target.value))}
                    className="h-9 text-xs font-mono rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Razão Social</Label>
                  <Input
                    required
                    placeholder="Nome empresarial formal"
                    value={newRazao}
                    onChange={(e) => setNewRazao(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Nome Fantasia</Label>
                    <Input
                      placeholder="Nome comercial"
                      value={newFantasia}
                      onChange={(e) => setNewFantasia(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">
                      Inscrição Estadual
                    </Label>
                    <Input
                      placeholder="IE"
                      value={newIE}
                      onChange={(e) => setNewIE(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">
                    Endereço Corporativo
                  </Label>
                  <Input
                    placeholder="Logradouro, número, cidade - UF"
                    value={newEndereco}
                    onChange={(e) => setNewEndereco(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </>
            )}

            {/* CAMPOS COMUNS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">E-mail</Label>
                <Input
                  type="email"
                  placeholder="contato@exemplo.com.br"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={newTelefone}
                  onChange={(e) => setNewTelefone(maskPhone(e.target.value))}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Marca de Captura</Label>
              <Select value={newMarcaCapturaId} onValueChange={setNewMarcaCapturaId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
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
                onClick={() => setIsNewContactOpen(false)}
                className="text-xs rounded-xl border-[#E3E7EB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Contato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR VÍNCULO B2B <-> B2C */}
      <Dialog open={isAddContatoOpen} onOpenChange={setIsAddContatoOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Vincular Pessoa à Organização
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddContato} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Pessoa Cadastrada</Label>
              <Select value={selectedB2CCandidateId} onValueChange={setSelectedB2CCandidateId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Selecione a pessoa..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {clientesB2C
                    .filter((c) => c.organizacao_id !== selectedB2B?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_completo} (CPF: {c.cpf})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Cargo na Organização</Label>
              <Input
                required
                placeholder="ex: Comprador Técnico, Gerente de Manutenção"
                value={contatoCargo}
                onChange={(e) => setContatoCargo(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Departamento</Label>
              <Input
                placeholder="ex: Suprimentos, Engenharia"
                value={contatoDepto}
                onChange={(e) => setContatoDepto(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddContatoOpen(false)}
                className="text-xs rounded-xl border-[#E3E7EB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
              >
                Confirmar Vínculo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR PREFERÊNCIA LGPD */}
      <Dialog open={isAddPrefOpen} onOpenChange={setIsAddPrefOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Registrar Consentimento LGPD
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddPreference} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Marca Específica</Label>
              <Select value={prefMarcaId} onValueChange={setPrefMarcaId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Canal</Label>
                <Select
                  value={prefCanal}
                  onValueChange={(v) => setPrefCanal(v as PreferenciaComunicacao['canal'])}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="E-mail">E-mail</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Telefone">Telefone</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Consentimento</Label>
                <Select
                  value={prefStatus}
                  onValueChange={(v) =>
                    setPrefStatus(v as PreferenciaComunicacao['status_consentimento'])
                  }
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Opt-in">Opt-in (Autorizado)</SelectItem>
                    <SelectItem value="Opt-out">Opt-out (Revogado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddPrefOpen(false)}
                className="text-xs rounded-xl border-[#E3E7EB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
              >
                Salvar Consentimento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR LEAD */}
      <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Target className="w-4 h-4 text-[#017848]" />
              <span>Adicionar Novo Lead</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateLead} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">
                Dados de Contato / Prospect
              </Label>
              <Input
                required
                placeholder="Nome, telefone, e-mail ou observação rápida..."
                value={newLeadDados}
                onChange={(e) => setNewLeadDados(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Canal de Origem</Label>
              <Select
                value={newLeadOrigem}
                onValueChange={(v) => setNewLeadOrigem(v as Lead['origem'])}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Formulário Web">Formulário Web</SelectItem>
                  <SelectItem value="Chat / WhatsApp">Chat / WhatsApp</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Evento / Feira">Evento / Feira</SelectItem>
                  <SelectItem value="Campanha Paga">Campanha Paga</SelectItem>
                  <SelectItem value="Prospecção Ativa">Prospecção Ativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Marca de Origem</Label>
              <Select value={newLeadMarcaId} onValueChange={setNewLeadMarcaId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
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
                onClick={() => setIsNewLeadOpen(false)}
                className="text-xs rounded-xl border-[#E3E7EB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingLead}
                className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
              >
                {isSubmittingLead ? 'Salvando...' : 'Salvar Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR LEAD */}
      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Edit2 className="w-4 h-4 text-[#017848]" />
              <span>Editar Lead</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEditLead} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">
                Dados de Contato / Prospect
              </Label>
              <Input
                required
                value={editLeadDados}
                onChange={(e) => setEditLeadDados(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Canal de Origem</Label>
                <Select
                  value={editLeadOrigem}
                  onValueChange={(v) => setEditLeadOrigem(v as Lead['origem'])}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Formulário Web">Formulário Web</SelectItem>
                    <SelectItem value="Chat / WhatsApp">Chat / WhatsApp</SelectItem>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                    <SelectItem value="Evento / Feira">Evento / Feira</SelectItem>
                    <SelectItem value="Campanha Paga">Campanha Paga</SelectItem>
                    <SelectItem value="Prospecção Ativa">Prospecção Ativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Status</Label>
                <Select
                  value={editLeadStatus}
                  onValueChange={(v) => setEditLeadStatus(v as Lead['status_qualificacao'])}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Qualificado">Qualificado</SelectItem>
                    <SelectItem value="Descartado">Descartado</SelectItem>
                    <SelectItem value="Convertido">Convertido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingLead(null)}
                className="text-xs rounded-xl border-[#E3E7EB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONVERTER LEAD (Lead -> Pessoa -> Negócio com rastreamento lead_origem_id) */}
      <Dialog
        open={!!selectedLeadToConvert}
        onOpenChange={(open) => !open && setSelectedLeadToConvert(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Briefcase className="w-4 h-4 text-[#017848]" />
              <span>Converter Lead em Negócio</span>
            </DialogTitle>
          </DialogHeader>

          {selectedLeadToConvert && (
            <form onSubmit={handleConvertLead} className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <p className="font-bold">Lead selecionado:</p>
                <p>{selectedLeadToConvert.dados_contato}</p>
                <p className="text-[11px] text-emerald-700">
                  Origem: {selectedLeadToConvert.origem} • Rastreamento:{' '}
                  <span className="font-mono">{selectedLeadToConvert.id}</span>
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Título do Negócio</Label>
                <Input
                  required
                  value={convTitulo}
                  onChange={(e) => setConvTitulo(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Valor Estimado (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={convValor}
                  onChange={(e) => setConvValor(parseFloat(e.target.value) || 0)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Funil de Vendas</Label>
                  <Select
                    value={convFunilId}
                    onValueChange={(val) => {
                      setConvFunilId(val)
                      const f = funis.find((x) => x.id === val)
                      if (f && f.etapas_ordenadas && f.etapas_ordenadas.length > 0) {
                        setConvEtapa(getEtapaNome(f.etapas_ordenadas[0]))
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {funis.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome_funil}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Etapa Inicial</Label>
                  <Select value={convEtapa} onValueChange={setConvEtapa}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {(funis.find((f) => f.id === convFunilId)?.etapas_ordenadas || []).map(
                        (etItem) => {
                          const nome = getEtapaNome(etItem)
                          return (
                            <SelectItem key={nome} value={nome}>
                              {nome}
                            </SelectItem>
                          )
                        },
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Trava de follow-up obrigatória */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Trava de Follow-up Obrigatório</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-amber-800 uppercase font-semibold">
                      Data Vencimento *
                    </Label>
                    <Input
                      type="date"
                      required
                      value={convFollowUpData}
                      onChange={(e) => setConvFollowUpData(e.target.value)}
                      className="h-8 text-xs bg-white border-amber-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-amber-800 uppercase font-semibold">
                      Ação Obrigatória
                    </Label>
                    <Input
                      required
                      value={convFollowUpDesc}
                      onChange={(e) => setConvFollowUpDesc(e.target.value)}
                      className="h-8 text-xs bg-white border-amber-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLeadToConvert(null)}
                  className="text-xs rounded-xl border-[#E3E7EB]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isConverting}
                  className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
                >
                  {isConverting ? 'Convertendo...' : 'Converter Lead'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
