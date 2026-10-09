import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { maskPhone, maskCNPJ, maskCPF, isValidCNPJ, isValidCPF, onlyDigits } from '@/lib/formatters'
import { maskCurrency, parseCurrencyToNumber, formatCurrencyString } from '@/lib/currencyMask'
import type { Funil, ClienteB2B, ClienteB2C, EtapaItem, EtapaConfig } from '@/types'
import { getEtapaNome, isWonStage } from '@/lib/relationshipStatus'
import { extrairCidadeEstado, ESTADOS_BRASIL } from '@/lib/geoUtils'
import { GeoSelector } from './GeoSelector'

export interface AddDealModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (dealId: string) => void
  defaultFunilId?: string
  defaultEtapaNome?: string
  mode?: 'create' | 'edit'
  dealId?: string
  initialValues?: {
    titulo?: string
    valor?: number | string
    etapa_atual?: string
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
  defaultFunilId,
  defaultEtapaNome,
  mode = 'create',
  dealId,
  initialValues,
}) => {
  const isEditMode = mode === 'edit' || !!dealId
  const { activeBrand, marcas } = useBrand()
  const { user, isAdmin } = useAuth()
  const mouseDownOutsideRef = useRef(false)

  // Listas de dados mestre
  const [funis, setFunis] = useState<Funil[]>([])
  const [pessoas, setPessoas] = useState<ClienteB2C[]>([])
  const [organizacoes, setOrganizacoes] = useState<ClienteB2B[]>([])
  const [usersList, setUsersList] = useState<{ id: string; name?: string; email: string }[]>([])
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
  const [newOrgCnpj, setNewOrgCnpj] = useState('')
  const [isNewOrgCandidate, setIsNewOrgCandidate] = useState(false)
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false)
  const orgInputRef = useRef<HTMLInputElement>(null)

  // Erros de validação inline de documentos
  const [orgCnpjError, setOrgCnpjError] = useState<string | null>(null)
  const [personCpfError, setPersonCpfError] = useState<string | null>(null)

  // 3. Título
  const [titulo, setTitulo] = useState('')
  const [userEditedTitle, setUserEditedTitle] = useState(false)

  // 4. Valor + Moeda
  const [valor, setValor] = useState<string>('')
  const [moeda, setMoeda] = useState<'BRL' | 'USD' | 'EUR'>('BRL')

  // 5. Funil
  const [funilId, setFunilId] = useState<string>('')

  // 6. Etapa do funil (chevrons verdes + adicionar nova etapa)
  const [etapaAtual, setEtapaAtual] = useState<string>('')
  const [isAddingNewEtapa, setIsAddingNewEtapa] = useState(false)
  const [novaEtapaNome, setNovaEtapaNome] = useState('')

  // Etiqueta
  const [etiqueta, setEtiqueta] = useState<string>('nenhuma')

  // 7. Data de fechamento esperada (DD/MM/AAAA)
  const [dataFechamento, setDataFechamento] = useState<string>('')

  // Documento fiscal para faturamento (CPF / CNPJ / AMBOS)
  const [documentoFaturamento, setDocumentoFaturamento] = useState<'CPF' | 'CNPJ' | 'AMBOS'>('CNPJ')

  // Trava de follow-up obrigatória
  const [followUpData, setFollowUpData] = useState<string>(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
  )
  const [followUpDesc, setFollowUpDesc] = useState<string>('Primeiro alinhamento comercial')

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

        // Preenche com initialValues se fornecido (ex: Recompra, Duplicar ou Edição)
        const targetFunilId = initialValues?.funil_id || defaultFunilId
        const initialFunil = funisRes.find((f) => f.id === targetFunilId) || funisRes[0] || null
        const requestedEtapa = initialValues?.etapa_atual || defaultEtapaNome

        if (initialFunil) {
          setFunilId(initialFunil.id)
          const etapasList = initialFunil.etapas_ordenadas || []
          const nomesEtapas = etapasList.map(getEtapaNome)

          if (requestedEtapa && nomesEtapas.includes(requestedEtapa)) {
            setEtapaAtual(requestedEtapa)
          } else if (isEditMode && initialValues?.etapa_atual) {
            // Em modo edição: nunca sobrescreve com fallback se houver etapa original
            setEtapaAtual(initialValues.etapa_atual)
          } else if (etapasList.length > 0) {
            setEtapaAtual(nomesEtapas[0])
          }
        } else if (isEditMode && initialValues?.etapa_atual) {
          setEtapaAtual(initialValues.etapa_atual)
        }

        if (initialValues?.vendedor_id) {
          setProprietarioId(initialValues.vendedor_id)
        } else if (user?.id) {
          setProprietarioId((prev) => prev || user.id)
        }

        if (initialValues) {
          if (initialValues.titulo) {
            setTitulo(initialValues.titulo)
            setUserEditedTitle(true)
          }
          if (
            initialValues.valor !== undefined &&
            initialValues.valor !== null &&
            initialValues.valor !== ''
          ) {
            // Formata o valor inicial com separadores e centavos se for numérico ou com casas decimais
            const num =
              typeof initialValues.valor === 'number'
                ? initialValues.valor
                : parseFloat(String(initialValues.valor).replace(',', '.'))
            if (!isNaN(num) && num > 0) {
              setValor(formatCurrencyString(num))
            } else if (typeof initialValues.valor === 'string' && initialValues.valor.trim()) {
              setValor(maskCurrency(initialValues.valor))
            } else {
              setValor('')
            }
          }
          if (initialValues.documento_faturamento) {
            setDocumentoFaturamento(initialValues.documento_faturamento)
          }
          if (initialValues.observacoes) {
            setNotaObservacoes(initialValues.observacoes)
          }
          if (initialValues.origem) {
            setCanalOrigem(initialValues.origem)
          }
          if (initialValues.id_canal_origem) {
            setIdCanalOrigem(initialValues.id_canal_origem)
          }
          if (initialValues.lead_origem_id) {
            setLeadOrigemId(initialValues.lead_origem_id)
          }

          if (initialValues.cidade) {
            setCidadeFaturamento(initialValues.cidade)
          }
          if (initialValues.estado) {
            setEstadoFaturamento(initialValues.estado)
          }
          if (initialValues.pais) {
            setPaisFaturamento(initialValues.pais)
          }

          // Checa se há entrega preenchida ou diferente de faturamento
          const temEntregaInformada = !!(
            initialValues.cidade_entrega ||
            initialValues.estado_entrega ||
            (initialValues.pais_entrega && initialValues.pais_entrega !== 'Brasil')
          )
          const entregaDiferenteDeFaturamento =
            (initialValues.cidade_entrega &&
              initialValues.cidade_entrega !== initialValues.cidade) ||
            (initialValues.estado_entrega &&
              initialValues.estado_entrega !== initialValues.estado) ||
            (initialValues.pais_entrega && initialValues.pais_entrega !== initialValues.pais)

          if (initialValues.cidade_entrega) {
            setCidadeEntrega(initialValues.cidade_entrega)
          }
          if (initialValues.estado_entrega) {
            setEstadoEntrega(initialValues.estado_entrega)
          }
          if (initialValues.pais_entrega) {
            setPaisEntrega(initialValues.pais_entrega)
          }

          if (temEntregaInformada && entregaDiferenteDeFaturamento) {
            setEntregaDiferente(true)
          } else {
            setEntregaDiferente(false)
          }

          if (initialValues.proxima_acao_data) {
            setFollowUpData(initialValues.proxima_acao_data.split('T')[0])
          }
          if (initialValues.proxima_acao_descricao) {
            setFollowUpDesc(initialValues.proxima_acao_descricao)
          }
          if (initialValues.data_fechamento_esperada) {
            setDataFechamento(initialValues.data_fechamento_esperada.split('T')[0])
          }

          const targetOrgId = initialValues.cliente_b2b_id || initialValues.organizacao_id
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

          const targetPessoaId = initialValues.cliente_b2c_id || initialValues.pessoa_id
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
  }, [open, activeBrand, defaultFunilId, defaultEtapaNome, user?.id, initialValues])

  // Garante que o proprietário sempre venha preenchido com o usuário logado ao abrir o modal
  useEffect(() => {
    if (open && user?.id && !proprietarioId) {
      setProprietarioId(user.id)
    }
  }, [open, user?.id, proprietarioId])

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

  // Quando o funil muda, atualiza a etapa atual
  useEffect(() => {
    if (!funilId) return
    const f = funis.find((x) => x.id === funilId)
    if (f && f.etapas_ordenadas && f.etapas_ordenadas.length > 0) {
      const nomes = f.etapas_ordenadas.map(getEtapaNome)
      if (!nomes.includes(etapaAtual)) {
        // Em modo de edição, se o funil ativo corresponder ao funil original e houver etapa original válida nele, preserva-a
        if (
          isEditMode &&
          initialValues?.etapa_atual &&
          nomes.includes(initialValues.etapa_atual) &&
          (!initialValues.funil_id || initialValues.funil_id === funilId)
        ) {
          setEtapaAtual(initialValues.etapa_atual)
        } else {
          setEtapaAtual(nomes[0])
        }
      }
    }
  }, [funilId, funis, isEditMode, initialValues])

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
    setNewOrgCnpj(o.cnpj || '')
    setOrgCnpjError(null)
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

  // Adicionar nova etapa inline ao funil ativo mantendo compatibilidade com EtapaConfig
  const handleSaveNewEtapa = async () => {
    if (!novaEtapaNome.trim() || !funilId) return
    const activeF = funis.find((f) => f.id === funilId)
    if (!activeF) return

    const novaEtapaObj: EtapaConfig = {
      nome: novaEtapaNome.trim(),
      valor_referencia: 0,
      is_won: false,
      is_lost: false,
    }
    const novasEtapas: EtapaItem[] = [...(activeF.etapas_ordenadas || []), novaEtapaObj]
    try {
      await pb.collection('funis').update(activeF.id, {
        etapas_ordenadas: novasEtapas,
      })
      activeF.etapas_ordenadas = novasEtapas
      setEtapaAtual(novaEtapaNome.trim())
      setNovaEtapaNome('')
      setIsAddingNewEtapa(false)
      toast({
        title: 'Etapa adicionada!',
        description: `A etapa "${novaEtapaNome.trim()}" foi incluída no funil.`,
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

  // Submissão do Modal: Salva Pessoa (se nova ou editada) + Salva/Atualiza Negócio + Follow-up
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const finalTitulo = titulo.trim() || 'Novo negócio'

    // Valida formato dos documentos caso informados
    const cleanOrgCnpj = onlyDigits(newOrgCnpj)
    if (cleanOrgCnpj && !isValidCNPJ(cleanOrgCnpj)) {
      setOrgCnpjError('CNPJ inválido (deve conter 14 dígitos e dígitos verificadores válidos)')
      toast({
        variant: 'destructive',
        title: 'CNPJ inválido',
        description: 'Verifique o número do CNPJ informado no campo da organização.',
      })
      return
    }

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
        if (dataFechamento.includes('/')) {
          const parts = dataFechamento.split('/')
          if (parts.length === 3) {
            dataFechamentoIso = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString()
          }
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

      const proximaAcaoIso = followUpData ? new Date(followUpData).toISOString() : null

      // Validação de segurança no salvamento de etapa e funil:
      // Identifica o funil alvo e suas etapas válidas
      const targetFunilObj = funis.find((f) => f.id === (funilId || initialValues?.funil_id))
      const targetEtapasNomes = (targetFunilObj?.etapas_ordenadas || []).map(getEtapaNome)

      let resolvedFunilId: string | null = funilId || initialValues?.funil_id || null
      let resolvedEtapaAtual: string

      if (isEditMode) {
        // Ponto 1 e 3: Modo edição - etapa e funil nunca caem em fallback genérico.
        // Se a etapa local estiver vazia ou não pertencer ao funil alvo, restaura a etapa original de initialValues.
        const originalEtapa = initialValues?.etapa_atual || ''
        const candidateEtapa = etapaAtual.trim()

        if (
          candidateEtapa &&
          (targetEtapasNomes.length === 0 || targetEtapasNomes.includes(candidateEtapa))
        ) {
          resolvedEtapaAtual = candidateEtapa
        } else if (originalEtapa) {
          resolvedEtapaAtual = originalEtapa
        } else if (targetEtapasNomes.length > 0) {
          resolvedEtapaAtual = targetEtapasNomes[0]
        } else {
          resolvedEtapaAtual = candidateEtapa || 'Negociação'
        }
      } else {
        // Modo CRIAÇÃO: se etapaAtual vazia ou não pertencer ao funil alvo, usa primeira etapa do funil (ou fallback)
        if (
          etapaAtual &&
          (targetEtapasNomes.length === 0 || targetEtapasNomes.includes(etapaAtual))
        ) {
          resolvedEtapaAtual = etapaAtual
        } else if (targetEtapasNomes.length > 0) {
          resolvedEtapaAtual = targetEtapasNomes[0]
        } else {
          resolvedEtapaAtual = etapaAtual || 'Primeiro contato'
        }
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
        // Só incluir funil_id e etapa_atual se o usuário realmente alterou o valor em relação a initialValues (ou se o banco não tinha valor)
        const initialFunilId = initialValues?.funil_id || null
        const initialEtapa = initialValues?.etapa_atual || ''

        const funilMudou = resolvedFunilId !== initialFunilId
        const funilOriginalNaoTinhaValor = !initialFunilId && !!resolvedFunilId

        if (funilMudou || funilOriginalNaoTinhaValor) {
          dealPayload.funil_id = resolvedFunilId
        }

        const etapaMudou = resolvedEtapaAtual !== initialEtapa
        const etapaOriginalNaoTinhaValor = !initialEtapa && !!resolvedEtapaAtual

        if (etapaMudou || etapaOriginalNaoTinhaValor) {
          dealPayload.etapa_atual = resolvedEtapaAtual
        }

        // Atualiza negócio existente enviando APENAS campos que existem na collection oportunidades
        await pb.collection('oportunidades').update(dealId, dealPayload)

        // Cria ou atualiza atividade de follow-up associada (se informada data)
        if (proximaAcaoIso) {
          try {
            await pb.collection('atividades').create({
              oportunidade_id: dealId,
              marca_id: activeMarcaId,
              responsavel_id: currentUserId,
              tipo: 'Follow-up',
              descricao: followUpDesc.trim() || 'Follow-up atualizado na edição do negócio',
              data_vencimento: proximaAcaoIso,
              concluida: false,
            })
          } catch (ativErr) {
            console.warn('Aviso ao registrar atividade de follow-up na edição:', ativErr)
          }
        }

        toast({
          title: 'Negócio atualizado com sucesso!',
          description: `"${finalTitulo}" foi atualizado com todas as alterações.`,
        })

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
                  cnpj: cleanOrgCnpj || null,
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
            etapa_atual: resolvedEtapaAtual,
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
        setNewOrgCnpj('')
        setOrgCnpjError(null)
        setNotaObservacoes('')
        setProprietarioId(user?.id || '')

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
        serverField === 'cnpj' ||
        serverError === 'cnpj_duplicado' ||
        serverError === 'cnpj_invalido'
      ) {
        setOrgCnpjError(serverMessage)
        errorTitle = 'Organização já cadastrada'
        errorDescription =
          serverMessage || 'Já existe uma organização cadastrada com este CNPJ no sistema.'
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

  // Funil ativo e suas etapas normalizadas para string
  const activeFunil = funis.find((f) => f.id === funilId)
  const etapasList = (activeFunil?.etapas_ordenadas || []).map(getEtapaNome)
  const currentEtapaIndex = etapasList.indexOf(etapaAtual)

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
                  <Label className="text-xs font-semibold text-slate-700">Pessoa de contato</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" avoidCollisions className="text-xs">
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
                      setPersonSearch(e.target.value)
                      setIsNewPersonCandidate(false)
                      setSelectedPersonId(null)
                      setIsPersonDropdownOpen(true)
                    }}
                    onFocus={() => setIsPersonDropdownOpen(true)}
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
                      <TooltipContent side="top" align="start" avoidCollisions className="text-xs">
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

              {/* Campo opcional de CNPJ para a Organização (exibido quando selecionada ou em criação) */}
              {(isNewOrgCandidate || selectedOrgId || orgSearch.trim()) && (
                <div className="space-y-1 pl-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-medium text-slate-600">
                      CNPJ da Organização{' '}
                      <span className="text-slate-400 font-normal">(opcional)</span>
                    </Label>
                  </div>
                  <Input
                    placeholder="00.000.000/0000-00 (opcional)"
                    value={newOrgCnpj}
                    onChange={(e) => {
                      const masked = maskCNPJ(e.target.value)
                      setNewOrgCnpj(masked)
                      const digits = onlyDigits(masked)
                      if (!digits || isValidCNPJ(digits)) {
                        setOrgCnpjError(null)
                      } else if (digits.length === 14) {
                        setOrgCnpjError('CNPJ inválido (verifique os números)')
                      }
                    }}
                    onBlur={() => {
                      const digits = onlyDigits(newOrgCnpj)
                      if (digits && !isValidCNPJ(digits)) {
                        setOrgCnpjError('CNPJ inválido (deve conter 14 dígitos válidos)')
                      } else {
                        setOrgCnpjError(null)
                      }
                    }}
                    className={cn(
                      'h-8 text-xs rounded-lg border-[#D5DBDB] bg-slate-50/50',
                      orgCnpjError && 'border-red-500 focus:border-red-500 bg-red-50/20',
                    )}
                  />
                  {orgCnpjError && (
                    <p className="text-[11px] font-semibold text-red-600 mt-0.5">{orgCnpjError}</p>
                  )}
                </div>
              )}

              {/* 3. Título */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Título <span className="text-[11px] font-normal text-slate-400">(opcional)</span>
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
                      <TooltipContent side="top" align="start" avoidCollisions className="text-xs">
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

                {/* Link azul "Adicionar produtos" */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      toast({
                        title: 'Catálogo de Produtos NTC',
                        description: 'O valor estimado foi habilitado para cálculo por itens.',
                      })
                    }}
                    className="text-xs text-[#0284C7] hover:underline font-semibold"
                  >
                    Adicionar produtos
                  </button>
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

                {/* Seletor de etapas estilo Pipedrive em flex-wrap para não exigir rolagem horizontal */}
                {etapasList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 py-1 w-full">
                    {etapasList.map((et, idx) => {
                      const isActive = idx <= currentEtapaIndex
                      const isCurrent = et === etapaAtual
                      return (
                        <button
                          key={et}
                          type="button"
                          onClick={() => setEtapaAtual(et)}
                          title={et}
                          className={cn(
                            'relative h-7 px-2.5 text-[11px] font-bold transition-all flex items-center justify-center rounded-md',
                            isActive
                              ? 'bg-[#017848] text-white shadow-xs'
                              : 'bg-[#E5E9EC] text-slate-600 hover:bg-slate-300',
                            isCurrent && 'ring-2 ring-offset-1 ring-[#017848]',
                          )}
                        >
                          <span className="truncate max-w-[140px]">{et}</span>
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

              {/* Etiqueta ⓘ */}
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Etiqueta</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" avoidCollisions className="text-xs">
                        Classificação qualitativa do negócio (quente, prioritário, cold).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={etiqueta} onValueChange={setEtiqueta}>
                  <SelectTrigger className="h-9 text-xs rounded-lg border-[#D5DBDB] bg-white">
                    <SelectValue placeholder="Adicionar etiquetas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="nenhuma">Sem etiqueta</SelectItem>
                    <SelectItem value="quente">Alta Prioridade / Quente</SelectItem>
                    <SelectItem value="recorrente">Cliente Recorrente</SelectItem>
                    <SelectItem value="licitacao">Licitação / B2B Estruturado</SelectItem>
                  </SelectContent>
                </Select>
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
                      <TooltipContent side="top" align="start" avoidCollisions className="text-xs">
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

              {/* Próxima Ação / Follow-up (opcional conforme decisão de produto) */}
              <div className="space-y-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div className="flex items-center space-x-1.5 text-amber-900 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Próxima Ação / Follow-up (opcional)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-semibold text-amber-900">
                      Data Vencimento (opcional)
                    </Label>
                    <Input
                      type="date"
                      value={followUpData}
                      onChange={(e) => setFollowUpData(e.target.value)}
                      className="h-8 text-xs bg-white border-amber-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold text-amber-900">
                      Descrição da ação (opcional)
                    </Label>
                    <Input
                      value={followUpDesc}
                      onChange={(e) => setFollowUpDesc(e.target.value)}
                      placeholder="ex: Primeiro alinhamento (opcional)..."
                      className="h-8 text-xs bg-white border-amber-300 rounded-lg"
                    />
                  </div>
                </div>
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

              {/* 9. Canal da origem */}
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

              {/* 10. ID do canal de origem */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  ID do canal de origem
                </Label>
                <Input
                  value={idCanalOrigem}
                  onChange={(e) => setIdCanalOrigem(e.target.value)}
                  placeholder=""
                  className="h-9 text-xs rounded-lg border-[#D5DBDB] focus:border-[#017848]"
                />
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
            </div>
          </div>

          {/* ======================================================== */}
          {/* RODAPÉ DO MODAL (ESTILO PIPEDRIVE)                       */}
          {/* ======================================================== */}
          <div className="px-6 py-3.5 bg-white border-t border-[#E3E7EB] flex items-center justify-between shrink-0">
            {/* Lado esquerdo: Link com ícone "Importação" */}
            <a
              href="/importacao"
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Importação</span>
            </a>

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
                onClick={() => {
                  setProprietarioId(user?.id || '')
                  onOpenChange(false)
                }}
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
  )
}
export default AddDealModal
