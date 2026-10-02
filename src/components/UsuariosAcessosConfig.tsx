// src/components/UsuariosAcessosConfig.tsx
// Seção "Usuários e Acessos" (Frente 3) exclusiva para administradores:
// - Listagem de usuários existentes
// - Convite por e-mail com endpoint autenticado server-side
// - Matriz usuário × marca com papéis (Vendedor, Supervisor, Administrador de marca, Diretoria)
// - Limites de acesso: marcas permitidas, escopo (próprios, equipe, marca inteira), permissão de conciliação e importação
// - Desativação sem excluir, preservando trilha de auditoria append-only

import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type { Usuario, ConviteUsuario, PapelMarca, PerfilGlobal, PermissoesUsuario } from '@/types'
import { formatDateBR } from '@/lib/formatters'
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
  UserPlus,
  Users,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Mail,
  Building2,
  Search,
  Loader2,
  Lock,
  Eye,
  FileSpreadsheet,
  CheckSquare,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface UsuariosAcessosConfigProps {
  isAdmin: boolean
}

export function UsuariosAcessosConfig({ isAdmin }: UsuariosAcessosConfigProps) {
  const { marcas } = useBrand()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [convites, setConvites] = useState<ConviteUsuario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal Convite
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteNome, setInviteNome] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePerfil, setInvitePerfil] = useState<PerfilGlobal>('Vendedor')
  const [inviteMarcas, setInviteMarcas] = useState<string[]>([])
  const [invitePapeisPorMarca, setInvitePapeisPorMarca] = useState<Record<string, PapelMarca>>({})
  const [inviteEscopo, setInviteEscopo] = useState<'proprios' | 'equipe' | 'marca_inteira'>(
    'proprios',
  )
  const [invitePodeConciliar, setInvitePodeConciliar] = useState(false)
  const [invitePodeImportar, setInvitePodeImportar] = useState(false)
  const [isSendingInvite, setIsSendingInvite] = useState(false)

  // Modal Edição de Matriz de Acesso do Usuário Selecionado
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false)
  const [editPerfilGlobal, setEditPerfilGlobal] = useState<PerfilGlobal>('Vendedor')
  const [editMarcas, setEditMarcas] = useState<string[]>([])
  const [editPapeisPorMarca, setEditPapeisPorMarca] = useState<Record<string, PapelMarca>>({})
  const [editEscopo, setEditEscopo] = useState<'proprios' | 'equipe' | 'marca_inteira'>('proprios')
  const [editPodeConciliar, setEditPodeConciliar] = useState(false)
  const [editPodeImportar, setEditPodeImportar] = useState(false)
  const [isSavingUser, setIsSavingUser] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [usersRes, convitesRes] = await Promise.all([
        pb.collection('users').getFullList<Usuario>({
          sort: 'name',
        }),
        pb
          .collection('convites_usuarios')
          .getFullList<ConviteUsuario>({
            sort: '-created',
          })
          .catch(() => [] as ConviteUsuario[]),
      ])

      setUsuarios(usersRes)
      setConvites(convitesRes)
    } catch (err) {
      console.error('Erro ao carregar dados de usuários:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar a lista de usuários e acessos.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Alternar ativação/desativação de usuário (preservando integridade e auditoria)
  const handleToggleUserActive = async (user: Usuario) => {
    const novoStatus = !user.ativo
    try {
      await pb.collection('users').update(user.id, {
        ativo: novoStatus,
      })

      setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, ativo: novoStatus } : u)))

      toast({
        title: novoStatus ? 'Usuário reativado' : 'Usuário desativado',
        description: `${user.name || user.email} ${
          novoStatus
            ? 'agora possui acesso ao CRM.'
            : 'teve o acesso suspenso (histórico preservado).'
        }`,
      })
    } catch (err) {
      console.error('Erro ao alterar status do usuário:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status do usuário.',
      })
    }
  }

  // Abrir Modal de Matriz de Acesso para Usuário
  const openEditUser = (user: Usuario) => {
    setSelectedUser(user)
    setEditPerfilGlobal(user.perfil_global || 'Vendedor')

    const perms = user.permissoes || {}
    setEditMarcas(perms.marcas_permitidas || marcas.map((m) => m.id))
    setEditPapeisPorMarca(perms.papeis_por_marca || {})
    setEditEscopo(perms.escopo_visibilidade || 'proprios')
    setEditPodeConciliar(Boolean(perms.pode_conciliar))
    setEditPodeImportar(Boolean(perms.pode_importar))

    setIsEditUserModalOpen(true)
  }

  // Salvar Matriz de Acesso do Usuário
  const handleSaveUserPermissions = async () => {
    if (!selectedUser) return

    setIsSavingUser(true)
    try {
      const isRep = editPerfilGlobal === 'Representante'
      const permissoes: PermissoesUsuario = {
        marcas_permitidas: editMarcas,
        papeis_por_marca: isRep
          ? editMarcas.reduce<Record<string, PapelMarca>>((acc, mId) => {
              acc[mId] = 'Representante'
              return acc
            }, {})
          : editPapeisPorMarca,
        escopo_visibilidade: isRep ? 'proprios' : editEscopo,
        pode_conciliar: isRep ? false : editPodeConciliar,
        pode_importar: isRep ? false : editPodeImportar,
      }

      const updated = await pb.collection('users').update<Usuario>(selectedUser.id, {
        perfil_global: editPerfilGlobal,
        permissoes,
      })

      setUsuarios((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      setIsEditUserModalOpen(false)

      toast({
        title: 'Acessos atualizados',
        description: `Matriz de permissões e papéis de ${updated.name || updated.email} salva.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao salvar permissões:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao salvar permissões'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setIsSavingUser(false)
    }
  }

  // Enviar Convite por E-mail
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedNome = inviteNome.trim()
    const trimmedEmail = inviteEmail.trim().toLowerCase()

    if (!trimmedNome || !trimmedEmail) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o e-mail corporativo do convidado.',
      })
      return
    }

    setIsSendingInvite(true)
    try {
      const isRep = invitePerfil === 'Representante'
      const permissoes: PermissoesUsuario = {
        marcas_permitidas: inviteMarcas.length > 0 ? inviteMarcas : marcas.map((m) => m.id),
        papeis_por_marca: isRep
          ? inviteMarcas.reduce<Record<string, PapelMarca>>((acc, mId) => {
              acc[mId] = 'Representante'
              return acc
            }, {})
          : invitePapeisPorMarca,
        escopo_visibilidade: isRep ? 'proprios' : inviteEscopo,
        pode_conciliar: isRep ? false : invitePodeConciliar,
        pode_importar: isRep ? false : invitePodeImportar,
      }

      // Chama o hook server-side `/backend/v1/convidar-usuario`
      const res = await pb.send<{
        success: boolean
        user_id: string
        email_enviado: boolean
        message: string
      }>('/backend/v1/convidar-usuario', {
        method: 'POST',
        body: {
          nome: trimmedNome,
          email: trimmedEmail,
          perfil_global: invitePerfil,
          permissoes,
        },
      })

      toast({
        title: 'Convite processado com sucesso!',
        description: res.email_enviado
          ? `E-mail enviado para ${trimmedEmail} para definição de senha.`
          : `Usuário cadastrado com sucesso. E-mail pronto para ativação.`,
      })

      setIsInviteModalOpen(false)
      setInviteNome('')
      setInviteEmail('')
      loadData()
    } catch (err: unknown) {
      console.error('Erro ao enviar convite:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao convidar usuário'
      toast({
        variant: 'destructive',
        title: 'Erro no envio do convite',
        description: msg,
      })
    } finally {
      setIsSendingInvite(false)
    }
  }

  // Filtragem de usuários
  const filteredUsers = usuarios.filter((u) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.perfil_global?.toLowerCase().includes(q)
    )
  })

  if (!isAdmin) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-6 flex items-center space-x-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Acesso Restrito</p>
            <p className="text-xs text-amber-800">
              Apenas administradores corporativos podem gerenciar usuários, convites e permissões de
              acesso.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#017848]" />
            Usuários e Acessos
          </h2>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Gestão RBAC multi-marca: convide colaboradores por e-mail, configure a matriz de papéis
            e defina limites de visibilidade e conciliação comercial.
          </p>
        </div>

        <Button
          onClick={() => {
            setInviteMarcas(marcas.map((m) => m.id))
            setIsInviteModalOpen(true)
          }}
          size="sm"
          className="text-xs font-bold bg-[#017848] hover:bg-[#01653c] text-white shadow-xs self-start sm:self-auto rounded-xl"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          Convidar Usuário
        </Button>
      </div>

      {/* FILTRO E BUSCA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail ou perfil..."
            className="pl-9 h-9 text-xs bg-white rounded-xl border-[#D5DBDB]"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="h-8 text-xs text-slate-600 hover:text-slate-900 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Recarregar
          </Button>
          <span className="font-bold text-slate-700">{filteredUsers.length} usuários</span>
        </div>
      </div>

      {/* TABELA DE USUÁRIOS */}
      <Card className="border-[#E3E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-xs text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#017848] mb-2" />
            Carregando usuários e permissões...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] border-b border-[#E3E7EB] text-[10px] uppercase font-bold tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Papel Global</th>
                  <th className="px-4 py-3">Marcas Permitidas</th>
                  <th className="px-4 py-3">Escopo de Negócios</th>
                  <th className="px-4 py-3 text-center">Permissões Extras</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EB]/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Nenhum usuário localizado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isAtivo = u.ativo !== false
                    const perms = u.permissoes || {}
                    const allowedBrandsCount = perms.marcas_permitidas?.length ?? marcas.length
                    const allBrands = allowedBrandsCount >= marcas.length
                    const escopoLabel =
                      perms.escopo_visibilidade === 'marca_inteira'
                        ? 'Toda a Marca'
                        : perms.escopo_visibilidade === 'equipe'
                          ? 'Equipe'
                          : 'Próprios Negócios'

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#017848] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                              {u.name ? u.name.slice(0, 2).toUpperCase() : 'US'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {u.name || 'Sem nome'}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            className={cn(
                              'text-[10px] font-bold rounded-full',
                              u.perfil_global === 'Administrador'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.perfil_global === 'Supervisor'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : u.perfil_global === 'Diretoria'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : u.perfil_global === 'Representante'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            )}
                          >
                            {u.perfil_global || 'Vendedor'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-700 font-medium">
                              {allBrands ? 'Todas as 5 marcas' : `${allowedBrandsCount} marca(s)`}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-slate-700">{escopoLabel}</span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {perms.pode_conciliar && (
                              <Badge
                                title="Pode aprovar conciliações"
                                className="bg-sky-50 text-sky-700 border-sky-200 text-[9px] rounded-md px-1.5"
                              >
                                Conciliação
                              </Badge>
                            )}
                            {perms.pode_importar && (
                              <Badge
                                title="Pode importar bases"
                                className="bg-teal-50 text-teal-700 border-teal-200 text-[9px] rounded-md px-1.5"
                              >
                                Importação
                              </Badge>
                            )}
                            {!perms.pode_conciliar && !perms.pode_importar && (
                              <span className="text-[10px] text-slate-400">Padrão</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <Badge
                            className={cn(
                              'text-[10px] rounded-full',
                              isAtivo
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200',
                            )}
                          >
                            {isAtivo ? 'Ativo' : 'Desativado'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditUser(u)}
                              className="text-xs h-7 rounded-lg border-[#D5DBDB]"
                            >
                              Matriz de Acessos
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleUserActive(u)}
                              className={cn(
                                'text-xs h-7 px-2 rounded-lg font-semibold',
                                isAtivo
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-emerald-700 hover:bg-emerald-50',
                              )}
                            >
                              {isAtivo ? 'Desativar' : 'Reativar'}
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

      {/* HISTÓRICO DE CONVITES PENDENTES / ENVIADOS */}
      {convites.length > 0 && (
        <Card className="border-[#E3E7EB] bg-white rounded-2xl shadow-xs p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-500" />
              Histórico de Convites Emitidos ({convites.length})
            </h3>
          </div>

          <div className="space-y-2">
            {convites.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{c.nome}</span>{' '}
                  <span className="text-slate-500 font-mono text-[11px]">({c.email})</span>
                  <Badge className="ml-2 bg-slate-200 text-slate-700 text-[9px] rounded-full">
                    {c.perfil_global}
                  </Badge>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                  <span>Enviado em: {formatDateBR(c.created)}</span>
                  <Badge
                    className={cn(
                      'text-[9px] rounded-full',
                      c.status === 'Aceito'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200',
                    )}
                  >
                    {c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MODAL CONVIDAR NOVO USUÁRIO */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#017848]" />
              Convidar Colaborador por E-mail
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              O colaborador receberá um e-mail para cadastrar sua senha com acesso direto ao Nexus
              CRM.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nome Completo</Label>
                <Input
                  required
                  value={inviteNome}
                  onChange={(e) => setInviteNome(e.target.value)}
                  placeholder="ex: Marina Vasconcelos"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">E-mail Corporativo</Label>
                <Input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ex: marina.v@ntc.ind.br"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Papel Global</Label>
              <Select
                value={invitePerfil}
                onValueChange={(val) => {
                  const p = val as PerfilGlobal
                  setInvitePerfil(p)
                  if (p === 'Representante') {
                    setInviteEscopo('proprios')
                    setInvitePodeConciliar(false)
                    setInvitePodeImportar(false)
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Vendedor">Vendedor (operacional)</SelectItem>
                  <SelectItem value="Supervisor">Supervisor de Equipe</SelectItem>
                  <SelectItem value="Representante">
                    Representante (externo — escopo fixo: próprios negócios e contatos)
                  </SelectItem>
                  <SelectItem value="Administrador">Administrador de Marca / Sistema</SelectItem>
                  <SelectItem value="Diretoria">Diretoria (leitura consolidada)</SelectItem>
                </SelectContent>
              </Select>
              {invitePerfil === 'Representante' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                  <strong>Regra de Acesso:</strong> O perfil Representante possui escopo de
                  visibilidade <strong>FIXO em "Próprios"</strong> (vê apenas negócios e contatos
                  que ele mesmo cadastrou nas marcas autorizadas). Não acessa Consolidado,
                  Conciliação, Importação, Preferências nem Painéis &amp; Relatórios.
                </p>
              )}
            </div>

            {/* SELEÇÃO DE MARCAS PERMITIDAS */}
            <div className="space-y-2 p-3 bg-slate-50 border border-[#E3E7EB] rounded-xl">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800">Marcas com Acesso</Label>
                <button
                  type="button"
                  onClick={() => {
                    if (inviteMarcas.length === marcas.length) {
                      setInviteMarcas([])
                    } else {
                      setInviteMarcas(marcas.map((m) => m.id))
                    }
                  }}
                  className="text-[11px] text-[#017848] hover:underline font-semibold"
                >
                  {inviteMarcas.length === marcas.length ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {marcas.map((m) => {
                  const isChecked = inviteMarcas.includes(m.id)
                  return (
                    <label
                      key={m.id}
                      className={cn(
                        'flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors',
                        isChecked
                          ? 'bg-white border-[#017848]'
                          : 'bg-slate-100/60 border-slate-200',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInviteMarcas([...inviteMarcas, m.id])
                          } else {
                            setInviteMarcas(inviteMarcas.filter((id) => id !== m.id))
                          }
                        }}
                        className="rounded text-[#017848] focus:ring-[#017848]"
                      />
                      <span className="font-semibold text-slate-800">{m.nome}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* LIMITES E ESCOPO */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-[#E3E7EB] rounded-xl">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Escopo de Negócios</Label>
                <Select
                  disabled={invitePerfil === 'Representante'}
                  value={invitePerfil === 'Representante' ? 'proprios' : inviteEscopo}
                  onValueChange={(val) =>
                    setInviteEscopo(val as 'proprios' | 'equipe' | 'marca_inteira')
                  }
                >
                  <SelectTrigger className="h-8 text-xs bg-white rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="proprios">Vê apenas os próprios negócios</SelectItem>
                    <SelectItem value="equipe">Vê negócios da equipe</SelectItem>
                    <SelectItem value="marca_inteira">Vê toda a marca</SelectItem>
                  </SelectContent>
                </Select>
                {invitePerfil === 'Representante' && (
                  <span className="text-[10px] text-slate-500">
                    Fixo em 'Próprios' para Representante
                  </span>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Aprovar Conciliações</span>
                  <Switch
                    disabled={invitePerfil === 'Representante'}
                    checked={invitePerfil === 'Representante' ? false : invitePodeConciliar}
                    onCheckedChange={setInvitePodeConciliar}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Importar Bases</span>
                  <Switch
                    disabled={invitePerfil === 'Representante'}
                    checked={invitePerfil === 'Representante' ? false : invitePodeImportar}
                    onCheckedChange={setInvitePodeImportar}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-xs rounded-xl border-[#E3E7EB]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSendingInvite}
                className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
              >
                {isSendingInvite ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Processando Convite...
                  </>
                ) : (
                  'Emitir Convite por E-mail'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR MATRIZ DE ACESSOS */}
      <Dialog open={isEditUserModalOpen} onOpenChange={setIsEditUserModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#017848]" />
              Matriz de Acessos: {selectedUser?.name || selectedUser?.email}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure os papéis específicos deste colaborador por marca e seus limites
              operacionais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Papel Global no Nexus</Label>
              <Select
                value={editPerfilGlobal}
                onValueChange={(val) => {
                  const p = val as PerfilGlobal
                  setEditPerfilGlobal(p)
                  if (p === 'Representante') {
                    setEditEscopo('proprios')
                    setEditPodeConciliar(false)
                    setEditPodeImportar(false)
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Vendedor">Vendedor (operacional)</SelectItem>
                  <SelectItem value="Supervisor">Supervisor de Equipe</SelectItem>
                  <SelectItem value="Representante">
                    Representante (externo — escopo fixo: próprios)
                  </SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Diretoria">Diretoria (somente leitura consolidada)</SelectItem>
                </SelectContent>
              </Select>
              {editPerfilGlobal === 'Representante' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                  <strong>Regra de Acesso:</strong> Representante possui escopo de visibilidade{' '}
                  <strong>FIXO em "Próprios"</strong>. Não acessa Consolidado, Conciliação,
                  Importação, Preferências nem Painéis &amp; Relatórios.
                </p>
              )}
            </div>

            {/* MATRIZ DE MARCAS COM PAPEL INDIVIDUAL */}
            <div className="space-y-2 p-3 bg-slate-50 border border-[#E3E7EB] rounded-xl">
              <Label className="text-xs font-bold text-slate-800">
                Matriz Usuário × Marca (Papel Específico)
              </Label>
              <p className="text-[11px] text-slate-500">
                Define qual marca o usuário pode visualizar e qual o nível de autoridade em cada
                uma.
              </p>

              <div className="space-y-2 pt-2">
                {marcas.map((m) => {
                  const hasAccess = editMarcas.includes(m.id)
                  const currentRole = editPapeisPorMarca[m.id] || (editPerfilGlobal as PapelMarca)

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'p-2.5 rounded-xl border flex items-center justify-between gap-3',
                        hasAccess
                          ? 'bg-white border-[#017848]/60 shadow-2xs'
                          : 'bg-slate-100/60 border-slate-200 opacity-60',
                      )}
                    >
                      <label className="flex items-center space-x-2 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={hasAccess}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditMarcas([...editMarcas, m.id])
                            } else {
                              setEditMarcas(editMarcas.filter((id) => id !== m.id))
                            }
                          }}
                          className="rounded text-[#017848] focus:ring-[#017848]"
                        />
                        <span className="font-bold text-slate-900 truncate">{m.nome}</span>
                      </label>

                      {hasAccess && (
                        <div className="w-44">
                          <Select
                            value={currentRole}
                            onValueChange={(val) =>
                              setEditPapeisPorMarca({
                                ...editPapeisPorMarca,
                                [m.id]: val as PapelMarca,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs bg-white rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="Vendedor">Vendedor</SelectItem>
                              <SelectItem value="Supervisor">Supervisor</SelectItem>
                              <SelectItem value="Representante">Representante</SelectItem>
                              <SelectItem value="Administrador de marca">Admin da Marca</SelectItem>
                              <SelectItem value="Diretoria">Diretoria (Read-only)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* LIMITES E ESCOPO */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-[#E3E7EB] rounded-xl">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Escopo de Negócios</Label>
                <Select
                  disabled={editPerfilGlobal === 'Representante'}
                  value={editPerfilGlobal === 'Representante' ? 'proprios' : editEscopo}
                  onValueChange={(val) =>
                    setEditEscopo(val as 'proprios' | 'equipe' | 'marca_inteira')
                  }
                >
                  <SelectTrigger className="h-8 text-xs bg-white rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="proprios">Vê apenas os próprios negócios</SelectItem>
                    <SelectItem value="equipe">Vê negócios da equipe</SelectItem>
                    <SelectItem value="marca_inteira">Vê toda a marca</SelectItem>
                  </SelectContent>
                </Select>
                {editPerfilGlobal === 'Representante' && (
                  <span className="text-[10px] text-slate-500">
                    Fixo em 'Próprios' para Representante
                  </span>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Aprovar Conciliações</span>
                  <Switch
                    disabled={editPerfilGlobal === 'Representante'}
                    checked={editPerfilGlobal === 'Representante' ? false : editPodeConciliar}
                    onCheckedChange={setEditPodeConciliar}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Importar Bases</span>
                  <Switch
                    disabled={editPerfilGlobal === 'Representante'}
                    checked={editPerfilGlobal === 'Representante' ? false : editPodeImportar}
                    onCheckedChange={setEditPodeImportar}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditUserModalOpen(false)}
              className="text-xs rounded-xl border-[#E3E7EB]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingUser}
              onClick={handleSaveUserPermissions}
              className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
            >
              {isSavingUser ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Permissões'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default UsuariosAcessosConfig
