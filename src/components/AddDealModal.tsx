import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  User,
  Building2,
  Info,
  Search,
  Download,
  Plus,
  Trash2,
  ChevronRight,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
  MapPin,
  Paperclip,
  FileText,
  X,
  UploadCloud,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { maskPhone, maskCPF, isValidCPF, onlyDigits } from '@/lib/formatters'
import { maskCurrency, parseCurrencyToNumber, formatCurrencyString } from '@/lib/currencyMask'
import type {
  Funil,
  ClienteB2B,
  ClienteB2C,
  EtapaItem,
  EtapaConfig,
  EtapaFunilRecord,
  AnexoOportunidade,
} from '@/types'
import {
  listarAnexosOportunidade,
  uploadAnexoOportunidade,
  excluirAnexo,
  getAnexoFileUrl,
  formatFileSize,
} from '@/services/anexos'
import { getEtapaNome, isWonStage } from '@/lib/relationshipStatus'
import { extrairCidadeEstado, ESTADOS_BRASIL } from '@/lib/geoUtils'
import { GeoSelector } from './GeoSelector'

export interface AddDealModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (dealId: string) => void
  onDelete?: (dealId: string) => void
  defaultFunilId?: string
  defaultEtapaId?: string
  defaultEtapaNome?: string
  mode?: 'create' | 'edit'
  dealId?: string
  initialValues?: {
    titulo?: string
    valor?: number | string
    etapa_id?: string
    etapa_atual?: string
    is_won?: boolean
    is_lost?: boolean
    funil_id?: string
    cliente_b2b_id?: string
    cliente_b2c_id?: string
    organizacao_id?: string
    pessoa_id?: string
    vendedor_id?: string
    documento_faturamento?: 'CPF' | 'CNPJ' | 'AMBOS'
    observacoes?: string
    origem?: string
    id_canal_origem?: string
    cidade?: string
    estado?: string
    pais?: string
    cidade_entrega?: string
    estado_entrega?: string
    pais_entrega?: string
    proxima_acao_data?: string
    proxima_acao_descricao?: string
    data_fechamento_esperada?: string
    tipo_cliente?: string
    lead_origem_id?: string
    contato_nome?: string
    contato_email?: string
    contato_telefone?: string
  }
}

interface PhoneEntry {
  id: string
  number: string
  tipo: 'Comercial' | 'Celular' | 'Trabalho' | 'Casa' | 'Outro'
}

interface EmailEntry {
  id: string
  address: string
  tipo: 'Comercial' | 'Pessoal' | 'Trabalho' | 'Outro'
}

export const AddDealModal: React.FC<AddDealModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  onDelete,
  defaultFunilId,
  defaultEtapaId,
  defaultEtapaNome,
  mode = 'create',
  dealId,
  initialValues,
}) => {
  const isEditMode = mode === 'edit' || !!dealId
  const { activeBrand, marcas } = useBrand()
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const mouseDownOutsideRef = useRef(false)

  // Listas de dados mestre
  const [funis, setFunis] = useState<Funil[]>([])
  const [pessoas, setPessoas] = useState<ClienteB2C[]>([])
  const [organizacoes, setOrganizacoes] = useState<ClienteB2B[]>([])
  const [usersList, setUsersList] = useState<{ id: string; name?: string; email: string }[]>([])
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Painel Esquerdo: Campos de Negócio (exatamente na ordem da captura)
  // 1. Pessoa de contato (busca + criação com badge NOVO)
  const [personSearch, setPersonSearch] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [newPersonCpf, setNewPersonCpf] = useState('')
  const [isNewPersonCandidate, setIsNewPersonCandidate] = useState(false)
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false)
  const personInputRef = useRef<HTMLInputElement>(null)

  // 2. Organização (busca / seleção + criação inline com badge NOVO)
  const [orgSearch, setOrgSearch] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [isNewOrgCandidate, setIsNewOrgCandidate] = useState(false)
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false)
  const orgInputRef = useRef<HTMLInputElement>(null)

  // Erros de validação inline de documentos
  const [personCpfError, setPersonCpfError] = useState<string | null>(null)

  // 3. Título
  const [titulo, setTitulo] = useState('')
  const [userEditedTitle, setUserEditedTitle] = useState(false)

  // 4. Valor + Moeda
  const [valor, setValor] = useState<string>('')
  const [moeda, setMoeda] = useState<'BRL' | 'USD' | 'EUR'>('BRL')

  // 5. Funil
  const [funilId, setFunilId] = useState<string>('')

  // 6. Etapa do funil (seleção por ID com espelho de nome)
  const [etapaId, setEtapaId] = useState<string>('')
  const [etapaAtual, setEtapaAtual] = useState<string>('')
  const [etapasDoFunil, setEtapasDoFunil] = useState<EtapaFunilRecord[]>([])
  const [isAddingNewEtapa, setIsAddingNewEtapa] = useState(false)
  const [novaEtapaNome, setNovaEtapaNome] = useState('')

  // 7. Data de fechamento esperada (DD/MM/AAAA)
  const [dataFechamento, setDataFechamento] = useState<string>('')

  // Documento fiscal para faturamento (CPF / CNPJ / AMBOS)
  const [documentoFaturamento, setDocumentoFaturamento] = useState<'CPF' | 'CNPJ' | 'AMBOS'>('CNPJ')

  // Próxima ação / follow-up: nasce vazia por padrão
  const [followUpData, setFollowUpData] = useState<string>('')
  const [followUpDesc, setFollowUpDesc] = useState<string>('')

  // 8. Proprietário
  const [proprietarioId, setProprietarioId] = useState<string>('')

  // 9. Canal da origem
  const [canalOrigem, setCanalOrigem] = useState<string>('Formulário Web')

  // 10. ID do canal da origem
  const [idCanalOrigem, setIdCanalOrigem] = useState<string>('')
  const [leadOrigemId, setLeadOrigemId] = useState<string>('')

  // Geografia: Faturamento e Entrega
  const [cidadeFaturamento, setCidadeFaturamento] = useState('')
  const [estadoFaturamento, setEstadoFaturamento] = useState('')
  const [paisFaturamento, setPaisFaturamento] = useState('Brasil')
  const [cidadeEntrega, setCidadeEntrega] = useState('')
  const [estadoEntrega, setEstadoEntrega] = useState('')
  const [paisEntrega, setPaisEntrega] = useState('Brasil')
  const [entregaDiferente, setEntregaDiferente] = useState(false)

  // Painel Direito: PESSOA
  const [phones, setPhones] = useState<PhoneEntry[]>([{ id: '1', number: '', tipo: 'Comercial' }])
  const [emails, setEmails] = useState<EmailEntry[]>([{ id: '1', address: '', tipo: 'Comercial' }])

  // Rodapé: Nota/Observações (contador 0/15.000)
  const [notaObservacoes, setNotaObservacoes] = useState<string>('')
  const [showNotaField, setShowNotaField] = useState(false)

  // Anexos do negócio
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [existingAnexos, setExistingAnexos] = useState<AnexoOportunidade[]>([])
  const [isLoadingAnexos, setIsLoadingAnexos] = useState(false)
  const [deletingAnexoId, setDeletingAnexoId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega dados mestre ao abrir
  useEffect(() => {
    if (!open) return

    const loadData = async () => {
      setIsLoadingMasterData(true)
      try {
        let funisRes: Funil[] = []
        try {
          if (activeBrand) {
            funisRes = await pb.collection('funis').getFullList<Funil>({
              filter: `marca_id = "${activeBrand.id}"`,
              sort: 'nome_funil',
            })
          } else {
            funisRes = await pb.collection('funis').getFullList<Funil>({
              sort: 'nome_funil',
            })
          }
        } catch (e) {
          console.warn('Falha no filtro de funis por marca, buscando todos:', e)
          funisRes = await pb
            .collection('funis')
            .getFullList<Funil>({
              sort: 'nome_funil',
            })
            .catch(() => [])
        }

        const [pessoasRes, orgsRes, usersRes] = await Promise.all([
          pb
            .collection('pessoas')
            .getFullList<ClienteB2C>({
              sort: 'nome_completo',
              limit: 200,
            })
            .catch(() => []),
          pb
            .collection('organizacoes')
            .getFullList<ClienteB2B>({
              sort: 'razao_social',
              limit: 200,
            })
            .catch(() => []),
          pb
            .collection('users')
            .getFullList<{ id: string; name?: string; email: string }>({
              sort: 'name',
            })
            .catch(() => []),
        ])

        setFunis(funisRes)
        setPessoas(pessoasRes)
        setOrganizacoes(orgsRes)
        setUsersList(usersRes)

        // Limpa lista de arquivos pendentes ao abrir o modal
        setPendingFiles([])

        // Se estiver em modo edição com dealId mas initialValues não tiver sido passado ou estiver incompleto,
        // busca o registro live da oportunidade para garantir dados precisos
        let liveDeal: any = null
        if (isEditMode && dealId) {
          try {
            liveDeal = await pb.collection('oportunidades').getOne(dealId)
          } catch (e) {
            console.warn('Aviso ao carregar dados live da oportunidade no modal:', e)
          }
        }

        // Carrega anexos existentes se estiver em modo edição
        if (isEditMode && dealId) {
          try {
            setIsLoadingAnexos(true)
            const anexosList = await listarAnexosOportunidade(dealId)
            setExistingAnexos(anexosList)
          } catch (errAnexos) {
            console.warn('Aviso ao carregar anexos da oportunidade no modal:', errAnexos)
            setExistingAnexos([])
          } finally {
            setIsLoadingAnexos(false)
          }
        } else {
          setExistingAnexos([])
        }

        const rawEffectiveValues = {
          ...liveDeal,
          ...initialValues,
          // Garante que campos presentes no liveDeal tenham prioridade se initialValues for vazio
          proxima_acao_data:
            initialValues?.proxima_acao_data !== undefined
              ? initialValues.proxima_acao_data
              : liveDeal?.proxima_acao_data,
          proxima_acao_descricao:
            initialValues?.proxima_acao_descricao !== undefined
              ? initialValues.proxima_acao_descricao
              : liveDeal?.proxima_acao_descricao,
          data_fechamento_esperada:
            initialValues?.data_fechamento_esperada !== undefined
              ? initialValues.data_fechamento_esperada
              : liveDeal?.data_fechamento_esperada,
        }

        // Identifica se há qualquer pré-preenchimento legítimo de dados além de contexto puro de funil/etapa do Kanban (+)
        const hasSpecificInitialData = Boolean(
          isEditMode ||
          dealId ||
          rawEffectiveValues?.titulo ||
          (rawEffectiveValues?.valor !== undefined &&
            rawEffectiveValues?.valor !== null &&
            rawEffectiveValues?.valor !== '') ||
          rawEffectiveValues?.cliente_b2b_id ||
          rawEffectiveValues?.organizacao_id ||
          rawEffectiveValues?.cliente_b2c_id ||
          rawEffectiveValues?.pessoa_id ||
          rawEffectiveValues?.contato_nome ||
          rawEffectiveValues?.contato_email ||
          rawEffectiveValues?.contato_telefone ||
          rawEffectiveValues?.lead_origem_id ||
          rawEffectiveValues?.observacoes ||
          rawEffectiveValues?.cidade ||
          rawEffectiveValues?.estado ||
          rawEffectiveValues?.cidade_entrega ||
          rawEffectiveValues?.estado_entrega ||
          rawEffectiveValues?.proxima_acao_data ||
          rawEffectiveValues?.proxima_acao_descricao ||
          rawEffectiveValues?.data_fechamento_esperada ||
          rawEffectiveValues?.origem ||
          rawEffectiveValues?.id_canal_origem,
        )

        // Reseta todos os campos para estado de fábrica em modo de criação sem dados herdados
        // Isso previne que reaberturas após edições ou criações anteriores retenham dados residuais
        setPersonSearch('')
        setSelectedPersonId(null)
        setNewPersonCpf('')
        setIsNewPersonCandidate(false)
        setIsPersonDropdownOpen(false)
        setPersonCpfError(null)

        setOrgSearch('')
        setSelectedOrgId(null)
        setIsNewOrgCandidate(false)
        setIsOrgDropdownOpen(false)

        setTitulo('')
        setUserEditedTitle(false)
        setValor('')
        setMoeda('BRL')
        setDocumentoFaturamento('CNPJ')
        setDataFechamento('')
        setFollowUpData('')
        setFollowUpDesc('')
        setCanalOrigem('Formulário Web')
        setIdCanalOrigem('')
        setLeadOrigemId('')

        setCidadeFaturamento('')
        setEstadoFaturamento('')
        setPaisFaturamento('Brasil')
        setCidadeEntrega('')
        setEstadoEntrega('')
        setPaisEntrega('Brasil')
        setEntregaDiferente(false)

        setPhones([{ id: '1', number: '', tipo: 'Comercial' }])
        setEmails([{ id: '1', address: '', tipo: 'Comercial' }])
        setNotaObservacoes('')
        setShowNotaField(false)
        setIsAddingNewEtapa(false)
        setNovaEtapaNome('')

        // Proprietário: default para vendedor_id se especificado ou usuário logado
        if (rawEffectiveValues?.vendedor_id) {
          setProprietarioId(rawEffectiveValues.vendedor_id)
        } else if (user?.id) {
          setProprietarioId(user.id)
        } else {
          setProprietarioId('')
        }

        // Se houver dados específicos (edição, duplicação, conversão de lead, recompra), usa effectiveValues
        const effectiveValues = hasSpecificInitialData ? rawEffectiveValues : null

        // Preenche com effectiveValues se fornecido (ex: Recompra, Duplicar ou Edição)
        const targetFunilId = rawEffectiveValues?.funil_id || defaultFunilId
        const initialFunil = funisRes.find((f) => f.id === targetFunilId) || funisRes[0] || null
        const requestedEtapaId = rawEffectiveValues?.etapa_id || defaultEtapaId
        const requestedEtapaNome = rawEffectiveValues?.etapa_atual || defaultEtapaNome

        if (initialFunil) {
          setFunilId(initialFunil.id)

          // Carrega etapas da collection etapas_funil para o funil ativo
          let etapasLive: EtapaFunilRecord[] = []
          try {
            etapasLive = await pb.collection('etapas_funil').getFullList<EtapaFunilRecord>({
              filter: `funil_id = "${initialFunil.id}"`,
              sort: 'ordem',
            })
          } catch (e) {
            console.warn('Erro ao carregar etapas_funil do funil:', e)
          }

          // Se ainda não houver na collection, faz fallback para etapas_ordenadas do funil
          if (etapasLive.length === 0 && initialFunil.etapas_ordenadas) {
            etapasLive = (initialFunil.etapas_ordenadas as any[]).map((e, idx) => ({
              id: typeof e === 'object' && e.id ? e.id : `et_${idx}`,
              funil_id: initialFunil.id,
              nome: typeof e === 'string' ? e : e.nome || '',
              ordem: idx,
              valor_referencia: typeof e === 'object' ? e.valor_referencia : 0,
              is_won: typeof e === 'object' ? Boolean(e.is_won) : false,
              is_lost: typeof e === 'object' ? Boolean(e.is_lost) : false,
              created: '',
              updated: '',
            }))
          }
          setEtapasDoFunil(etapasLive)

          // Seleciona a etapa por ID preferencialmente, depois por nome
          let matched = etapasLive.find(
            (e) =>
              (requestedEtapaId && e.id === requestedEtapaId) ||
              (requestedEtapaNome && e.nome === requestedEtapaNome),
          )

          if (matched) {
            setEtapaId(matched.id)
            setEtapaAtual(matched.nome)
          } else if (isEditMode && (initialValues?.etapa_id || initialValues?.etapa_atual)) {
            setEtapaId(initialValues.etapa_id || '')
            setEtapaAtual(initialValues.etapa_atual || '')
          } else if (etapasLive.length > 0) {
            setEtapaId(etapasLive[0].id)
            setEtapaAtual(etapasLive[0].nome)
          }
        } else if (isEditMode && (initialValues?.etapa_id || initialValues?.etapa_atual)) {
          setEtapaId(initialValues.etapa_id || '')
          setEtapaAtual(initialValues.etapa_atual || '')
        }

        if (initialValues?.vendedor_id) {
          setProprietarioId(initialValues.vendedor_id)
        } else if (user?.id) {
          setProprietarioId((prev) => prev || user.id)
        }

        if (effectiveValues) {
          if (effectiveValues.titulo) {
            setTitulo(effectiveValues.titulo)
            setUserEditedTitle(true)
          }
          const valRaw =
            effectiveValues.valor !== undefined && effectiveValues.valor !== null
              ? effectiveValues.valor
              : effectiveValues.valor_estimado
          if (valRaw !== undefined && valRaw !== null && valRaw !== '') {
            // Formata o valor inicial com separadores e centavos se for numérico ou com casas decimais
            const num =
              typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw).replace(',', '.'))
            if (!isNaN(num) && num > 0) {
              setValor(formatCurrencyString(num))
            } else if (typeof valRaw === 'string' && valRaw.trim()) {
              setValor(maskCurrency(valRaw))
            } else {
              setValor('')
            }
          }
          if (effectiveValues.documento_faturamento) {
            setDocumentoFaturamento(effectiveValues.documento_faturamento)
          }
          if (effectiveValues.observacoes) {
            setNotaObservacoes(effectiveValues.observacoes)
          }
          if (effectiveValues.origem) {
            setCanalOrigem(effectiveValues.origem)
          }
          if (effectiveValues.id_canal_origem) {
            setIdCanalOrigem(effectiveValues.id_canal_origem)
          }
          if (effectiveValues.lead_origem_id) {
            setLeadOrigemId(effectiveValues.lead_origem_id)
          }

          if (effectiveValues.cidade) {
            setCidadeFaturamento(effectiveValues.cidade)
          }
          if (effectiveValues.estado) {
            setEstadoFaturamento(effectiveValues.estado)
          }
          if (effectiveValues.pais) {
            setPaisFaturamento(effectiveValues.pais)
          }

          // Checa se há entrega preenchida ou diferente de faturamento
          const temEntregaInformada = !!(
            effectiveValues.cidade_entrega ||
            effectiveValues.estado_entrega ||
            (effectiveValues.pais_entrega && effectiveValues.pais_entrega !== 'Brasil')
          )
          const entregaDiferenteDeFaturamento =
            (effectiveValues.cidade_entrega &&
              effectiveValues.cidade_entrega !== effectiveValues.cidade) ||
            (effectiveValues.estado_entrega &&
              effectiveValues.estado_entrega !== effectiveValues.estado) ||
            (effectiveValues.pais_entrega && effectiveValues.pais_entrega !== effectiveValues.pais)

          if (effectiveValues.cidade_entrega) {
            setCidadeEntrega(effectiveValues.cidade_entrega)
          }
          if (effectiveValues.estado_entrega) {
            setEstadoEntrega(effectiveValues.estado_entrega)
          }
          if (effectiveValues.pais_entrega) {
            setPaisEntrega(effectiveValues.pais_entrega)
          }

          if (temEntregaInformada && entregaDiferenteDeFaturamento) {
            setEntregaDiferente(true)
          } else {
            setEntregaDiferente(false)
          }

          if (effectiveValues.proxima_acao_data) {
            setFollowUpData(effectiveValues.proxima_acao_data.substring(0, 10))
          }
          if (effectiveValues.proxima_acao_descricao) {
            setFollowUpDesc(effectiveValues.proxima_acao_descricao)
          }
          if (effectiveValues.data_fechamento_esperada) {
            setDataFechamento(effectiveValues.data_fechamento_esperada.substring(0, 10))
          }

          const targetOrgId = effectiveValues.cliente_b2b_id || effectiveValues.organizacao_id
          if (targetOrgId) {
            const org = orgsRes.find((o) => o.id === targetOrgId)
            if (org) {
              setSelectedOrgId(org.id)
              setOrgSearch(org.razao_social)
              if (!initialValues.cidade && org.endereco_corporativo) {
                const loc = extrairCidadeEstado(org.endereco_corporativo)
                if (loc.cidade) setCidadeFaturamento(loc.cidade)
                if (loc.estado) setEstadoFaturamento(loc.estado)
                if (loc.pais) setPaisFaturamento(loc.pais)
                if (!initialValues.cidade_entrega) {
                  setCidadeEntrega(loc.cidade)
                  setEstadoEntrega(loc.estado)
                  setPaisEntrega(loc.pais || 'Brasil')
                }
              }
            }
          }

          const targetPessoaId = effectiveValues.cliente_b2c_id || effectiveValues.pessoa_id
          if (targetPessoaId) {
            const p = pessoasRes.find((x) => x.id === targetPessoaId)
            if (p) {
              setSelectedPersonId(p.id)
              setPersonSearch(p.nome_completo)
              if (p.telefone) {
                setPhones([{ id: '1', number: p.telefone, tipo: 'Comercial' }])
              }
              if (p.email_principal) {
                setEmails([{ id: '1', address: p.email_principal, tipo: 'Comercial' }])
              }
              if (!initialValues.cidade && !targetOrgId && p.endereco_residencial) {
                const loc = extrairCidadeEstado(p.endereco_residencial)
                if (loc.cidade) setCidadeFaturamento(loc.cidade)
                if (loc.estado) setEstadoFaturamento(loc.estado)
                if (loc.pais) setPaisFaturamento(loc.pais)
                if (!initialValues.cidade_entrega) {
                  setCidadeEntrega(loc.cidade)
                  setEstadoEntrega(loc.estado)
                  setPaisEntrega(loc.pais || 'Brasil')
                }
              }
            }
          } else if (initialValues.contato_nome) {
            // Se veio contato pré-preenchido do Lead sem cadastro prévio
            setPersonSearch(initialValues.contato_nome)
            setIsNewPersonCandidate(true)
            if (initialValues.contato_telefone) {
              setPhones([{ id: '1', number: initialValues.contato_telefone, tipo: 'Comercial' }])
            }
            if (initialValues.contato_email) {
              setEmails([{ id: '1', address: initialValues.contato_email, tipo: 'Comercial' }])
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do modal de negócio:', err)
      } finally {
        setIsLoadingMasterData(false)
      }
    }

    loadData()
  }, [open, activeBrand, defaultFunilId, defaultEtapaId, defaultEtapaNome, user?.id, initialValues])

  // Garante que o proprietário sempre venha preenchido com o usuário logado ao abrir o modal (caso ainda não esteja definido)
  useEffect(() => {
    if (open && user?.id && !proprietarioId && !initialValues?.vendedor_id) {
      setProprietarioId(user.id)
    }
  }, [open, user?.id, proprietarioId, initialValues?.vendedor_id])

  // Rastreia se o mousedown ocorreu fora do painel do modal (no backdrop/overlay)
  // para fechar apenas se mousedown E mouseup ocorrerem estritamente fora do painel.
  useEffect(() => {
    if (!open) return

    const isElementInsideModalOrPortal = (el: HTMLElement | null): boolean => {
      if (!el) return true

      // Se o elemento não estiver mais conectado ao DOM (ex: opção de Select Radix desmontada na seleção),
      // trata como interno para não disparar falso fechamento por clique fora.
      if (!el.isConnected || !document.contains(el)) return true

      // Quando um Select/Dropdown do Radix está aberto, a biblioteca aplica pointer-events: none no body.
      // Um clique no gatilho do Select ou em outros elementos nesse estado pode ser resolvido contra document.body/html.
      // Se document.body estiver com pointer-events: none, qualquer clique é considerado interno.
      if (typeof window !== 'undefined' && document.body) {
        const bodyPointerEvents = window.getComputedStyle(document.body).pointerEvents
        if (bodyPointerEvents === 'none') {
          return true
        }
      }

      // Alvos body ou html nunca devem ser tratados como clique fora para fechar o modal
      // (o backdrop/overlay legítimo é um elemento de overlay fixo sob o dialog portal, não o body).
      if (
        el === document.body ||
        el === document.documentElement ||
        el.tagName === 'BODY' ||
        el.tagName === 'HTML'
      ) {
        return true
      }

      return !!(
        el.closest('[role="dialog"]') ||
        el.closest('[data-radix-popper-content-wrapper]') ||
        el.closest('[role="listbox"]') ||
        el.closest('[role="combobox"]') ||
        el.closest('[data-radix-focus-guard]') ||
        el.closest('[data-radix-select-viewport]') ||
        el.closest('[data-radix-portal]') ||
        el.closest('.radix-select-content')
      )
    }

    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) {
        mouseDownOutsideRef.current = false
        return
      }

      // Se o clique começou dentro do modal ou de portais/seletores Radix, não é outside
      if (isElementInsideModalOrPortal(target)) {
        mouseDownOutsideRef.current = false
      } else {
        mouseDownOutsideRef.current = true
      }
    }

    const handleDocumentMouseUp = (e: MouseEvent) => {
      if (!mouseDownOutsideRef.current) {
        return
      }

      const target = e.target as HTMLElement | null

      // Blindagem contra nós desmontados / órfãos:
      // Ao selecionar ou clicar em itens de Select Radix, o SelectContent é desmontado imediatamente.
      // O mouseup subsequente dispara contra um nó órfão (target nulo ou desconectado do documento).
      // Se target for nulo ou desconectado de document, tratar como INTERNO (não fechar o modal).
      if (!target || !target.isConnected || !document.contains(target)) {
        mouseDownOutsideRef.current = false
        return
      }

      const isInside = isElementInsideModalOrPortal(target)

      // Só fecha se ambos (mousedown e mouseup) forem estritamente fora do modal e fora de portais
      if (!isInside) {
        onOpenChange(false)
      }

      mouseDownOutsideRef.current = false
    }

    document.addEventListener('mousedown', handleDocumentMouseDown, true)
    document.addEventListener('mouseup', handleDocumentMouseUp, true)

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown, true)
      document.removeEventListener('mouseup', handleDocumentMouseUp, true)
      mouseDownOutsideRef.current = false
    }
  }, [open, onOpenChange])

  // Quando o funil muda, recarrega etapas da collection etapas_funil e sincroniza etapa_id
  useEffect(() => {
    if (!funilId || !open) return

    let isMounted = true
    const carregarEtapasDoFunil = async () => {
      try {
        let etapasLive = await pb.collection('etapas_funil').getFullList<EtapaFunilRecord>({
          filter: `funil_id = "${funilId}"`,
          sort: 'ordem',
        })

        const f = funis.find((x) => x.id === funilId)
        if (etapasLive.length === 0 && f?.etapas_ordenadas) {
          etapasLive = (f.etapas_ordenadas as any[]).map((e, idx) => ({
            id: typeof e === 'object' && e.id ? e.id : `et_${idx}`,
            funil_id: funilId,
            nome: typeof e === 'string' ? e : e.nome || '',
            ordem: idx,
            valor_referencia: typeof e === 'object' ? e.valor_referencia : 0,
            is_won: typeof e === 'object' ? Boolean(e.is_won) : false,
            is_lost: typeof e === 'object' ? Boolean(e.is_lost) : false,
            created: '',
            updated: '',
          }))
        }

        if (!isMounted) return
        setEtapasDoFunil(etapasLive)

        // Verifica se a etapa selecionada pertence a este funil
        const etapaPertenceAoFunil = etapasLive.some(
          (e) => (etapaId && e.id === etapaId) || (etapaAtual && e.nome === etapaAtual),
        )

        if (etapaPertenceAoFunil) {
          const matched = etapasLive.find(
            (e) => (etapaId && e.id === etapaId) || (etapaAtual && e.nome === etapaAtual),
          )
          if (matched) {
            setEtapaId(matched.id)
            setEtapaAtual(matched.nome)
          }
        } else if (
          isEditMode &&
          initialValues?.funil_id === funilId &&
          (initialValues?.etapa_id || initialValues?.etapa_atual)
        ) {
          // Em modo edição, se voltou para o funil original, restaura a etapa original
          const matchedOriginal = etapasLive.find(
            (e) =>
              (initialValues.etapa_id && e.id === initialValues.etapa_id) ||
              (initialValues.etapa_atual && e.nome === initialValues.etapa_atual),
          )
          if (matchedOriginal) {
            setEtapaId(matchedOriginal.id)
            setEtapaAtual(matchedOriginal.nome)
          } else {
            setEtapaId(initialValues.etapa_id || '')
            setEtapaAtual(initialValues.etapa_atual || '')
          }
        } else if (etapasLive.length > 0) {
          setEtapaId(etapasLive[0].id)
          setEtapaAtual(etapasLive[0].nome)
        }
      } catch (err) {
        console.warn('Erro ao atualizar etapas do funil:', err)
      }
    }

    carregarEtapasDoFunil()
    return () => {
      isMounted = false
    }
  }, [funilId, funis, isEditMode, initialValues, open])

  // Atualiza título automaticamente quando a pessoa ou organização muda (se o usuário não editou manualmente)
  const handleUpdateTitleSuggestion = (name: string) => {
    if (!userEditedTitle) {
      setTitulo(name.trim())
    }
  }

  // Ação de seleção ou criação de pessoa
  const handleSelectPerson = (p: ClienteB2C) => {
    setSelectedPersonId(p.id)
    setPersonSearch(p.nome_completo)
    setNewPersonCpf(p.cpf || '')
    setPersonCpfError(null)
    setIsNewPersonCandidate(false)
    setIsPersonDropdownOpen(false)
    handleUpdateTitleSuggestion(p.nome_completo)

    // Preenche painel direito com os dados da pessoa existente
    if (p.telefone) {
      setPhones([{ id: '1', number: p.telefone, tipo: 'Comercial' }])
    }
    if (p.email_principal) {
      setEmails([{ id: '1', address: p.email_principal, tipo: 'Comercial' }])
    }

    // Se a pessoa tiver organização vinculada, pré-seleciona
    let linkedOrg: ClienteB2B | undefined
    if (p.organizacao_id && !selectedOrgId) {
      linkedOrg = organizacoes.find((o) => o.id === p.organizacao_id)
      if (linkedOrg) {
        setSelectedOrgId(linkedOrg.id)
        setOrgSearch(linkedOrg.razao_social)
      }
    }

    // Herança geográfica automática:
    // Se a pessoa tiver vínculo com organização, usa localidade da organização.
    // Senão, usa endereco_residencial da pessoa física.
    const orgParaLocalidade =
      linkedOrg || (selectedOrgId ? organizacoes.find((o) => o.id === selectedOrgId) : undefined)
    if (orgParaLocalidade?.endereco_corporativo) {
      const loc = extrairCidadeEstado(orgParaLocalidade.endereco_corporativo)
      if (loc.cidade) setCidadeFaturamento(loc.cidade)
      if (loc.estado) setEstadoFaturamento(loc.estado)
      if (loc.pais) setPaisFaturamento(loc.pais)
      if (!entregaDiferente) {
        setCidadeEntrega(loc.cidade)
        setEstadoEntrega(loc.estado)
        setPaisEntrega(loc.pais || 'Brasil')
      }
    } else if (p.endereco_residencial) {
      const loc = extrairCidadeEstado(p.endereco_residencial)
      if (loc.cidade) setCidadeFaturamento(loc.cidade)
      if (loc.estado) setEstadoFaturamento(loc.estado)
      if (loc.pais) setPaisFaturamento(loc.pais)
      if (!entregaDiferente) {
        setCidadeEntrega(loc.cidade)
        setEstadoEntrega(loc.estado)
        setPaisEntrega(loc.pais || 'Brasil')
      }
    }
  }

  const handleCreateNewPersonCandidate = () => {
    if (!personSearch.trim()) return
    setSelectedPersonId(null)
    setIsNewPersonCandidate(true)
    setIsPersonDropdownOpen(false)
    handleUpdateTitleSuggestion(personSearch.trim())
  }

  // Ação de seleção ou criação inline de organização
  const handleSelectOrg = (o: ClienteB2B) => {
    setSelectedOrgId(o.id)
    setOrgSearch(o.razao_social)
    setIsNewOrgCandidate(false)
    setIsOrgDropdownOpen(false)
    if (!personSearch && !userEditedTitle) {
      setTitulo(o.razao_social)
    }

    // Herança geográfica automática a partir do endereço corporativo da organização
    if (o.endereco_corporativo) {
      const loc = extrairCidadeEstado(o.endereco_corporativo)
      if (loc.cidade) setCidadeFaturamento(loc.cidade)
      if (loc.estado) setEstadoFaturamento(loc.estado)
      if (loc.pais) setPaisFaturamento(loc.pais)
      if (!entregaDiferente) {
        setCidadeEntrega(loc.cidade)
        setEstadoEntrega(loc.estado)
        setPaisEntrega(loc.pais || 'Brasil')
      }
    }
  }

  const handleCreateNewOrgCandidate = () => {
    if (!orgSearch.trim()) return
    setSelectedOrgId(null)
    setIsNewOrgCandidate(true)
    setIsOrgDropdownOpen(false)
    if (!personSearch && !userEditedTitle) {
      setTitulo(orgSearch.trim())
    }
  }

  // Manipuladores de telefones no painel direito
  const handleAddPhone = () => {
    setPhones((prev) => [...prev, { id: Date.now().toString(), number: '', tipo: 'Comercial' }])
  }

  const handleUpdatePhone = (id: string, number: string, tipo?: PhoneEntry['tipo']) => {
    setPhones((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              number: maskPhone(number),
              ...(tipo ? { tipo } : {}),
            }
          : p,
      ),
    )
  }

  const handleRemovePhone = (id: string) => {
    if (phones.length <= 1) {
      setPhones([{ id: '1', number: '', tipo: 'Comercial' }])
    } else {
      setPhones((prev) => prev.filter((p) => p.id !== id))
    }
  }

  // Manipuladores de emails no painel direito
  const handleAddEmail = () => {
    setEmails((prev) => [...prev, { id: Date.now().toString(), address: '', tipo: 'Comercial' }])
  }

  const handleUpdateEmail = (id: string, address: string, tipo?: EmailEntry['tipo']) => {
    setEmails((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              address,
              ...(tipo ? { tipo } : {}),
            }
          : e,
      ),
    )
  }

  const handleRemoveEmail = (id: string) => {
    if (emails.length <= 1) {
      setEmails([{ id: '1', address: '', tipo: 'Comercial' }])
    } else {
      setEmails((prev) => prev.filter((e) => e.id !== id))
    }
  }

  // Handlers de Anexos
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)
    // Limite preventivo de 50MB por arquivo
    const maxSizeBytes = 50 * 1024 * 1024
    const validFiles: File[] = []
    const oversizedFiles: string[] = []

    for (const f of newFiles) {
      if (f.size > maxSizeBytes) {
        oversizedFiles.push(f.name)
      } else {
        validFiles.push(f)
      }
    }

    if (oversizedFiles.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: `Os seguintes arquivos excedem o limite de 50 MB: ${oversizedFiles.join(', ')}`,
      })
    }

    if (validFiles.length > 0) {
      setPendingFiles((prev) => [...prev, ...validFiles])
    }

    // Reseta o input para permitir selecionar o mesmo arquivo novamente se desejado
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDeleteExistingAnexo = async (anexoId: string) => {
    try {
      setDeletingAnexoId(anexoId)
      await excluirAnexo(anexoId)
      setExistingAnexos((prev) => prev.filter((a) => a.id !== anexoId))
      toast({
        title: 'Anexo removido',
        description: 'Documento excluído com sucesso.',
      })
    } catch (err: any) {
      console.error('Erro ao excluir anexo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir anexo',
        description: err?.message || 'Não foi possível remover o arquivo.',
      })
    } finally {
      setDeletingAnexoId(null)
    }
  }

  // Adicionar nova etapa inline ao funil ativo na collection etapas_funil + espelho funis.etapas_ordenadas
  const handleSaveNewEtapa = async () => {
    if (!novaEtapaNome.trim() || !funilId) return
    const activeF = funis.find((f) => f.id === funilId)
    if (!activeF) return

    const novaEtapaTrim = novaEtapaNome.trim()
    const proximaOrdem = etapasDoFunil.length

    // Deduz flags de fechamento pelo nome de forma segura
    const lowerTrim = novaEtapaTrim.toLowerCase()
    let isWonInit = false
    let isLostInit = false
    if (lowerTrim.includes('perdido') || lowerTrim.includes('cancelado')) {
      isLostInit = true
    } else if (lowerTrim.includes('ganho') || lowerTrim === 'fechado') {
      isWonInit = true
    }

    try {
      // 1. Cria na collection etapas_funil
      const etapaCriada = await pb.collection('etapas_funil').create<EtapaFunilRecord>({
        funil_id: funilId,
        nome: novaEtapaTrim,
        ordem: proximaOrdem,
        valor_referencia: 0,
        is_won: isWonInit,
        is_lost: isLostInit,
      })

      // 2. Atualiza etapas_ordenadas no funil
      const novaEtapaObj: EtapaConfig = {
        id: etapaCriada.id,
        nome: novaEtapaTrim,
        ordem: proximaOrdem,
        valor_referencia: 0,
        is_won: isWonInit,
        is_lost: isLostInit,
      }
      const novasEtapas: EtapaItem[] = [...(activeF.etapas_ordenadas || []), novaEtapaObj]
      await pb.collection('funis').update(activeF.id, {
        etapas_ordenadas: novasEtapas,
      })
      activeF.etapas_ordenadas = novasEtapas

      setEtapasDoFunil((prev) => [...prev, etapaCriada])
      setEtapaId(etapaCriada.id)
      setEtapaAtual(novaEtapaTrim)
      setNovaEtapaNome('')
      setIsAddingNewEtapa(false)
      toast({
        title: 'Etapa adicionada!',
        description: `A etapa "${novaEtapaTrim}" foi incluída no funil.`,
      })
    } catch (err) {
      console.error('Erro ao adicionar nova etapa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível adicionar a nova etapa.',
      })
    }
  }

  // Exclusão em cascata (mesmo padrão seguro do OpportunityDrawer)
  const handleDeleteOpportunity = async () => {
    if (!dealId) return
    setIsDeleting(true)
    try {
      // 1. Remove atividades vinculadas
      try {
        const ativs = await pb.collection('atividades').getFullList({
          filter: `oportunidade_id = "${dealId}"`,
          sort: '-created',
        })
        for (const at of ativs) {
          try {
            await pb.collection('atividades').delete(at.id)
          } catch (errAtiv) {
            console.warn(`[Atividades] Aviso ao excluir atividade vinculada ${at.id}:`, errAtiv)
          }
        }
      } catch (errListAtiv) {
        console.warn('Aviso ao consultar atividades para pré-exclusão:', errListAtiv)
      }

      // 2. Exclui a oportunidade
      await pb.collection('oportunidades').delete(dealId)

      toast({
        title: 'Oportunidade excluída com sucesso',
        description: 'Registro e suas atividades vinculadas foram removidos da base comercial.',
      })

      setDeleteConfirmOpen(false)
      onOpenChange(false)
      if (onDelete) {
        onDelete(dealId)
      }
    } catch (err: unknown) {
      console.error('Erro ao excluir oportunidade:', err)
      const errObj = err as { data?: { message?: string }; message?: string }
      const errorMsg =
        errObj?.data?.message ||
        errObj?.message ||
        'Não foi possível excluir a oportunidade. Verifique se possui permissão ou se existem outros vínculos pendentes.'
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir oportunidade',
        description: errorMsg,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Submissão do Modal: Salva Pessoa (se nova ou editada) + Salva/Atualiza Negócio + Follow-up
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const finalTitulo = titulo.trim() || 'Novo negócio'

    // Valida formato dos documentos caso informados
    const cleanPersonCpf = onlyDigits(newPersonCpf)
    if (cleanPersonCpf && !isValidCPF(cleanPersonCpf)) {
      setPersonCpfError('CPF inválido (deve conter 11 dígitos e dígitos verificadores válidos)')
      toast({
        variant: 'destructive',
        title: 'CPF inválido',
        description: 'Verifique o número do CPF informado no campo da pessoa.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const activeMarcaId = activeBrand?.id || (marcas[0]?.id ?? '')
      const currentUserId = proprietarioId || user?.id || pb.authStore.record?.id
      const primaryPhone = phones.find((p) => p.number.trim())?.number || ''
      const primaryEmail = emails.find((e) => e.address.trim())?.address || ''

      // Em modo de edição: se houver pessoa vinculada, atualiza contatos
      let finalOrgId = selectedOrgId
      let finalPessoaId = selectedPersonId
      if (
        isEditMode &&
        finalPessoaId &&
        (primaryPhone || primaryEmail || finalOrgId || cleanPersonCpf)
      ) {
        await pb
          .collection('pessoas')
          .update(finalPessoaId, {
            ...(primaryPhone ? { telefone: primaryPhone } : {}),
            ...(primaryEmail ? { email_principal: primaryEmail } : {}),
            ...(finalOrgId ? { organizacao_id: finalOrgId } : {}),
            ...(cleanPersonCpf ? { cpf: cleanPersonCpf } : {}),
          })
          .catch(() => {})
      }

      // 2. Preparação do payload do Negócio / Oportunidade
      const numValor = parseCurrencyToNumber(valor)

      let dataFechamentoIso: string | null = null
      if (dataFechamento) {
        // Aceita DD/MM/AAAA ou AAAA-MM-DD
        let pureDate = dataFechamento.trim()
        if (pureDate.includes('/')) {
          const parts = pureDate.split('/')
          if (parts.length === 3) {
            pureDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
          }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(pureDate)) {
          dataFechamentoIso = `${pureDate} 12:00:00.000Z`
        } else {
          dataFechamentoIso = new Date(dataFechamento).toISOString()
        }
      }

      // 3. Classificação Automática: "Cliente novo" vs "Recompra"
      // Se a pessoa ou organização vinculada tiver negócio ganho anterior -> "Recompra", senão -> "Cliente novo"
      let tipoClienteClassificado: 'Cliente novo' | 'Recompra' = 'Cliente novo'
      const checkFilters: string[] = []
      if (finalOrgId) checkFilters.push(`cliente_b2b_id = "${finalOrgId}"`)
      if (finalPessoaId) checkFilters.push(`cliente_b2c_id = "${finalPessoaId}"`)

      if (checkFilters.length > 0) {
        try {
          const clientFilter = `(${checkFilters.join(' || ')})`
          const deals = await pb.collection('oportunidades').getFullList({
            filter: clientFilter,
            sort: '-created',
          })

          // Pega todos os funis para checar etapas ganhas
          const funisList = await pb
            .collection('funis')
            .getFullList<Funil>()
            .catch(() => [])
          const hasWon = deals.some((d) => {
            const dFunil = funisList.find((f) => f.id === d.funil_id)
            return isWonStage(d.etapa_atual, dFunil?.etapas_ordenadas)
          })
          if (hasWon) {
            tipoClienteClassificado = 'Recompra'
          }
        } catch (e) {
          console.warn('Erro ao verificar histórico para classificação tipo_cliente:', e)
        }
      }

      // Localidade final: se entregaDiferente marcada e possui entrega, usa entrega; senão herda faturamento
      const finalCidadeEntrega =
        (entregaDiferente ? cidadeEntrega.trim() : '') || cidadeFaturamento.trim() || null
      const finalEstadoEntrega =
        (entregaDiferente ? estadoEntrega.trim() : '') || estadoFaturamento.trim() || null
      const finalPaisEntrega =
        (entregaDiferente ? paisEntrega.trim() : '') || paisFaturamento.trim() || 'Brasil'

      let proximaAcaoIso: string | null = null
      if (followUpData && followUpData.trim()) {
        const cleanDate = followUpData.trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
          proximaAcaoIso = `${cleanDate} 12:00:00.000Z`
        } else {
          proximaAcaoIso = new Date(cleanDate).toISOString()
        }
      }

      // Validação de segurança no salvamento de etapa e funil:
      // Identifica o funil alvo e suas etapas válidas
      const targetFunilId = funilId || initialValues?.funil_id || null
      let matchedEtapaRecord = etapasDoFunil.find(
        (e) => (etapaId && e.id === etapaId) || (etapaAtual && e.nome === etapaAtual),
      )

      let resolvedFunilId: string | null = targetFunilId
      let resolvedEtapaId: string | null = null
      let resolvedEtapaAtual: string = ''
      let resolvedIsWon: boolean = false
      let resolvedIsLost: boolean = false

      if (matchedEtapaRecord) {
        resolvedEtapaId = matchedEtapaRecord.id
        resolvedEtapaAtual = matchedEtapaRecord.nome
        resolvedIsWon = Boolean(matchedEtapaRecord.is_won)
        resolvedIsLost = Boolean(matchedEtapaRecord.is_lost)
      } else if (isEditMode) {
        // Modo EDIÇÃO: se não alterou ou não bateu, preserva os originais
        resolvedEtapaId = initialValues?.etapa_id || null
        resolvedEtapaAtual = initialValues?.etapa_atual || ''
        resolvedIsWon = initialValues?.is_won ?? false
        resolvedIsLost = initialValues?.is_lost ?? false
      } else if (etapasDoFunil.length > 0) {
        // Modo CRIAÇÃO: fallback para primeira etapa do funil
        resolvedEtapaId = etapasDoFunil[0].id
        resolvedEtapaAtual = etapasDoFunil[0].nome
        resolvedIsWon = Boolean(etapasDoFunil[0].is_won)
        resolvedIsLost = Boolean(etapasDoFunil[0].is_lost)
      } else {
        resolvedEtapaAtual = etapaAtual || 'Primeiro contato'
      }

      const dealPayload: Record<string, any> = {
        titulo: finalTitulo,
        valor_estimado: numValor,
        marca_id: activeMarcaId,
        cliente_b2b_id: finalOrgId || null,
        cliente_b2c_id: finalPessoaId || null,
        documento_faturamento: documentoFaturamento || null,
        data_fechamento_esperada: dataFechamentoIso,
        tipo_cliente: tipoClienteClassificado,
        vendedor_id: currentUserId,
        origem: canalOrigem || null,
        id_canal_origem: idCanalOrigem.trim() || null,
        observacoes: notaObservacoes.trim() || null,
        cidade: cidadeFaturamento.trim() || null,
        estado: estadoFaturamento.trim() || null,
        pais: paisFaturamento.trim() || 'Brasil',
        cidade_entrega: finalCidadeEntrega,
        estado_entrega: finalEstadoEntrega,
        pais_entrega: finalPaisEntrega,
        proxima_acao_data: proximaAcaoIso,
        proxima_acao_descricao: followUpDesc.trim() || null,
      }

      if (isEditMode && dealId) {
        // MODO EDIÇÃO: Política "não mexeu, não envia"
        // Só incluir funil_id, etapa_id e etapa_atual se o usuário realmente alterou o valor em relação a initialValues
        const initialFunilId = initialValues?.funil_id || null
        const initialEtapaId = initialValues?.etapa_id || null
        const initialEtapaNome = initialValues?.etapa_atual || ''

        const funilMudou = resolvedFunilId !== initialFunilId
        const funilOriginalNaoTinhaValor = !initialFunilId && !!resolvedFunilId

        if (funilMudou || funilOriginalNaoTinhaValor) {
          dealPayload.funil_id = resolvedFunilId
        }

        const etapaIdMudou = resolvedEtapaId !== initialEtapaId
        const etapaNomeMudou = resolvedEtapaAtual !== initialEtapaNome
        const etapaOriginalNaoTinhaValor =
          (!initialEtapaId && !!resolvedEtapaId) || (!initialEtapaNome && !!resolvedEtapaAtual)

        if (etapaIdMudou || etapaNomeMudou || etapaOriginalNaoTinhaValor) {
          if (resolvedEtapaId) dealPayload.etapa_id = resolvedEtapaId
          if (resolvedEtapaAtual) dealPayload.etapa_atual = resolvedEtapaAtual
          dealPayload.is_won = resolvedIsWon
          dealPayload.is_lost = resolvedIsLost
        }

        // Atualiza negócio existente enviando APENAS campos que existem na collection oportunidades
        await pb.collection('oportunidades').update(dealId, dealPayload)

        // No modo edição NÃO cria atividade nova indiscriminadamente:
        // Busca atividade pendente existente vinculada à oportunidade e faz update; create somente se não existir.
        if (proximaAcaoIso) {
          try {
            const ativsPendentes = await pb.collection('atividades').getFullList({
              filter: `oportunidade_id = "${dealId}" && concluida = false`,
              sort: '-created',
            })
            if (ativsPendentes.length > 0) {
              const primeira = ativsPendentes[0]
              await pb.collection('atividades').update(primeira.id, {
                tipo: 'Follow-up',
                descricao:
                  followUpDesc.trim() ||
                  primeira.descricao ||
                  'Follow-up atualizado na edição do negócio',
                data_vencimento: proximaAcaoIso,
                responsavel_id: currentUserId,
              })
            } else {
              await pb.collection('atividades').create({
                oportunidade_id: dealId,
                marca_id: activeMarcaId,
                responsavel_id: currentUserId,
                tipo: 'Follow-up',
                descricao: followUpDesc.trim() || 'Follow-up atualizado na edição do negócio',
                data_vencimento: proximaAcaoIso,
                concluida: false,
              })
            }
          } catch (ativErr) {
            console.warn('Aviso ao gerenciar atividade de follow-up na edição:', ativErr)
          }
        }

        // Se houver novos arquivos selecionados no modo edição, faz o upload vinculado
        if (pendingFiles.length > 0) {
          const uploadErrors: string[] = []
          for (const file of pendingFiles) {
            try {
              await uploadAnexoOportunidade({
                oportunidadeId: dealId,
                marcaId: activeMarcaId,
                file,
                criadoPorId: currentUserId,
              })
            } catch (upErr: any) {
              console.error(`Falha no upload do anexo ${file.name}:`, upErr)
              uploadErrors.push(file.name)
            }
          }

          if (uploadErrors.length === 0) {
            toast({
              title: 'Anexos atualizados',
              description: `${pendingFiles.length} documento(s) anexado(s) com sucesso.`,
            })
          } else {
            toast({
              variant: 'destructive',
              title: 'Aviso sobre anexos',
              description: `${uploadErrors.length} anexo(s) falharam no upload: ${uploadErrors.join(', ')}.`,
            })
          }
        }

        toast({
          title: 'Negócio atualizado com sucesso!',
          description: `"${finalTitulo}" foi atualizado com todas as alterações.`,
        })

        setPendingFiles([])
        onOpenChange(false)
        if (onSuccess) {
          onSuccess(dealId)
        }
      } else {
        // MODO CRIAÇÃO: Executa em transação única no servidor (/backend/v1/negocios/criar-completo)
        // Todo o pacote (organização nova/deduplicada, pessoa nova/deduplicada, oportunidade e follow-up)
        // é processado atomicamente. Se qualquer passo falhar, nenhum registro é salvo.

        const atomicPayload = {
          marca_id: activeMarcaId,
          vendedor_id: currentUserId,
          nova_organizacao:
            isNewOrgCandidate && orgSearch.trim() && !selectedOrgId
              ? {
                  razao_social: orgSearch.trim(),
                  nome_fantasia: orgSearch.trim(),
                  cidade: cidadeFaturamento.trim() || null,
                  estado: estadoFaturamento.trim() || null,
                  pais: paisFaturamento.trim() || 'Brasil',
                  origem_sistema: 'Cadastro via Pipedrive Negócio',
                }
              : null,
          nova_pessoa:
            isNewPersonCandidate && personSearch.trim() && !selectedPersonId
              ? {
                  nome_completo: personSearch.trim(),
                  cpf: cleanPersonCpf || null,
                  telefone: primaryPhone || null,
                  email_principal: primaryEmail || null,
                  cidade: cidadeFaturamento.trim() || null,
                  estado: estadoFaturamento.trim() || null,
                  pais: paisFaturamento.trim() || 'Brasil',
                  origem_sistema: 'Cadastro via Pipedrive Negócio',
                }
              : null,
          atualizar_pessoa_vinculada:
            selectedPersonId && (primaryPhone || primaryEmail)
              ? {
                  telefone: primaryPhone || null,
                  email_principal: primaryEmail || null,
                }
              : null,
          deal: {
            titulo: finalTitulo,
            valor_estimado: numValor,
            funil_id: resolvedFunilId,
            etapa_id: resolvedEtapaId,
            etapa_atual: resolvedEtapaAtual,
            is_won: resolvedIsWon,
            is_lost: resolvedIsLost,
            cliente_b2b_id: selectedOrgId || null,
            cliente_b2c_id: selectedPersonId || null,
            documento_faturamento: documentoFaturamento || null,
            data_fechamento_esperada: dataFechamentoIso,
            tipo_cliente: tipoClienteClassificado,
            origem: canalOrigem,
            id_canal_origem: idCanalOrigem.trim() || null,
            observacoes: notaObservacoes.trim() || null,
            lead_origem_id: leadOrigemId || null,
            cidade: cidadeFaturamento.trim() || null,
            estado: estadoFaturamento.trim() || null,
            pais: paisFaturamento.trim() || 'Brasil',
            cidade_entrega: finalCidadeEntrega,
            estado_entrega: finalEstadoEntrega,
            pais_entrega: finalPaisEntrega,
            status: 'aberto',
          },
          follow_up: {
            tipo: 'Follow-up',
            descricao: followUpDesc.trim() || 'Ação comercial agendada no negócio',
            data_vencimento: proximaAcaoIso || '',
          },
        }

        const res = await pb.send<{
          success: boolean
          oportunidade_id: string
          atividade_id: string
          organizacao_id?: string
          pessoa_id?: string
          org_vinculada_auto?: boolean
          org_vinculada_nome?: string
          pessoa_vinculada_auto?: boolean
          pessoa_vinculada_nome?: string
          message?: string
          error?: string
        }>('/backend/v1/negocios/criar-completo', {
          method: 'POST',
          body: atomicPayload,
        })

        if (!res || !res.success || !res.oportunidade_id) {
          throw new Error(res?.message || 'Falha na resposta do servidor ao criar negócio atômico.')
        }

        // Avisos de deduplicação/vinculação automática caso tenham ocorrido no servidor
        if (res.org_vinculada_auto && res.org_vinculada_nome) {
          toast({
            title: 'Organização vinculada',
            description: `Organização "${res.org_vinculada_nome}" já cadastrada; negócio foi vinculado automaticamente.`,
          })
        }
        if (res.pessoa_vinculada_auto && res.pessoa_vinculada_nome) {
          toast({
            title: 'Pessoa vinculada',
            description: `Pessoa "${res.pessoa_vinculada_nome}" já cadastrada; negócio foi vinculado automaticamente.`,
          })
        }

        toast({
          title: 'Negócio adicionado com sucesso!',
          description: `"${titulo.trim()}" foi criado e vinculado ao funil.`,
        })

        // Se a entidade não tiver cidade/estado, sugere completar na ficha
        if (!cidadeFaturamento.trim() && !estadoFaturamento.trim()) {
          toast({
            title: 'Endereço não informado',
            description:
              'Sugerimos completar a localidade e o endereço diretamente na ficha do cliente.',
          })
        }

        // Se houver arquivos pendentes na criação, realiza upload vinculado ao negócio recém-criado
        if (pendingFiles.length > 0 && res.oportunidade_id) {
          const uploadErrors: string[] = []
          for (const file of pendingFiles) {
            try {
              await uploadAnexoOportunidade({
                oportunidadeId: res.oportunidade_id,
                marcaId: activeMarcaId,
                file,
                criadoPorId: currentUserId,
              })
            } catch (upErr: any) {
              console.error(`Falha no upload do anexo ${file.name}:`, upErr)
              uploadErrors.push(file.name)
            }
          }

          if (uploadErrors.length === 0) {
            toast({
              title: 'Anexos salvos',
              description: `${pendingFiles.length} documento(s) anexado(s) com sucesso ao negócio.`,
            })
          } else {
            toast({
              variant: 'destructive',
              title: 'Aviso sobre anexos',
              description: `O negócio foi criado, mas ${uploadErrors.length} anexo(s) falharam no upload: ${uploadErrors.join(', ')}. Você pode tentar anexá-los novamente pelo painel do negócio.`,
            })
          }
        }

        // Limpa e fecha modal
        setTitulo('')
        setUserEditedTitle(false)
        setValor('')
        setSelectedPersonId(null)
        setPersonSearch('')
        setNewPersonCpf('')
        setPersonCpfError(null)
        setSelectedOrgId(null)
        setOrgSearch('')

        setNotaObservacoes('')
        setPendingFiles([])
        setExistingAnexos([])
        setProprietarioId(user?.id || '')
        setEtapaId('')
        setEtapaAtual('')

        onOpenChange(false)
        if (onSuccess) {
          onSuccess(res.oportunidade_id)
        }
      }
    } catch (err: any) {
      console.error(isEditMode ? 'Erro ao atualizar negócio:' : 'Erro ao adicionar negócio:', err)

      // Extrai mensagens específicas do servidor ou da exceção
      let errorTitle = isEditMode ? 'Erro ao salvar alterações' : 'Erro ao criar negócio'
      let errorDescription = 'Falha inesperada ao salvar. Nenhuma alteração foi gravada.'

      const serverData = err?.data || err?.response?.data || {}
      const serverMessage = serverData?.message || err?.message || ''
      const serverField = serverData?.field || ''
      const serverError = serverData?.error || ''

      // Verificação de erro na trava de follow-up (ValidationError em proxima_acao_data)
      const isTravaFollowUp =
        serverField === 'proxima_acao_data' ||
        serverData?.data?.proxima_acao_data ||
        String(serverMessage).includes('TRAVA DE FOLLOW-UP') ||
        String(err).includes('TRAVA DE FOLLOW-UP')

      if (isTravaFollowUp) {
        errorTitle = 'Trava de Follow-up Ativa'
        errorDescription =
          'Não é permitido alterar ou avançar a oportunidade de etapa sem agendar uma próxima ação com data.'
      } else if (
        serverField === 'cpf' ||
        serverError === 'cpf_duplicado' ||
        serverError === 'cpf_invalido'
      ) {
        setPersonCpfError(serverMessage)
        errorTitle = 'Pessoa já cadastrada'
        errorDescription =
          serverMessage || 'Já existe uma pessoa cadastrada com este CPF no sistema.'
      } else if (serverMessage) {
        errorDescription = serverMessage
      }

      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorDescription,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Funil ativo e etapas disponíveis (da collection etapas_funil com fallback)
  const activeFunil = funis.find((f) => f.id === funilId)
  const currentEtapaIndex = etapasDoFunil.findIndex(
    (e) => (etapaId && e.id === etapaId) || (etapaAtual && e.nome === etapaAtual),
  )

  // Filtros de busca inline para Pessoa e Organização
  const filteredPessoas = pessoas.filter(
    (p) =>
      p.nome_completo.toLowerCase().includes(personSearch.toLowerCase()) ||
      (p.email_principal && p.email_principal.toLowerCase().includes(personSearch.toLowerCase())),
  )

  const filteredOrgs = organizacoes.filter(
    (o) =>
      o.razao_social.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (o.cnpj && o.cnpj.includes(orgSearch)),
  )

  const ownerUser = usersList.find((u) => u.id === proprietarioId) || user

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onPointerDownOutside={(e) => {
            // Bloqueia o fechamento padrão do Radix por pointerdown outside.
            // O fechamento por clique fora é controlado com segurança pelos listeners de
            // mousedown e mouseup globais (só fecha se mousedown E mouseup ocorrerem fora do painel).
            e.preventDefault()
          }}
          onInteractOutside={(e) => {
            // Previne fechamento por interações fora (dropdowns, portais, tooltips, etc.)
            e.preventDefault()
          }}
          className="max-w-4xl p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border border-[#E3E7EB] sm:max-h-[92vh] flex flex-col"
        >
          {/* CABEÇALHO DO MODAL */}
          <DialogHeader className="px-6 py-4 border-b border-[#E3E7EB] flex flex-row items-center justify-between text-left shrink-0">
            <DialogTitle className="text-base font-bold text-slate-900">
              {isEditMode ? 'Editar negócio' : 'Adicionar negócio'}
            </DialogTitle>
          </DialogHeader>

          {/* CORPO DE DUAS COLUNAS */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#E3E7EB] flex-1">
              {/* ======================================================== */}
              {/* PAINEL ESQUERDO (COLUNA PRINCIPAL - md:col-span-7)       */}
              {/* ======================================================== */}
              <div className="md:col-span-7 p-6 space-y-4">
                {/* 1. Pessoa de contato ⓘ */}
                <div className="space-y-1 relative">
                  <div className="flex items-center space-x-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Pessoa de contato
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          avoidCollisions
                          className="text-xs"
                        >
                          Pessoa física responsável ou contato decisor deste negócio.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-2.5 text-slate-400 flex items-center pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                    <Input
                      ref={personInputRef}
                      placeholder=""
                      value={personSearch}
                      onChange={(e) => {
                        const val = e.target.value
                        setPersonSearch(val)
                        setIsNewPersonCandidate(false)
                        setSelectedPersonId(null)
                        const matchingPerson = pessoas.find(
                          (p) => p.nome_completo.trim().toLowerCase() === val.trim().toLowerCase(),
                        )
                        setIsPersonDropdownOpen(!!val.trim() && !matchingPerson)
                      }}
                      className="pl-9 pr-16 h-9 text-xs rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                    />

                    {/* Badge "NOVO" azul no canto do campo estilo captura Pipedrive */}
                    {isNewPersonCandidate && (
                      <span className="absolute right-2 top-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0284C7] text-white tracking-wide">
                        NOVO
                      </span>
                    )}
                  </div>

                  {/* Dropdown de sugestão / criação inline */}
                  {isPersonDropdownOpen && personSearch && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E3E7EB] rounded-xl shadow-lg max-h-48 overflow-y-auto p-1 text-xs">
                      {filteredPessoas.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectPerson(p)}
                          className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-800">{p.nome_completo}</span>
                            {p.email_principal && (
                              <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                                ({p.email_principal})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Botão "+ Adicionar como nova pessoa" com badge NOVO */}
                      <div
                        onClick={handleCreateNewPersonCandidate}
                        className="p-2 mt-1 border-t border-slate-100 hover:bg-blue-50/70 rounded-lg cursor-pointer flex items-center justify-between text-[#0284C7] font-bold"
                      >
                        <div className="flex items-center space-x-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar "{personSearch.trim()}"</span>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#0284C7] text-white">
                          NOVO
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Organização ⓘ */}
                <div className="space-y-1 relative">
                  <div className="flex items-center space-x-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Organização</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          avoidCollisions
                          className="text-xs"
                        >
                          Empresa ou entidade B2B à qual este negócio está vinculado.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-2.5 text-slate-400 flex items-center pointer-events-none">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <Input
                      ref={orgInputRef}
                      placeholder=""
                      value={orgSearch}
                      onChange={(e) => {
                        setOrgSearch(e.target.value)
                        setIsNewOrgCandidate(false)
                        setSelectedOrgId(null)
                        setIsOrgDropdownOpen(true)
                      }}
                      onFocus={() => setIsOrgDropdownOpen(true)}
                      className="pl-9 pr-16 h-9 text-xs rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                    />

                    {/* Badge "NOVO" azul no canto do campo estilo captura Pipedrive */}
                    {isNewOrgCandidate && (
                      <span className="absolute right-2 top-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0284C7] text-white tracking-wide">
                        NOVO
                      </span>
                    )}
                  </div>

                  {/* Dropdown de organizações com opção "+ Adicionar [nome]" com badge NOVO */}
                  {isOrgDropdownOpen && orgSearch && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E3E7EB] rounded-xl shadow-lg max-h-48 overflow-y-auto p-1 text-xs">
                      {filteredOrgs.map((o) => (
                        <div
                          key={o.id}
                          onClick={() => handleSelectOrg(o)}
                          className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-800">{o.razao_social}</span>
                          </div>
                          {o.cnpj && (
                            <span className="text-[10px] font-mono text-slate-400">{o.cnpj}</span>
                          )}
                        </div>
                      ))}

                      {/* Botão "+ Adicionar [nome]" com badge NOVO */}
                      <div
                        onClick={handleCreateNewOrgCandidate}
                        className="p-2 mt-1 border-t border-slate-100 hover:bg-blue-50/70 rounded-lg cursor-pointer flex items-center justify-between text-[#0284C7] font-bold"
                      >
                        <div className="flex items-center space-x-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar "{orgSearch.trim()}"</span>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#0284C7] text-white">
                          NOVO
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Título */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Título{' '}
                    <span className="text-[11px] font-normal text-slate-400">(opcional)</span>
                  </Label>
                  <Input
                    value={titulo}
                    onChange={(e) => {
                      setTitulo(e.target.value)
                      setUserEditedTitle(true)
                    }}
                    placeholder="ex: Carlos Müller ou Fornecimento Pier (opcional)"
                    className="h-9 text-xs rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                  />
                </div>

                {/* 4. Valor ⓘ + Moeda + Adicionar produtos */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Valor</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          avoidCollisions
                          className="text-xs"
                        >
                          Valor total estimado desta oportunidade na moeda de faturamento.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-7">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={valor}
                        onChange={(e) => setValor(maskCurrency(e.target.value))}
                        className="h-9 text-xs rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                      />
                    </div>
                    <div className="col-span-5">
                      <Select
                        value={moeda}
                        onValueChange={(v) => setMoeda(v as 'BRL' | 'USD' | 'EUR')}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-lg border-[#D5DBDB] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="BRL">Brazilian Rea... (BRL)</SelectItem>
                          <SelectItem value="USD">US Dollar (USD)</SelectItem>
                          <SelectItem value="EUR">Euro (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Bloco discreto: Local de entrega (opcional) & Faturamento */}
                <div className="p-3 bg-slate-50 border border-[#E3E7EB] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-[#017848]" />
                      <span>Localidade de Faturamento e Entrega</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const proximo = !entregaDiferente
                        setEntregaDiferente(proximo)
                        if (!proximo) {
                          setCidadeEntrega(cidadeFaturamento)
                          setEstadoEntrega(estadoFaturamento)
                          setPaisEntrega(paisFaturamento)
                        }
                      }}
                      className="text-[11px] text-[#0284C7] hover:underline font-semibold"
                    >
                      {entregaDiferente ? 'Entrega no mesmo local' : 'Local de entrega diferente?'}
                    </button>
                  </div>

                  {/* Localidade de Faturamento pré-preenchida da entidade */}
                  <div>
                    <GeoSelector
                      idPrefix="fat"
                      paisLabel="País (Faturamento)"
                      cidadeLabel="Cidade (Faturamento)"
                      estadoLabel="UF"
                      cidade={cidadeFaturamento}
                      estado={estadoFaturamento}
                      pais={paisFaturamento}
                      onChange={(geo) => {
                        setCidadeFaturamento(geo.cidade)
                        setEstadoFaturamento(geo.estado)
                        setPaisFaturamento(geo.pais)
                        if (!entregaDiferente) {
                          setCidadeEntrega(geo.cidade)
                          setEstadoEntrega(geo.estado)
                          setPaisEntrega(geo.pais)
                        }
                      }}
                    />
                  </div>

                  {/* Local de Entrega diferente (opcional) */}
                  {entregaDiferente && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                          Local de entrega (opcional)
                        </span>
                      </div>
                      <GeoSelector
                        idPrefix="ent"
                        paisLabel="País de Entrega"
                        cidadeLabel="Cidade de Entrega"
                        estadoLabel="UF de Entrega"
                        cidade={cidadeEntrega}
                        estado={estadoEntrega}
                        pais={paisEntrega}
                        onChange={(geo) => {
                          setCidadeEntrega(geo.cidade)
                          setEstadoEntrega(geo.estado)
                          setPaisEntrega(geo.pais)
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 5. Funil — Linha dedicada com largura plena */}
                <div className="space-y-1 w-full">
                  <Label className="text-xs font-semibold text-slate-700">Funil</Label>
                  <Select value={funilId} onValueChange={setFunilId}>
                    <SelectTrigger className="h-9 w-full text-xs rounded-lg border-[#D5DBDB] bg-white">
                      <SelectValue placeholder="Selecione o funil..." />
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

                {/* 6. Etapa do funil — Linha dedicada abaixo, largura plena, sem rolagem horizontal (flex-wrap) */}
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Etapa do funil</Label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsAddingNewEtapa(!isAddingNewEtapa)}
                        className="text-xs text-[#0284C7] hover:underline font-semibold"
                      >
                        + Adicionar nova etapa
                      </button>
                    )}
                  </div>

                  {/* Seletor de etapas estilo Pipedrive em flex-wrap com base nas etapas do funil por ID */}
                  {etapasDoFunil.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 py-1 w-full">
                      {etapasDoFunil.map((et, idx) => {
                        const isActive = currentEtapaIndex >= 0 ? idx <= currentEtapaIndex : false
                        const isCurrent = (etapaId && et.id === etapaId) || et.nome === etapaAtual
                        return (
                          <button
                            key={et.id || et.nome}
                            type="button"
                            onClick={() => {
                              setEtapaId(et.id)
                              setEtapaAtual(et.nome)
                            }}
                            title={et.nome}
                            className={cn(
                              'relative h-7 px-2.5 text-[11px] font-bold transition-all flex items-center justify-center rounded-md',
                              isActive
                                ? 'bg-[#017848] text-white shadow-xs'
                                : 'bg-[#E5E9EC] text-slate-600 hover:bg-slate-300',
                              isCurrent && 'ring-2 ring-offset-1 ring-[#017848]',
                            )}
                          >
                            <span className="truncate max-w-[140px]">{et.nome}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Input inline para adicionar nova etapa (somente Admin) */}
                  {isAdmin && isAddingNewEtapa && (
                    <div className="flex items-center space-x-2 pt-1 w-full">
                      <Input
                        placeholder="Nome da nova etapa..."
                        value={novaEtapaNome}
                        onChange={(e) => setNovaEtapaNome(e.target.value)}
                        className="h-8 text-xs rounded-lg flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveNewEtapa}
                        className="h-8 text-xs bg-[#017848] hover:bg-[#01653c] text-white font-bold"
                      >
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAddingNewEtapa(false)}
                        className="h-8 text-xs text-slate-500"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>

                {/* 7. Data de fechamento esperada ⓘ */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Data de fechamento esperada
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          avoidCollisions
                          className="text-xs"
                        >
                          Previsão de assinatura de contrato ou efetivação do pedido.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    type="date"
                    value={dataFechamento}
                    onChange={(e) => setDataFechamento(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="h-9 text-xs rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                  />
                </div>

                {/* Documento Fiscal para Fechamento (obrigatório do NTC) */}
                <div className="space-y-1 p-2.5 bg-slate-50 border border-[#E3E7EB] rounded-xl">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Documento Fiscal de Faturamento
                  </Label>
                  <Select
                    value={documentoFaturamento}
                    onValueChange={(v) => setDocumentoFaturamento(v as 'CPF' | 'CNPJ' | 'AMBOS')}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-[#D5DBDB]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="CNPJ">Emitir por CNPJ (Organização)</SelectItem>
                      <SelectItem value="CPF">Emitir por CPF (Pessoa Física)</SelectItem>
                      <SelectItem value="AMBOS">Referenciar Ambos no Faturamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 8. Proprietário */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Proprietário</Label>
                  <Select value={proprietarioId} onValueChange={setProprietarioId}>
                    <SelectTrigger className="h-9 text-xs rounded-lg border-[#D5DBDB] bg-white">
                      <SelectValue placeholder="Selecione o proprietário..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {usersList.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email} {u.id === user?.id ? '(Você)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 9. Canal de origem */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Canal de origem</Label>
                  <Select value={canalOrigem} onValueChange={setCanalOrigem}>
                    <SelectTrigger className="h-9 text-xs rounded-lg border-[#D5DBDB] bg-white">
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

                {/* 10. Próxima ação — ÚLTIMO item do formulário, estilo padrão de input, sem bloco destacado/alerta */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5 text-slate-700 text-xs font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Próxima ação</span>
                    <span className="text-slate-400 font-normal text-[11px]">(opcional)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] font-medium text-slate-600">
                        Data da próxima ação
                      </Label>
                      <Input
                        type="date"
                        value={followUpData}
                        onChange={(e) => setFollowUpData(e.target.value)}
                        className="h-9 text-xs bg-white rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-slate-600">
                        Descrição da ação
                      </Label>
                      <Input
                        value={followUpDesc}
                        onChange={(e) => setFollowUpDesc(e.target.value)}
                        placeholder="ex: Contato comercial (opcional)"
                        className="h-9 text-xs bg-white rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* PAINEL DIREITO: "PESSOA" (md:col-span-5)                 */}
              {/* ======================================================== */}
              <div className="md:col-span-5 p-6 bg-slate-50/50 space-y-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-[#E3E7EB] pb-2">
                  Pessoa
                </div>

                {/* CPF da Pessoa (Opcional) */}

                {/* 1. Telefone + dropdown de tipo ("Comercial") + "+ Adicionar telefone" */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Telefone</Label>

                  {phones.map((phone, idx) => (
                    <div key={phone.id} className="flex items-center space-x-1.5">
                      <div className="flex-1">
                        <Input
                          placeholder="(00) 00000-0000"
                          value={phone.number}
                          onChange={(e) => handleUpdatePhone(phone.id, e.target.value)}
                          className="h-9 text-xs bg-white rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                        />
                      </div>
                      <div className="w-32">
                        <Select
                          value={phone.tipo}
                          onValueChange={(val) =>
                            handleUpdatePhone(phone.id, phone.number, val as PhoneEntry['tipo'])
                          }
                        >
                          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-[#D5DBDB]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Comercial">Comercial</SelectItem>
                            <SelectItem value="Celular">Celular</SelectItem>
                            <SelectItem value="Trabalho">Trabalho</SelectItem>
                            <SelectItem value="Casa">Casa</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhone(phone.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Link azul "+ Adicionar telefone" */}
                  <div>
                    <button
                      type="button"
                      onClick={handleAddPhone}
                      className="text-xs text-[#0284C7] hover:underline font-semibold"
                    >
                      + Adicionar telefone
                    </button>
                  </div>
                </div>

                {/* 2. E-mail + dropdown de tipo ("Comercial") + "+ Adicionar e-mail" */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">E-mail</Label>

                  {emails.map((email) => (
                    <div key={email.id} className="flex items-center space-x-1.5">
                      <div className="flex-1">
                        <Input
                          type="email"
                          placeholder="contato@exemplo.com.br"
                          value={email.address}
                          onChange={(e) => handleUpdateEmail(email.id, e.target.value)}
                          className="h-9 text-xs bg-white rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                        />
                      </div>
                      <div className="w-32">
                        <Select
                          value={email.tipo}
                          onValueChange={(val) =>
                            handleUpdateEmail(email.id, email.address, val as EmailEntry['tipo'])
                          }
                        >
                          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-[#D5DBDB]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Comercial">Comercial</SelectItem>
                            <SelectItem value="Trabalho">Trabalho</SelectItem>
                            <SelectItem value="Pessoal">Pessoal</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Link azul "+ Adicionar e-mail" */}
                  <div>
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="text-xs text-[#0284C7] hover:underline font-semibold"
                    >
                      + Adicionar e-mail
                    </button>
                  </div>
                </div>

                {/* Campo expansível de Nota/Observação */}
                <div className="pt-3 border-t border-[#E3E7EB]">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Anotações do negócio
                    </Label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {notaObservacoes.length}/15.000
                    </span>
                  </div>
                  <Textarea
                    placeholder="Escreva detalhes técnicos, condições de entrega ou histórico prévio..."
                    value={notaObservacoes}
                    maxLength={15000}
                    onChange={(e) => setNotaObservacoes(e.target.value)}
                    className="text-xs bg-white rounded-lg border-[#D5DBDB] min-h-[90px]"
                  />
                </div>

                {/* Campo Anexos (opcional) */}
                <div className="pt-3 border-t border-[#E3E7EB] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Anexos</Label>
                      <span className="text-[10px] text-slate-400 font-normal">(opcional)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      PDF, imagens, DOCX, XLSX (até 50MB)
                    </span>
                  </div>

                  {/* Input invisível para seleção de múltiplos arquivos */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleSelectFiles}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  />

                  {/* Área de arrastar / botão de anexar */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 border-2 border-dashed border-[#D5DBDB] hover:border-[#1B4F72] hover:bg-slate-50/60 rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-2 text-xs text-slate-600"
                  >
                    <Paperclip className="w-4 h-4 text-[#1B4F72]" />
                    <span className="font-semibold text-slate-700">
                      Clique para escolher ou anexar documentos
                    </span>
                  </div>

                  {/* Lista de anexos existentes (modo edição) */}
                  {isEditMode && existingAnexos.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Anexos Salvos ({existingAnexos.length})
                      </p>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {existingAnexos.map((anx) => (
                          <div
                            key={anx.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                          >
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              <FileText className="w-3.5 h-3.5 text-[#1B4F72] shrink-0" />
                              <a
                                href={getAnexoFileUrl(anx, { download: true })}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-slate-800 hover:text-[#1B4F72] hover:underline truncate"
                                title={anx.nome_original || anx.arquivo}
                              >
                                {anx.nome_original || anx.arquivo}
                              </a>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({formatFileSize(anx.tamanho)})
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletingAnexoId === anx.id}
                              onClick={() => handleDeleteExistingAnexo(anx.id)}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 ml-1 shrink-0"
                              title="Remover anexo salvo"
                            >
                              {deletingAnexoId === anx.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lista de novos arquivos selecionados (pendentes de salvar) */}
                  {pendingFiles.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#017848]">
                        Novos Arquivos para Upload ({pendingFiles.length})
                      </p>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {pendingFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs"
                          >
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span className="font-medium text-emerald-900 truncate">
                                {file.name}
                              </span>
                              <span className="text-[10px] text-emerald-600 shrink-0">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePendingFile(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded-md shrink-0"
                              title="Remover da lista de upload"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* RODAPÉ DO MODAL (ESTILO PIPEDRIVE)                       */}
            {/* ======================================================== */}
            <div className="px-6 py-3.5 bg-white border-t border-[#E3E7EB] flex items-center justify-between shrink-0">
              {/* Lado esquerdo: Botão Excluir (modo edição, afastado do X) ou Link Importação (criação) */}
              {isEditMode && dealId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="h-9 px-3 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center space-x-1.5 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Excluir negócio</span>
                </Button>
              ) : (
                <a
                  href="/importacao"
                  className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Importação</span>
                </a>
              )}

              {/* Lado direito: Contador 0/15.000 ⓘ + Cancelar + Salvar (verde primário #017848) */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1 text-xs text-slate-500">
                  <span className="font-mono">{notaObservacoes.length}/15.000</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" avoidCollisions className="text-xs">
                        Limite de caracteres para notas e histórico do negócio.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-9 px-4 text-xs font-semibold rounded-lg border-[#D5DBDB] text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || isLoadingMasterData}
                  className="h-9 px-5 text-xs font-bold rounded-lg bg-[#017848] hover:bg-[#01653c] text-white shadow-sm flex items-center space-x-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>{isEditMode ? 'Salvando...' : 'Criando...'}</span>
                    </>
                  ) : isLoadingMasterData ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>Carregando...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? 'Salvar alterações' : 'Salvar'}</span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CONFIRMAÇÃO: EXCLUIR OPORTUNIDADE (REPLICADO DO DRAWER) */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Excluir Oportunidade?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir esta oportunidade? As atividades vinculadas a este
              negócio também serão removidas. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteConfirmOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteOpportunity}
              className="text-xs bg-red-600 hover:bg-red-700 font-bold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AddDealModal
