// src/pages/Preferencias.tsx
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import type { PreferenciaComunicacao, ClienteB2B, ClienteB2C } from '@/types'
import { formatDateBR } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  Trash2,
  Loader2,
  Info,
  Layers,
  Users,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { FunisEtapasConfig } from '@/components/FunisEtapasConfig'
import { UsuariosAcessosConfig } from '@/components/UsuariosAcessosConfig'

export default function Preferencias() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { marcas, activeBrand } = useBrand()
  const { isAdmin } = useAuth()

  // Aba ativa: 'lgpd' | 'funis' | 'usuarios'
  const activeTab = searchParams.get('tab') || 'lgpd'

  const handleTabChange = (newTab: string) => {
    searchParams.set('tab', newTab)
    setSearchParams(searchParams)
  }

  const [preferencias, setPreferencias] = useState<PreferenciaComunicacao[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [canalFilter, setCanalFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [marcaFilter, setMarcaFilter] = useState<string>('all')

  // Modal Nova Preferência
  const [isNewPrefOpen, setIsNewPrefOpen] = useState(false)
  const [targetClienteTipo, setTargetClienteTipo] = useState<'b2b' | 'b2c'>('b2b')
  const [selectedClienteId, setSelectedClienteId] = useState('')
  const [prefMarcaId, setPrefMarcaId] = useState('')
  const [prefCanal, setPrefCanal] = useState<PreferenciaComunicacao['canal']>('WhatsApp')
  const [prefStatus, setPrefStatus] =
    useState<PreferenciaComunicacao['status_consentimento']>('Opt-in')

  const [clientesB2BList, setClientesB2BList] = useState<ClienteB2B[]>([])
  const [clientesB2CList, setClientesB2CList] = useState<ClienteB2C[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchPreferencias = async () => {
    setIsLoading(true)
    try {
      let filter = ''
      if (activeBrand) {
        filter = `marca_id = "${activeBrand.id}"`
      } else if (marcaFilter !== 'all') {
        filter = `marca_id = "${marcaFilter}"`
      }

      if (canalFilter !== 'all') {
        filter = filter ? `${filter} && canal = "${canalFilter}"` : `canal = "${canalFilter}"`
      }
      if (statusFilter !== 'all') {
        filter = filter
          ? `${filter} && status_consentimento = "${statusFilter}"`
          : `status_consentimento = "${statusFilter}"`
      }

      const res = await pb
        .collection('preferencias_comunicacao')
        .getFullList<PreferenciaComunicacao>({
          filter: filter || undefined,
          expand: 'marca_id,cliente_b2b_id,cliente_b2c_id',
          sort: '-created',
        })
      setPreferencias(res)
    } catch (err) {
      console.error('Erro ao buscar preferências:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPreferencias()
  }, [activeBrand, canalFilter, statusFilter, marcaFilter])

  const loadClientes = async () => {
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
    if (isNewPrefOpen) {
      loadClientes()
      setPrefMarcaId(activeBrand?.id || (marcas[0]?.id ?? ''))
    }
  }, [isNewPrefOpen])

  const handleToggleConsent = async (pref: PreferenciaComunicacao) => {
    const novoStatus = pref.status_consentimento === 'Opt-in' ? 'Opt-out' : 'Opt-in'
    try {
      await pb.collection('preferencias_comunicacao').update(pref.id, {
        status_consentimento: novoStatus,
        data_atualizacao: new Date().toISOString(),
      })
      toast({
        title: `Consentimento alterado para ${novoStatus}`,
        description: `Canal ${pref.canal} atualizado.`,
      })
      fetchPreferencias()
    } catch (err) {
      console.error('Erro ao atualizar consentimento:', err)
    }
  }

  const handleDeletePref = async (id: string) => {
    try {
      await pb.collection('preferencias_comunicacao').delete(id)
      toast({
        title: 'Registro de consentimento removido',
      })
      fetchPreferencias()
    } catch (err) {
      console.error('Erro ao excluir preferência:', err)
    }
  }

  const handleCreatePreference = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClienteId) {
      toast({
        variant: 'destructive',
        title: 'Cliente obrigatório',
        description: 'Selecione um cliente para vincular o consentimento.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await pb.collection('preferencias_comunicacao').create({
        cliente_b2b_id: targetClienteTipo === 'b2b' ? selectedClienteId : null,
        cliente_b2c_id: targetClienteTipo === 'b2c' ? selectedClienteId : null,
        marca_id: prefMarcaId,
        canal: prefCanal,
        status_consentimento: prefStatus,
        data_atualizacao: new Date().toISOString(),
      })

      toast({
        title: 'Preferência LGPD registrada',
        description: 'Termo de consentimento persistido na base de segurança.',
      })
      setIsNewPrefOpen(false)
      setSelectedClienteId('')
      fetchPreferencias()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar preferência'
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: msg,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Contadores de resumo
  const totalOptIn = preferencias.filter((p) => p.status_consentimento === 'Opt-in').length
  const totalOptOut = preferencias.filter((p) => p.status_consentimento === 'Opt-out').length

  const filteredPreferencias = preferencias.filter((p) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    const b2b = p.expand?.cliente_b2b_id?.razao_social?.toLowerCase().includes(q)
    const b2c = p.expand?.cliente_b2c_id?.nome_completo?.toLowerCase().includes(q)
    return b2b || b2c
  })

  return (
    <div className="space-y-6">
      {/* NAVEGAÇÃO DE SEÇÕES DE PREFERÊNCIAS */}
      <div className="border-b border-[#D5DBDB]/60 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
              Preferências & Configurações da Empresa
            </h1>
            <p className="text-xs sm:text-sm text-[#5D6D7E] mt-0.5">
              Administração central de regras comerciais, governança de dados e controle de acessos.
            </p>
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pt-1">
          <button
            type="button"
            onClick={() => handleTabChange('lgpd')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0',
              activeTab === 'lgpd'
                ? 'bg-[#1C2833] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Governança & LGPD</span>
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => handleTabChange('funis')}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0',
                  activeTab === 'funis'
                    ? 'bg-[#017848] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                )}
              >
                <Layers className="w-4 h-4" />
                <span>Funis e Etapas</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('usuarios')}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0',
                  activeTab === 'usuarios'
                    ? 'bg-[#017848] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                )}
              >
                <Users className="w-4 h-4" />
                <span>Usuários e Acessos</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      {activeTab === 'funis' && isAdmin ? (
        <FunisEtapasConfig isAdmin={isAdmin} />
      ) : activeTab === 'usuarios' && isAdmin ? (
        <UsuariosAcessosConfig isAdmin={isAdmin} />
      ) : (
        /* CONTEÚDO ORIGINAL DE LGPD & PREFERÊNCIAS DE COMUNICAÇÃO */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#1C2833]">
                Governança LGPD & Preferências de Comunicação por Marca
              </h2>
              <p className="text-xs text-[#5D6D7E] mt-0.5">
                Gestão estrita de consentimento multicanal (Art. 7º LGPD): opt-in e opt-out
                segregados por unidade comercial
              </p>
            </div>

            <Button
              onClick={() => setIsNewPrefOpen(true)}
              size="sm"
              className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white shadow-xs self-start sm:self-auto rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Preferência
            </Button>
          </div>

          {/* PAINEL FIXO DE CONFORMIDADE LGPD */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start space-x-3 text-xs text-[#1B4F72]">
            <Info className="w-5 h-5 text-[#1B4F72] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                Regra de Segregação Legal de Finalidade (LGPD Multimarca):
              </p>
              <p className="text-blue-900/90 leading-relaxed">
                O consentimento obtido para uma marca da NTC (ex: Utensílios Udê){' '}
                <strong>não autoriza</strong> o envio de comunicações promocionais de outra unidade
                (ex: Pierplas ou NTC Agro). A revogação (Opt-out) tem efeito estrito e imediato na
                respectiva marca. Toda ação comercial externa deve consultar previamente este
                painel.
              </p>
            </div>
          </div>

          {/* CARDS RESUMO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                    Consentimentos Ativos
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 mt-0.5">{totalOptIn}</p>
                  <p className="text-[11px] text-[#5D6D7E]">Autorizações comerciais (Opt-in)</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                    Bloqueios Cadastrados
                  </p>
                  <p className="text-2xl font-bold text-red-600 mt-0.5">{totalOptOut}</p>
                  <p className="text-[11px] text-[#5D6D7E]">Descadastramentos (Opt-out)</p>
                </div>
                <div className="p-2.5 rounded-lg bg-red-50 text-red-600">
                  <XCircle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                    Total de Registros
                  </p>
                  <p className="text-2xl font-bold text-[#1C2833] mt-0.5">{preferencias.length}</p>
                  <p className="text-[11px] text-[#5D6D7E]">Trilhas de consentimento por marca</p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 text-[#1B4F72]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FILTROS E BUSCA */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Canal */}
              <Select value={canalFilter} onValueChange={setCanalFilter}>
                <SelectTrigger className="h-9 text-xs w-36 bg-white border-[#D5DBDB]">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Canais</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                </SelectContent>
              </Select>

              {/* Status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs w-36 bg-white border-[#D5DBDB]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Opt-in">Opt-in (Ativo)</SelectItem>
                  <SelectItem value="Opt-out">Opt-out (Bloqueado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Busca */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#5D6D7E]" />
              <Input
                type="text"
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-white border-[#D5DBDB]"
              />
            </div>
          </div>

          {/* TABELA DE PREFERÊNCIAS */}
          <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-xs text-[#5D6D7E]">
                <Loader2 className="w-6 h-6 animate-spin text-[#1B4F72] mb-2" />
                Carregando preferências de consentimento...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#D5DBDB] text-[10px] uppercase font-bold tracking-wider text-[#5D6D7E]">
                    <tr>
                      <th className="px-4 py-3">Cliente (B2B ou B2C)</th>
                      <th className="px-4 py-3">Marca Autorizada</th>
                      <th className="px-4 py-3">Canal</th>
                      <th className="px-4 py-3">Status de Consentimento</th>
                      <th className="px-4 py-3">Última Atualização</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5DBDB]/60">
                    {filteredPreferencias.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[#5D6D7E]">
                          Nenhum registro de consentimento encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredPreferencias.map((p) => {
                        const isB2B = !!p.cliente_b2b_id
                        const clienteNome = isB2B
                          ? p.expand?.cliente_b2b_id?.razao_social
                          : p.expand?.cliente_b2c_id?.nome_completo
                        const doc = isB2B
                          ? p.expand?.cliente_b2b_id?.cnpj
                          : p.expand?.cliente_b2c_id?.cpf
                        const isOptIn = p.status_consentimento === 'Opt-in'

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                {isB2B ? (
                                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                                <div>
                                  <p className="font-bold text-[#1C2833]">
                                    {clienteNome || 'Cliente'}
                                  </p>
                                  <p className="text-[10px] font-mono text-[#5D6D7E]">{doc}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {p.expand?.marca_id ? (
                                <Badge
                                  className="text-[10px] text-white"
                                  style={{ backgroundColor: p.expand.marca_id.cor_destaque }}
                                >
                                  {p.expand.marca_id.nome}
                                </Badge>
                              ) : (
                                <span className="text-[#5D6D7E]">NTC Geral</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#1C2833]">{p.canal}</td>
                            <td className="px-4 py-3">
                              <Badge
                                className={cn(
                                  'text-[10px]',
                                  isOptIn
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-red-50 text-red-700 border-red-200',
                                )}
                              >
                                {p.status_consentimento}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-[#5D6D7E]">
                              {formatDateBR(p.data_atualizacao || p.updated)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleConsent(p)}
                                  className="text-[11px] h-7 border-[#D5DBDB]"
                                >
                                  Alternar para {isOptIn ? 'Opt-out' : 'Opt-in'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeletePref(p.id)}
                                  className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* MODAL NOVA PREFERÊNCIA */}
          <Dialog open={isNewPrefOpen} onOpenChange={setIsNewPrefOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-[#1C2833]">
                  Cadastrar Consentimento LGPD
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreatePreference} className="space-y-3.5">
                {/* Escolha do tipo de cliente */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetClienteTipo('b2b')
                      setSelectedClienteId('')
                    }}
                    className={cn(
                      'py-1 text-xs font-semibold rounded-md transition-colors',
                      targetClienteTipo === 'b2b'
                        ? 'bg-white text-[#1B4F72] shadow-xs'
                        : 'text-[#5D6D7E]',
                    )}
                  >
                    Conta B2B
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetClienteTipo('b2c')
                      setSelectedClienteId('')
                    }}
                    className={cn(
                      'py-1 text-xs font-semibold rounded-md transition-colors',
                      targetClienteTipo === 'b2c'
                        ? 'bg-white text-[#1B4F72] shadow-xs'
                        : 'text-[#5D6D7E]',
                    )}
                  >
                    Consumidor B2C
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#5D6D7E]">Cliente Titular</Label>
                  <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue
                        placeholder={
                          targetClienteTipo === 'b2b'
                            ? 'Selecione a conta B2B...'
                            : 'Selecione o consumidor B2C...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {targetClienteTipo === 'b2b'
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
                  <Label className="text-xs font-semibold text-[#5D6D7E]">
                    Marca com Permissão
                  </Label>
                  <Select value={prefMarcaId} onValueChange={setPrefMarcaId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
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
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="E-mail">E-mail</SelectItem>
                        <SelectItem value="Telefone">Telefone</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#5D6D7E]">Status</Label>
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
                    onClick={() => setIsNewPrefOpen(false)}
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
                    {isSubmitting ? 'Salvando...' : 'Salvar Consentimento'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}
