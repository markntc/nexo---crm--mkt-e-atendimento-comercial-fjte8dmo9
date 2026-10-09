// src/components/QuickActionModal.tsx
import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from '@/hooks/use-toast'
import { isValidCPF, isValidCNPJ, maskCPF, maskCNPJ, maskPhone } from '@/lib/formatters'
import { getEtapaNome } from '@/lib/relationshipStatus'
import type { Funil, Organizacao, Pessoa, Oportunidade } from '@/types'
import { AddDealModal } from '@/components/AddDealModal'

export type QuickActionType =
  | 'lead'
  | 'negocio'
  | 'pessoa'
  | 'organizacao'
  | 'nota'
  | 'tarefa'
  | null

interface QuickActionModalProps {
  type: QuickActionType
  onClose: () => void
  onSuccess?: () => void
}

export function QuickActionModal({ type, onClose, onSuccess }: QuickActionModalProps) {
  const { user } = useAuth()
  const { marcas, activeBrand } = useBrand()
  const isDealAction = type === 'negocio'

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Marca contextualizada: se activeBrand estiver definida, usa ela; caso contrário, primeira marca
  const defaultMarcaId = activeBrand?.id || (marcas[0]?.id ?? '')
  const [selectedMarcaId, setSelectedMarcaId] = useState(defaultMarcaId)

  // Listas auxiliares para selects
  const [funis, setFunis] = useState<Funil[]>([])
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])

  // Formulário: Lead
  const [leadOrigem, setLeadOrigem] = useState<
    'Formulário Web' | 'Landing Page' | 'Indicação' | 'WhatsApp' | 'Feira' | 'Importação' | 'Outro'
  >('WhatsApp')
  const [leadDadosContato, setLeadDadosContato] = useState('')
  const [leadStatus, setLeadStatus] = useState<
    'Novo' | 'Qualificado' | 'Desqualificado' | 'Convertido'
  >('Novo')
  const [leadOrgId, setLeadOrgId] = useState('')
  const [leadPessoaId, setLeadPessoaId] = useState('')

  // Formulário: Negócio
  const [negTitulo, setNegTitulo] = useState('')
  const [negValor, setNegValor] = useState<number>(0)
  const [negFunilId, setNegFunilId] = useState('')
  const [negEtapa, setNegEtapa] = useState('')
  const [negOrgId, setNegOrgId] = useState('')
  const [negPessoaId, setNegPessoaId] = useState('')
  const [negDocFaturamento, setNegDocFaturamento] = useState<'' | 'CPF' | 'CNPJ' | 'AMBOS'>('')
  const [negProxData, setNegProxData] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
  )
  const [negProxDesc, setNegProxDesc] = useState('Primeiro contato de alinhamento comercial')

  // Formulário: Pessoa
  const [pesNome, setPesNome] = useState('')
  const [pesCpf, setPesCpf] = useState('')
  const [pesEmail, setPesEmail] = useState('')
  const [pesTelefone, setPesTelefone] = useState('')
  const [pesOrgId, setPesOrgId] = useState('')
  const [pesCargo, setPesCargo] = useState('')
  const [pesDepto, setPesDepto] = useState('')

  // Formulário: Organização
  const [orgRazao, setOrgRazao] = useState('')
  const [orgFantasia, setOrgFantasia] = useState('')
  const [orgCnpj, setOrgCnpj] = useState('')
  const [orgEmail, setOrgEmail] = useState('')
  const [orgTelefone, setOrgTelefone] = useState('')
  const [orgEndereco, setOrgEndereco] = useState('')

  // Formulário: Nota (Auditoria / Histórico)
  const [notaEntidade, setNotaEntidade] = useState<'oportunidades' | 'organizacoes' | 'pessoas'>(
    'oportunidades',
  )
  const [notaEntidadeId, setNotaEntidadeId] = useState('')
  const [notaTexto, setNotaTexto] = useState('')

  // Formulário: Tarefa / Atividade
  const [tarOppId, setTarOppId] = useState('')
  const [tarTipo, setTarTipo] = useState<
    'Ligação' | 'Reunião' | 'Visita' | 'E-mail' | 'WhatsApp' | 'Outro'
  >('Ligação')
  const [tarDescricao, setTarDescricao] = useState('')
  const [tarVencimento, setTarVencimento] = useState(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
  )

  useEffect(() => {
    setSelectedMarcaId(activeBrand?.id || (marcas[0]?.id ?? ''))
  }, [activeBrand, marcas])

  // Carregar dados de apoio
  useEffect(() => {
    if (!type) return

    const loadData = async () => {
      try {
        const brandFilter = selectedMarcaId ? `marca_id = "${selectedMarcaId}"` : undefined
        const brandCapturaFilter = selectedMarcaId
          ? `marca_captura_id = "${selectedMarcaId}"`
          : undefined

        const [funisRes, orgsRes, pessoasRes, oppsRes] = await Promise.all([
          pb
            .collection('funis')
            .getFullList<Funil>({
              filter: brandFilter,
              sort: 'nome_funil',
            })
            .catch(() => []),
          pb
            .collection('organizacoes')
            .getFullList<Organizacao>({
              filter: brandCapturaFilter,
              sort: 'razao_social',
            })
            .catch(() => []),
          pb
            .collection('pessoas')
            .getFullList<Pessoa>({
              filter: brandCapturaFilter,
              sort: 'nome_completo',
            })
            .catch(() => []),
          pb
            .collection('oportunidades')
            .getFullList<Oportunidade>({
              filter: brandFilter,
              sort: '-created',
              limit: 50,
            })
            .catch(() => []),
        ])

        setFunis(funisRes)
        setOrganizacoes(orgsRes)
        setPessoas(pessoasRes)
        setOportunidades(oppsRes)

        if (funisRes.length > 0) {
          setNegFunilId(funisRes[0].id)
          if (funisRes[0].etapas_ordenadas && funisRes[0].etapas_ordenadas.length > 0) {
            setNegEtapa(getEtapaNome(funisRes[0].etapas_ordenadas[0]))
          }
        }
        if (oppsRes.length > 0) {
          setTarOppId(oppsRes[0].id)
          setNotaEntidadeId(oppsRes[0].id)
        }
      } catch (err) {
        console.error('Erro ao carregar dados auxiliares:', err)
      }
    }

    loadData()
  }, [type, selectedMarcaId])

  // Ajusta etapa quando muda o funil
  const handleFunilChange = (fId: string) => {
    setNegFunilId(fId)
    const sel = funis.find((f) => f.id === fId)
    if (sel && sel.etapas_ordenadas?.length) {
      setNegEtapa(getEtapaNome(sel.etapas_ordenadas[0]))
    }
  }

  if (!type) return null

  const getTitle = () => {
    switch (type) {
      case 'lead':
        return 'Criar Novo Lead'
      case 'negocio':
        return 'Criar Novo Negócio'
      case 'pessoa':
        return 'Criar Nova Pessoa'
      case 'organizacao':
        return 'Criar Nova Organização'
      case 'nota':
        return 'Adicionar Nova Nota'
      case 'tarefa':
        return 'Agendar Nova Tarefa'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const marcaId = selectedMarcaId || activeBrand?.id || (marcas[0]?.id ?? '')
      if (!marcaId) {
        throw new Error('Selecione uma marca para contextualizar a criação.')
      }

      if (type === 'lead') {
        if (!leadDadosContato.trim()) {
          throw new Error('Informe os dados de contato do Lead.')
        }
        await pb.collection('leads').create({
          marca_id: marcaId,
          origem: leadOrigem,
          dados_contato: leadDadosContato.trim(),
          status_qualificacao: leadStatus,
          cliente_b2b_id: leadOrgId || null,
          cliente_b2c_id: leadPessoaId || null,
          criado_por_id: user?.id,
        })
        toast({
          title: 'Lead criado com sucesso',
          description: 'Registro de prospecção inserido na base da marca.',
        })
      } else if (type === 'negocio') {
        await pb.collection('oportunidades').create({
          marca_id: marcaId,
          funil_id: negFunilId || null,
          titulo: negTitulo.trim() || 'Novo negócio',
          valor_estimado: Number(negValor) || 0,
          etapa_atual: negEtapa || 'Lead Recebido',
          vendedor_id: user?.id,
          cliente_b2b_id: negOrgId || null,
          cliente_b2c_id: negPessoaId || null,
          documento_faturamento: negDocFaturamento || null,
          proxima_acao_data: negProxData ? new Date(negProxData).toISOString() : null,
          proxima_acao_descricao: negProxDesc.trim() || null,
        })
        toast({
          title: 'Negócio criado com sucesso',
          description: 'Oportunidade inserida na esteira de vendas.',
        })
      } else if (type === 'pessoa') {
        const cleanCpf = pesCpf.replace(/\D/g, '')
        if (cleanCpf && !isValidCPF(cleanCpf)) {
          throw new Error('O CPF informado possui dígitos verificadores inválidos.')
        }
        // Deduplicação inteligente se CPF informado
        if (cleanCpf) {
          const existente = await pb
            .collection('pessoas')
            .getFullList({
              filter: `cpf = "${cleanCpf}"`,
              limit: 1,
            })
            .catch(() => [])
          if (existente.length > 0) {
            throw new Error(
              `Já existe uma pessoa cadastrada com este CPF: "${existente[0].nome_completo}".`,
            )
          }
        }
        try {
          await pb.collection('pessoas').create({
            marca_captura_id: marcaId,
            cpf: cleanCpf ? maskCPF(cleanCpf) : null,
            nome_completo: pesNome.trim() || 'Sem nome informado',
            email_principal: pesEmail.trim() || null,
            telefone: pesTelefone ? maskPhone(pesTelefone) : null,
            origem_sistema: 'Ação Rápida Pipedrive NTC',
            data_criacao: new Date().toISOString(),
            criado_por_id: user?.id,
            organizacao_id: pesOrgId || null,
            cargo: pesCargo.trim() || null,
            departamento: pesDepto.trim() || null,
          })
        } catch (pesErr: any) {
          const errStr = JSON.stringify(pesErr || '')
          if (errStr.includes('idx_pessoas_cpf_unique') || errStr.includes('cpf')) {
            throw new Error('Já existe uma pessoa cadastrada com este CPF no sistema.')
          }
          throw pesErr
        }
        toast({
          title: 'Pessoa criada com sucesso',
          description: 'Registro individual adicionado à base de contatos.',
        })
      } else if (type === 'organizacao') {
        const cleanCnpj = orgCnpj.replace(/\D/g, '')
        if (cleanCnpj && !isValidCNPJ(cleanCnpj)) {
          throw new Error('O CNPJ informado possui dígitos verificadores inválidos.')
        }
        // Deduplicação inteligente se CNPJ informado
        if (cleanCnpj) {
          const existente = await pb
            .collection('organizacoes')
            .getFullList({
              filter: `cnpj = "${cleanCnpj}"`,
              limit: 1,
            })
            .catch(() => [])
          if (existente.length > 0) {
            throw new Error(
              `Já existe uma organização cadastrada com este CNPJ: "${existente[0].razao_social}".`,
            )
          }
        }
        try {
          await pb.collection('organizacoes').create({
            marca_captura_id: marcaId,
            cnpj: cleanCnpj ? maskCNPJ(cleanCnpj) : null,
            razao_social: orgRazao.trim() || 'Sem razão social informada',
            nome_fantasia: orgFantasia.trim() || null,
            email_principal: orgEmail.trim() || null,
            telefone: orgTelefone ? maskPhone(orgTelefone) : null,
            endereco_corporativo: orgEndereco.trim() || null,
            origem_sistema: 'Ação Rápida Pipedrive NTC',
            data_criacao: new Date().toISOString(),
            criado_por_id: user?.id,
          })
        } catch (orgErr: any) {
          const errStr = JSON.stringify(orgErr || '')
          if (errStr.includes('idx_organizacoes_cnpj_unique') || errStr.includes('cnpj')) {
            throw new Error('Já existe uma organização com este CNPJ no sistema.')
          }
          throw orgErr
        }
        toast({
          title: 'Organização criada com sucesso',
          description: 'Empresa cadastrada na base de organizações.',
        })
      } else if (type === 'nota') {
        if (!notaEntidadeId) {
          throw new Error('Selecione o registro de destino para a nota.')
        }
        // Registra como nota de auditoria append-only
        await pb.collection('logs_auditoria').create({
          marca_id: marcaId,
          usuario_id: user?.id,
          entidade: notaEntidade,
          entidade_id: notaEntidadeId,
          dados_anteriores: null,
          dados_novos: {
            tipo: 'nota_rapida',
            conteudo: notaTexto.trim() || 'Nota sem texto',
            autor: user?.name || user?.email,
          },
          timestamp: new Date().toISOString(),
        })
        toast({
          title: 'Nota registrada com sucesso',
          description: 'Nota vinculada ao histórico com rastreabilidade.',
        })
      } else if (type === 'tarefa') {
        await pb.collection('atividades').create({
          marca_id: marcaId,
          oportunidade_id: tarOppId || null,
          responsavel_id: user?.id,
          tipo: tarTipo,
          descricao: tarDescricao.trim() || 'Atividade comercial',
          data_vencimento: tarVencimento ? new Date(tarVencimento).toISOString() : null,
          concluida: false,
        })
        toast({
          title: 'Tarefa agendada',
          description: 'Atividade comercial agendada com sucesso.',
        })
      }

      onClose()
      if (onSuccess) onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar ação rápida.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isDealAction) {
    return (
      <AddDealModal
        open={true}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose()
        }}
        onSuccess={() => {
          onClose()
          if (onSuccess) onSuccess()
        }}
      />
    )
  }

  return (
    <Dialog open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-900">{getTitle()}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
              {errorMessage}
            </div>
          )}

          {/* Contexto de Marca (Obrigatório) */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">
              Marca Contextualizada <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedMarcaId} onValueChange={setSelectedMarcaId}>
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

          {/* FORM: LEAD */}
          {type === 'lead' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Origem do Lead</Label>
                <Select
                  value={leadOrigem}
                  onValueChange={(v) => setLeadOrigem(v as typeof leadOrigem)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Formulário Web">Formulário Web</SelectItem>
                    <SelectItem value="Landing Page">Landing Page</SelectItem>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                    <SelectItem value="Feira">Feira</SelectItem>
                    <SelectItem value="Importação">Importação</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Dados de Contato / Descrição da Demanda{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Textarea
                  placeholder="Nome do solicitante, e-mail, telefone e interesse (opcional)..."
                  value={leadDadosContato}
                  onChange={(e) => setLeadDadosContato(e.target.value)}
                  className="text-xs rounded-xl min-h-[80px]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Status Inicial</Label>
                <Select
                  value={leadStatus}
                  onValueChange={(v) => setLeadStatus(v as typeof leadStatus)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Qualificado">Qualificado</SelectItem>
                    <SelectItem value="Desqualificado">Desqualificado</SelectItem>
                    <SelectItem value="Convertido">Convertido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">
                    Vincular Organização (Opcional)
                  </Label>
                  <Select
                    value={leadOrgId}
                    onValueChange={(v) => setLeadOrgId(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {organizacoes.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">
                    Vincular Pessoa (Opcional)
                  </Label>
                  <Select
                    value={leadPessoaId}
                    onValueChange={(v) => setLeadPessoaId(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {pessoas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* FORM: PESSOA */}
          {type === 'pessoa' && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-600">
                    CPF <span className="text-slate-400 font-normal">(opcional)</span>
                  </Label>
                  {pesCpf && (
                    <span
                      className={`text-[10px] font-bold ${isValidCPF(pesCpf) ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {isValidCPF(pesCpf) ? 'CPF Válido' : 'CPF Inválido'}
                    </span>
                  )}
                </div>
                <Input
                  placeholder="000.000.000-00 (opcional)"
                  value={pesCpf}
                  onChange={(e) => setPesCpf(maskCPF(e.target.value))}
                  className="h-9 text-xs font-mono rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Nome Completo <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  placeholder="Nome e Sobrenome (opcional)"
                  value={pesNome}
                  onChange={(e) => setPesNome(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com.br"
                    value={pesEmail}
                    onChange={(e) => setPesEmail(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={pesTelefone}
                    onChange={(e) => setPesTelefone(maskPhone(e.target.value))}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Vincular a uma Organização (Opcional)
                </Label>
                <Select value={pesOrgId} onValueChange={(v) => setPesOrgId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Pessoa independente (sem vínculo)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">Pessoa independente (sem vínculo)</SelectItem>
                    {organizacoes.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Cargo</Label>
                  <Input
                    placeholder="ex: Gerente de Compras"
                    value={pesCargo}
                    onChange={(e) => setPesCargo(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Departamento</Label>
                  <Input
                    placeholder="ex: Suprimentos"
                    value={pesDepto}
                    onChange={(e) => setPesDepto(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            </>
          )}

          {/* FORM: ORGANIZAÇÃO */}
          {type === 'organizacao' && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-600">
                    CNPJ <span className="text-slate-400 font-normal">(opcional)</span>
                  </Label>
                  {orgCnpj && (
                    <span
                      className={`text-[10px] font-bold ${isValidCNPJ(orgCnpj) ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {isValidCNPJ(orgCnpj) ? 'CNPJ Válido' : 'CNPJ Inválido'}
                    </span>
                  )}
                </div>
                <Input
                  placeholder="00.000.000/0000-00 (opcional)"
                  value={orgCnpj}
                  onChange={(e) => setOrgCnpj(maskCNPJ(e.target.value))}
                  className="h-9 text-xs font-mono rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Razão Social <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  placeholder="Nome empresarial formal (opcional)"
                  value={orgRazao}
                  onChange={(e) => setOrgRazao(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Nome Fantasia</Label>
                <Input
                  placeholder="Nome comercial"
                  value={orgFantasia}
                  onChange={(e) => setOrgFantasia(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="contato@empresa.com.br"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Telefone</Label>
                  <Input
                    placeholder="(00) 0000-0000"
                    value={orgTelefone}
                    onChange={(e) => setOrgTelefone(maskPhone(e.target.value))}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Endereço Corporativo</Label>
                <Input
                  placeholder="Logradouro, número, cidade - UF"
                  value={orgEndereco}
                  onChange={(e) => setOrgEndereco(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </>
          )}

          {/* FORM: NOTA */}
          {type === 'nota' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Vincular Nota a</Label>
                <Select
                  value={notaEntidade}
                  onValueChange={(v) =>
                    setNotaEntidade(v as 'oportunidades' | 'organizacoes' | 'pessoas')
                  }
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="oportunidades">Negócio / Oportunidade</SelectItem>
                    <SelectItem value="organizacoes">Organização</SelectItem>
                    <SelectItem value="pessoas">Pessoa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Registro Destino</Label>
                <Select value={notaEntidadeId} onValueChange={setNotaEntidadeId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione o registro..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {notaEntidade === 'oportunidades' &&
                      oportunidades.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.titulo}
                        </SelectItem>
                      ))}
                    {notaEntidade === 'organizacoes' &&
                      organizacoes.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.razao_social}
                        </SelectItem>
                      ))}
                    {notaEntidade === 'pessoas' &&
                      pessoas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_completo}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Conteúdo da Nota <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Textarea
                  placeholder="Escreva suas anotações, resumo da conversa ou pontos de atenção (opcional)..."
                  value={notaTexto}
                  onChange={(e) => setNotaTexto(e.target.value)}
                  className="text-xs rounded-xl min-h-[100px]"
                />
              </div>
            </>
          )}

          {/* FORM: TAREFA */}
          {type === 'tarefa' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Negócio Associado <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Select value={tarOppId} onValueChange={setTarOppId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione o negócio (opcional)..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {oportunidades.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Tipo de Atividade</Label>
                  <Select value={tarTipo} onValueChange={(v) => setTarTipo(v as typeof tarTipo)}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
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
                  <Label className="text-xs font-semibold text-slate-600">
                    Data de Vencimento{' '}
                    <span className="text-slate-400 font-normal">(opcional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={tarVencimento}
                    onChange={(e) => setTarVencimento(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Descrição da Tarefa <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  placeholder="ex: Ligar para confirmar recebimento (opcional)"
                  value={tarDescricao}
                  onChange={(e) => setTarDescricao(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
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
              {isSubmitting ? 'Salvando...' : 'Salvar Registro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
