// src/pages/Clientes.tsx
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type { ClienteB2B, ClienteB2C, Contato, Oportunidade, PreferenciaComunicacao } from '@/types'
import {
  formatCurrencyBRL,
  formatDateBR,
  isValidCNPJ,
  isValidCPF,
  maskCNPJ,
  maskCPF,
  maskPhone,
} from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  ShieldCheck,
  Briefcase,
  Users2,
  Link2,
  Loader2,
  Trash2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { marcas, activeBrand, isConsolidated } = useBrand()

  const [activeTab, setActiveTab] = useState<'b2b' | 'b2c'>(
    searchParams.get('tab') === 'b2c' ? 'b2c' : 'b2b',
  )
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [clientesB2B, setClientesB2B] = useState<ClienteB2B[]>([])
  const [clientesB2C, setClientesB2C] = useState<ClienteB2C[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Detail View State (Drawer)
  const [selectedB2B, setSelectedB2B] = useState<ClienteB2B | null>(null)
  const [selectedB2C, setSelectedB2C] = useState<ClienteB2C | null>(null)
  const [linkedContatos, setLinkedContatos] = useState<Contato[]>([])
  const [clientOpps, setClientOpps] = useState<Oportunidade[]>([])
  const [clientPrefs, setClientPrefs] = useState<PreferenciaComunicacao[]>([])

  // Modal Novo Cliente (B2B ou B2C)
  const [isNewClientOpen, setIsNewClientOpen] = useState(false)
  const [newTipo, setNewTipo] = useState<'b2b' | 'b2c'>('b2b')
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
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Adicionar Contato Vinculado (B2B <-> B2C)
  const [isAddContatoOpen, setIsAddContatoOpen] = useState(false)
  const [selectedB2CCandidateId, setSelectedB2CCandidateId] = useState('')
  const [contatoCargo, setContatoCargo] = useState('')
  const [contatoDepto, setContatoDepto] = useState('')

  // Modal Adicionar Preferência LGPD
  const [isAddPrefOpen, setIsAddPrefOpen] = useState(false)
  const [prefMarcaId, setPrefMarcaId] = useState('')
  const [prefCanal, setPrefCanal] = useState<'E-mail' | 'WhatsApp' | 'Telefone' | 'SMS'>('WhatsApp')
  const [prefStatus, setPrefStatus] = useState<'Opt-in' | 'Opt-out'>('Opt-in')

  const fetchClientes = async () => {
    setIsLoading(true)
    try {
      let filterB2B = ''
      let filterB2C = ''

      if (activeBrand) {
        filterB2B = `marca_captura_id = "${activeBrand.id}"`
        filterB2C = `marca_captura_id = "${activeBrand.id}"`
      }

      if (searchTerm.trim()) {
        const clean = searchTerm.trim().replace(/['"]/g, '')
        const qB2B = `razao_social ~ "${clean}" || cnpj ~ "${clean}" || email_principal ~ "${clean}"`
        const qB2C = `nome_completo ~ "${clean}" || cpf ~ "${clean}" || email_principal ~ "${clean}"`
        filterB2B = filterB2B ? `(${filterB2B}) && (${qB2B})` : qB2B
        filterB2C = filterB2C ? `(${filterB2C}) && (${qB2C})` : qB2C
      }

      const [b2bList, b2cList] = await Promise.all([
        pb.collection('clientes_b2b').getFullList<ClienteB2B>({
          filter: filterB2B || undefined,
          expand: 'marca_captura_id',
          sort: 'razao_social',
        }),
        pb.collection('clientes_b2c').getFullList<ClienteB2C>({
          filter: filterB2C || undefined,
          expand: 'marca_captura_id',
          sort: 'nome_completo',
        }),
      ])

      setClientesB2B(b2bList)
      setClientesB2C(b2cList)
    } catch (err) {
      console.error('Erro ao buscar clientes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClientes()
  }, [activeBrand, searchTerm])

  // Carrega relacionamentos do cliente selecionado no Drawer
  const loadClientDetails = async (b2bId?: string, b2cId?: string) => {
    try {
      if (b2bId) {
        const [contatosRes, oppsRes, prefsRes] = await Promise.all([
          pb.collection('contatos').getFullList<Contato>({
            filter: `cliente_b2b_id = "${b2bId}"`,
            expand: 'consumidor_b2c_id',
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
        setLinkedContatos(contatosRes)
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
        setLinkedContatos([])
        setClientOpps(oppsRes)
        setClientPrefs(prefsRes)
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes do cliente:', err)
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

  // Criação de Cliente com validação matemática de dígitos verificadores
  const handleCreateClient = async (e: React.FormEvent) => {
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
        await pb.collection('clientes_b2b').create({
          cnpj: maskCNPJ(newCnpj),
          razao_social: newRazao.trim(),
          nome_fantasia: newFantasia.trim(),
          inscricao_estadual: newIE.trim(),
          endereco_corporativo: newEndereco.trim(),
          email_principal: newEmail.trim(),
          telefone: newTelefone ? maskPhone(newTelefone) : '',
          marca_captura_id: marcaId,
          origem_sistema: 'Cadastro Manual NTC CRM',
          data_criacao: new Date().toISOString(),
          criado_por_id: pb.authStore.record?.id,
        })

        toast({
          title: 'Conta B2B cadastrada',
          description: 'Registro corporativo incluído na base mestre única.',
        })
        setIsNewClientOpen(false)
        resetForm()
        fetchClientes()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar cliente B2B'
        setValidationError(msg)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // B2C
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
        await pb.collection('clientes_b2c').create({
          cpf: maskCPF(newCpf),
          nome_completo: newNomeCompleto.trim(),
          email_principal: newEmail.trim(),
          telefone: newTelefone ? maskPhone(newTelefone) : '',
          marca_captura_id: marcaId,
          origem_sistema: 'Cadastro Manual NTC CRM',
          data_criacao: new Date().toISOString(),
          criado_por_id: pb.authStore.record?.id,
        })

        toast({
          title: 'Consumidor B2C cadastrado',
          description: 'Registro pessoa física incluído na base corporativa unificada.',
        })
        setIsNewClientOpen(false)
        resetForm()
        fetchClientes()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar cliente B2C'
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
    setValidationError(null)
  }

  // Vínculo B2B <-> B2C: Adicionar Contato Técnico
  const handleAddContato = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedB2B || !selectedB2CCandidateId) return

    try {
      await pb.collection('contatos').create({
        cliente_b2b_id: selectedB2B.id,
        consumidor_b2c_id: selectedB2CCandidateId,
        cargo: contatoCargo,
        departamento: contatoDepto,
      })

      toast({
        title: 'Contato corporativo vinculado',
        description: 'Vínculo da pessoa física à conta B2B estabelecido com integridade.',
      })
      setIsAddContatoOpen(false)
      setSelectedB2CCandidateId('')
      setContatoCargo('')
      setContatoDepto('')
      loadClientDetails(selectedB2B.id, undefined)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao vincular contato'
      toast({
        variant: 'destructive',
        title: 'Erro de vínculo',
        description: msg,
      })
    }
  }

  // Adicionar Preferência LGPD para este cliente
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

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
            Base Corporativa Unificada de Clientes
          </h1>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Registro mestre único NTC: Contas B2B (CNPJ) e Consumidores B2C (CPF) vinculáveis
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm()
            setNewMarcaCapturaId(activeBrand?.id || (marcas[0]?.id ?? ''))
            setIsNewClientOpen(true)
          }}
          size="sm"
          className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Cliente
        </Button>
      </div>

      {/* ABAS B2B E B2C + BARRA DE BUSCA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as 'b2b' | 'b2c')
            searchParams.set('tab', v)
            setSearchParams(searchParams)
          }}
          className="w-auto"
        >
          <TabsList className="bg-white border border-[#D5DBDB] p-1 h-10 shadow-xs">
            <TabsTrigger
              value="b2b"
              className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-[#1B4F72] data-[state=active]:text-white flex items-center space-x-2"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Contas B2B ({clientesB2B.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="b2c"
              className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-[#1B4F72] data-[state=active]:text-white flex items-center space-x-2"
            >
              <User className="w-3.5 h-3.5" />
              <span>Consumidores B2C ({clientesB2C.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Busca com Debounce */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#5D6D7E]" />
          <Input
            type="text"
            placeholder="Buscar razão, nome, CNPJ, CPF ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-xs bg-white border-[#D5DBDB]"
          />
        </div>
      </div>

      {/* CONTEÚDO DA TABELA */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-xs text-[#5D6D7E]">
          <Loader2 className="w-6 h-6 animate-spin text-[#1B4F72] mb-2" />
          Carregando base de clientes...
        </div>
      ) : activeTab === 'b2b' ? (
        /* TABELA B2B */
        <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#D5DBDB] text-[10px] uppercase font-bold tracking-wider text-[#5D6D7E]">
                <tr>
                  <th className="px-4 py-3">Razão Social / Nome Fantasia</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">E-mail Principal</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Marca de Captura</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5DBDB]/60">
                {clientesB2B.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#5D6D7E]">
                      Nenhuma conta B2B encontrada para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  clientesB2B.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenB2B(c)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#1C2833]">{c.razao_social}</p>
                        {c.nome_fantasia && (
                          <p className="text-[11px] text-[#5D6D7E]">{c.nome_fantasia}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#1C2833]">{c.cnpj}</td>
                      <td className="px-4 py-3 text-[#5D6D7E]">{c.email_principal || '—'}</td>
                      <td className="px-4 py-3 text-[#5D6D7E]">{c.telefone || '—'}</td>
                      <td className="px-4 py-3">
                        {c.expand?.marca_captura_id ? (
                          <Badge
                            className="text-[10px] text-white"
                            style={{ backgroundColor: c.expand.marca_captura_id.cor_destaque }}
                          >
                            {c.expand.marca_captura_id.nome}
                          </Badge>
                        ) : (
                          <span className="text-[#5D6D7E]">NTC Geral</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-[#1B4F72] h-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenB2B(c)
                          }}
                        >
                          Ver Ficha
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* TABELA B2C */
        <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#D5DBDB] text-[10px] uppercase font-bold tracking-wider text-[#5D6D7E]">
                <tr>
                  <th className="px-4 py-3">Nome Completo</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">E-mail Principal</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Marca de Captura</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5DBDB]/60">
                {clientesB2C.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#5D6D7E]">
                      Nenhum consumidor B2C encontrado para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  clientesB2C.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenB2C(c)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-[#1C2833]">{c.nome_completo}</td>
                      <td className="px-4 py-3 font-mono text-[#1C2833]">{c.cpf}</td>
                      <td className="px-4 py-3 text-[#5D6D7E]">{c.email_principal || '—'}</td>
                      <td className="px-4 py-3 text-[#5D6D7E]">{c.telefone || '—'}</td>
                      <td className="px-4 py-3">
                        {c.expand?.marca_captura_id ? (
                          <Badge
                            className="text-[10px] text-white"
                            style={{ backgroundColor: c.expand.marca_captura_id.cor_destaque }}
                          >
                            {c.expand.marca_captura_id.nome}
                          </Badge>
                        ) : (
                          <span className="text-[#5D6D7E]">NTC Geral</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-[#1B4F72] h-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenB2C(c)
                          }}
                        >
                          Ver Ficha
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DRAWER DE DETALHE DE CLIENTE (B2B ou B2C) */}
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
          className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-white border-l border-[#D5DBDB] shadow-2xl z-50"
        >
          {selectedB2B ? (
            /* DETALHES CONTA B2B */
            <>
              <SheetHeader className="p-5 border-b border-[#D5DBDB] bg-slate-50/70 text-left">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <Badge variant="outline" className="text-[10px] font-bold border-[#D5DBDB]">
                    Conta Corporativa B2B
                  </Badge>
                </div>
                <SheetTitle className="text-lg font-bold text-[#1C2833] mt-2">
                  {selectedB2B.razao_social}
                </SheetTitle>
                <p className="text-xs text-[#5D6D7E] font-mono">CNPJ: {selectedB2B.cnpj}</p>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* DADOS CADASTRAIS */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                    Dados Cadastrais Oficiais
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-slate-50 rounded-lg border border-[#D5DBDB]/60">
                    <div>
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                        Nome Fantasia
                      </p>
                      <p className="font-semibold text-[#1C2833]">
                        {selectedB2B.nome_fantasia || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                        Inscrição Estadual
                      </p>
                      <p className="font-semibold text-[#1C2833]">
                        {selectedB2B.inscricao_estadual || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">Endereço</p>
                      <p className="font-semibold text-[#1C2833]">
                        {selectedB2B.endereco_corporativo || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">E-mail</p>
                      <p className="font-semibold text-[#1C2833]">
                        {selectedB2B.email_principal || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">Telefone</p>
                      <p className="font-semibold text-[#1C2833]">{selectedB2B.telefone || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* CONTATOS VINCULADOS (B2B <-> B2C) */}
                <div className="space-y-3 pt-3 border-t border-[#D5DBDB]/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#1C2833]">
                        Contatos Vinculados (Pessoas Físicas)
                      </span>
                      <p className="text-[11px] text-[#5D6D7E]">
                        Permite que uma pessoa física (CPF) atue como comprador técnico sem duplicar
                        cadastro
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsAddContatoOpen(true)}
                      className="text-xs h-7 bg-[#1B4F72] hover:bg-[#154360] text-white"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      Adicionar Contato
                    </Button>
                  </div>

                  {linkedContatos.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                      Nenhum contato pessoa física vinculado a esta conta B2B ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linkedContatos.map((ct) => (
                        <div
                          key={ct.id}
                          className="p-3 rounded-lg border border-[#D5DBDB] bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-[#1C2833]">
                              {ct.expand?.consumidor_b2c_id?.nome_completo || 'Contato Sem Nome'}
                            </p>
                            <p className="text-[11px] text-[#5D6D7E] mt-0.5">
                              Cargo: {ct.cargo || 'Não especificado'} • Depto:{' '}
                              {ct.departamento || 'Geral'}
                            </p>
                            <p className="text-[10px] font-mono text-[#5D6D7E] mt-0.5">
                              CPF: {ct.expand?.consumidor_b2c_id?.cpf} •{' '}
                              {ct.expand?.consumidor_b2c_id?.email_principal}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* HISTÓRICO DE OPORTUNIDADES */}
                <div className="space-y-3 pt-3 border-t border-[#D5DBDB]/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                    Histórico Comercial / Oportunidades ({clientOpps.length})
                  </span>
                  {clientOpps.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                      Nenhuma oportunidade registrada para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientOpps.map((op) => (
                        <div
                          key={op.id}
                          className="p-3 rounded-lg border border-[#D5DBDB] bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-[#1C2833]">{op.titulo}</p>
                            <p className="text-[11px] text-[#5D6D7E] mt-0.5">
                              Etapa:{' '}
                              <Badge variant="outline" className="text-[10px]">
                                {op.etapa_atual}
                              </Badge>
                            </p>
                          </div>
                          <span className="font-bold text-[#1C2833]">
                            {formatCurrencyBRL(op.valor_estimado)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PAINEL LGPD */}
                <div className="space-y-3 pt-3 border-t border-[#D5DBDB]/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                      Consentimento LGPD por Marca
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddPrefOpen(true)}
                      className="text-xs h-7 border-[#D5DBDB]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Preferência
                    </Button>
                  </div>
                  {clientPrefs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                      Nenhuma preferência cadastrada.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientPrefs.map((pref) => (
                        <div
                          key={pref.id}
                          className="p-2.5 rounded-lg border border-[#D5DBDB] bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#1C2833]">{pref.canal}</span>
                            <span className="text-[#5D6D7E] text-[11px] ml-2">
                              ({pref.expand?.marca_id?.nome})
                            </span>
                          </div>
                          <Badge
                            className={cn(
                              'text-[10px]',
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
            /* DETALHES CONSUMIDOR B2C */
            <>
              <SheetHeader className="p-5 border-b border-[#D5DBDB] bg-slate-50/70 text-left">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  <Badge variant="outline" className="text-[10px] font-bold border-[#D5DBDB]">
                    Consumidor B2C (Pessoa Física)
                  </Badge>
                </div>
                <SheetTitle className="text-lg font-bold text-[#1C2833] mt-2">
                  {selectedB2C.nome_completo}
                </SheetTitle>
                <p className="text-xs text-[#5D6D7E] font-mono">CPF: {selectedB2C.cpf}</p>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* DADOS CADASTRAIS */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                    Dados Pessoais
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-slate-50 rounded-lg border border-[#D5DBDB]/60">
                    <div>
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">E-mail</p>
                      <p className="font-semibold text-[#1C2833]">
                        {selectedB2C.email_principal || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">Telefone</p>
                      <p className="font-semibold text-[#1C2833]">{selectedB2C.telefone || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-[#5D6D7E] uppercase font-bold">
                        Origem de Cadastro
                      </p>
                      <p className="font-semibold text-[#1C2833]">
                        {selectedB2C.origem_sistema || 'NTC'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* HISTÓRICO DE OPORTUNIDADES */}
                <div className="space-y-3 pt-3 border-t border-[#D5DBDB]/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                    Oportunidades Vinculadas ({clientOpps.length})
                  </span>
                  {clientOpps.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                      Nenhuma compra ou negociação registrada.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientOpps.map((op) => (
                        <div
                          key={op.id}
                          className="p-3 rounded-lg border border-[#D5DBDB] bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-[#1C2833]">{op.titulo}</p>
                            <p className="text-[11px] text-[#5D6D7E] mt-0.5">
                              Etapa:{' '}
                              <Badge variant="outline" className="text-[10px]">
                                {op.etapa_atual}
                              </Badge>
                            </p>
                          </div>
                          <span className="font-bold text-[#1C2833]">
                            {formatCurrencyBRL(op.valor_estimado)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PAINEL LGPD */}
                <div className="space-y-3 pt-3 border-t border-[#D5DBDB]/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D7E]">
                      Consentimento LGPD
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddPrefOpen(true)}
                      className="text-xs h-7 border-[#D5DBDB]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Preferência
                    </Button>
                  </div>
                  {clientPrefs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#5D6D7E] border border-dashed border-[#D5DBDB] rounded-lg">
                      Nenhuma autorização formal cadastrada.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientPrefs.map((pref) => (
                        <div
                          key={pref.id}
                          className="p-2.5 rounded-lg border border-[#D5DBDB] bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#1C2833]">{pref.canal}</span>
                            <span className="text-[#5D6D7E] text-[11px] ml-2">
                              ({pref.expand?.marca_id?.nome})
                            </span>
                          </div>
                          <Badge
                            className={cn(
                              'text-[10px]',
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

      {/* MODAL NOVO CLIENTE COM VALIDAÇÃO DE DÍGITOS VERIFICADORES NO INPUT */}
      <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Cadastrar Novo Cliente Corporativo
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateClient} className="space-y-4">
            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Seletor de Tipo: B2B vs B2C */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setNewTipo('b2b')
                  setValidationError(null)
                }}
                className={cn(
                  'py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center space-x-2',
                  newTipo === 'b2b' ? 'bg-white text-[#1B4F72] shadow-xs' : 'text-[#5D6D7E]',
                )}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Conta B2B (CNPJ)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewTipo('b2c')
                  setValidationError(null)
                }}
                className={cn(
                  'py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center space-x-2',
                  newTipo === 'b2c' ? 'bg-white text-[#1B4F72] shadow-xs' : 'text-[#5D6D7E]',
                )}
              >
                <User className="w-3.5 h-3.5" />
                <span>Consumidor B2C (CPF)</span>
              </button>
            </div>

            {newTipo === 'b2b' ? (
              /* CAMPOS B2B */
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-[#5D6D7E]">CNPJ (Validado)</Label>
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
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#5D6D7E]">Razão Social</Label>
                  <Input
                    required
                    placeholder="Nome empresarial formal"
                    value={newRazao}
                    onChange={(e) => setNewRazao(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#5D6D7E]">Nome Fantasia</Label>
                    <Input
                      placeholder="Nome comercial"
                      value={newFantasia}
                      onChange={(e) => setNewFantasia(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#5D6D7E]">
                      Inscrição Estadual
                    </Label>
                    <Input
                      placeholder="IE"
                      value={newIE}
                      onChange={(e) => setNewIE(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#5D6D7E]">
                    Endereço Corporativo
                  </Label>
                  <Input
                    placeholder="Logradouro, número, cidade - UF"
                    value={newEndereco}
                    onChange={(e) => setNewEndereco(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </>
            ) : (
              /* CAMPOS B2C */
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-[#5D6D7E]">CPF (Validado)</Label>
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
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#5D6D7E]">Nome Completo</Label>
                  <Input
                    required
                    placeholder="Nome da pessoa física"
                    value={newNomeCompleto}
                    onChange={(e) => setNewNomeCompleto(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </>
            )}

            {/* CAMPOS COMUNS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#5D6D7E]">E-mail</Label>
                <Input
                  type="email"
                  placeholder="email@empresa.com.br"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={newTelefone}
                  onChange={(e) => setNewTelefone(maskPhone(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Marca de Captura</Label>
              <Select value={newMarcaCapturaId} onValueChange={setNewMarcaCapturaId}>
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

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewClientOpen(false)}
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
                {isSubmitting ? 'Salvando...' : 'Salvar Cadastro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR CONTATO VINCULADO (B2B <-> B2C) */}
      <Dialog open={isAddContatoOpen} onOpenChange={setIsAddContatoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Vincular Pessoa Física como Contato B2B
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddContato} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">
                Pessoa Física Existente (Consumidor B2C)
              </Label>
              <Select value={selectedB2CCandidateId} onValueChange={setSelectedB2CCandidateId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a pessoa física..." />
                </SelectTrigger>
                <SelectContent>
                  {clientesB2C.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo} (CPF: {c.cpf})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Cargo na Conta B2B</Label>
              <Input
                required
                placeholder="ex: Comprador Técnico, Gerente de Manutenção"
                value={contatoCargo}
                onChange={(e) => setContatoCargo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Departamento</Label>
              <Input
                placeholder="ex: Suprimentos, Engenharia"
                value={contatoDepto}
                onChange={(e) => setContatoDepto(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddContatoOpen(false)}
                className="text-xs border-[#D5DBDB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                Confirmar Vínculo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR PREFERÊNCIA LGPD */}
      <Dialog open={isAddPrefOpen} onOpenChange={setIsAddPrefOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1C2833]">
              Registrar Consentimento LGPD
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddPreference} className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#5D6D7E]">Marca Específica</Label>
              <Select value={prefMarcaId} onValueChange={setPrefMarcaId}>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Canal</Label>
                <Select
                  value={prefCanal}
                  onValueChange={(v) => setPrefCanal(v as PreferenciaComunicacao['canal'])}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="E-mail">E-mail</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Telefone">Telefone</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#5D6D7E]">Consentimento</Label>
                <Select
                  value={prefStatus}
                  onValueChange={(v) =>
                    setPrefStatus(v as PreferenciaComunicacao['status_consentimento'])
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                className="text-xs border-[#D5DBDB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                Salvar Consentimento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
