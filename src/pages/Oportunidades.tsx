// src/pages/Oportunidades.tsx
import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type { Oportunidade, Funil, Equipe } from '@/types'
import { OpportunityDrawer } from '@/components/OpportunityDrawer'
import { formatCurrencyBRL, formatDateBR, getFollowUpStatus } from '@/lib/formatters'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Briefcase,
  Plus,
  Search,
  Building2,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  KanbanSquare,
} from 'lucide-react'

export default function Oportunidades() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { marcas, activeBrand, isConsolidated } = useBrand()

  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [funis, setFunis] = useState<Funil[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFunilFilter, setSelectedFunilFilter] = useState<string>('all')
  const [selectedEquipeFilter, setSelectedEquipeFilter] = useState<string>('all')

  const selectedOppId = searchParams.get('oppId')

  const fetchOpps = async () => {
    setIsLoading(true)
    try {
      let filter = ''
      if (activeBrand) {
        filter = `marca_id = "${activeBrand.id}"`
      }
      if (selectedFunilFilter !== 'all') {
        filter = filter
          ? `${filter} && funil_id = "${selectedFunilFilter}"`
          : `funil_id = "${selectedFunilFilter}"`
      }
      if (selectedEquipeFilter !== 'all') {
        filter = filter
          ? `${filter} && equipe_id = "${selectedEquipeFilter}"`
          : `equipe_id = "${selectedEquipeFilter}"`
      }
      if (searchTerm.trim()) {
        const clean = searchTerm.trim().replace(/['"]/g, '')
        const q = `titulo ~ "${clean}"`
        filter = filter ? `${filter} && (${q})` : q
      }

      const [oppRes, funisRes, equipesRes] = await Promise.all([
        pb.collection('oportunidades').getFullList<Oportunidade>({
          filter: filter || undefined,
          expand: 'marca_id,funil_id,equipe_id,cliente_b2b_id,cliente_b2c_id,vendedor_id',
          sort: '-created',
        }),
        pb.collection('funis').getFullList<Funil>({
          filter: activeBrand ? `marca_id = "${activeBrand.id}"` : undefined,
          sort: 'nome_funil',
        }),
        pb.collection('equipes').getFullList<Equipe>({
          filter: activeBrand ? `marca_id = "${activeBrand.id}"` : undefined,
          sort: 'nome_equipe',
        }),
      ])

      setOportunidades(oppRes)
      setFunis(funisRes)
      setEquipes(equipesRes)
    } catch (err) {
      console.error('Erro ao buscar oportunidades:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOpps()
  }, [activeBrand, selectedFunilFilter, selectedEquipeFilter, searchTerm])

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
            Tabela Corporativa de Oportunidades
          </h1>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Visão em lista com filtros de funil, equipe comercial e trava de follow-up
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={() => navigate('/pipelines')}
            variant="outline"
            size="sm"
            className="text-xs border-[#D5DBDB]"
          >
            <KanbanSquare className="w-3.5 h-3.5 mr-1 text-[#1B4F72]" />
            Ver no Kanban
          </Button>
          <Button
            onClick={() => navigate('/pipelines?action=new')}
            size="sm"
            className="text-xs font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Funil */}
          <Select value={selectedFunilFilter} onValueChange={setSelectedFunilFilter}>
            <SelectTrigger className="h-9 text-xs w-44 bg-white border-[#D5DBDB]">
              <SelectValue placeholder="Todos os Funis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Funis</SelectItem>
              {funis.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome_funil}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Equipe */}
          {equipes.length > 0 && (
            <Select value={selectedEquipeFilter} onValueChange={setSelectedEquipeFilter}>
              <SelectTrigger className="h-9 text-xs w-44 bg-white border-[#D5DBDB]">
                <SelectValue placeholder="Todas as Equipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Equipes</SelectItem>
                {equipes.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.nome_equipe}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Busca */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#5D6D7E]" />
          <Input
            type="text"
            placeholder="Buscar por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-white border-[#D5DBDB]"
          />
        </div>
      </div>

      {/* TABELA DE OPORTUNIDADES */}
      <Card className="border-[#D5DBDB] bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-xs text-[#5D6D7E]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B4F72] mb-2" />
            Carregando negociações...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#D5DBDB] text-[10px] uppercase font-bold tracking-wider text-[#5D6D7E]">
                <tr>
                  <th className="px-4 py-3">Oportunidade</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Funil / Etapa</th>
                  <th className="px-4 py-3 text-right">Valor Estimado</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5DBDB]/60">
                {oportunidades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#5D6D7E]">
                      Nenhuma oportunidade cadastrada com estes parâmetros.
                    </td>
                  </tr>
                ) : (
                  oportunidades.map((op) => {
                    const clienteNome =
                      op.expand?.cliente_b2b_id?.razao_social ||
                      op.expand?.cliente_b2c_id?.nome_completo ||
                      'Cliente Não Vinculado'
                    const followStatus = getFollowUpStatus(op.proxima_acao_data)

                    return (
                      <tr
                        key={op.id}
                        onClick={() => {
                          searchParams.set('oppId', op.id)
                          setSearchParams(searchParams)
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#1C2833]">{op.titulo}</p>
                          {isConsolidated && op.expand?.marca_id && (
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: op.expand.marca_id.cor_destaque }}
                            >
                              {op.expand.marca_id.nome}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#5D6D7E]">
                          <div className="flex items-center space-x-1.5 truncate">
                            {op.expand?.cliente_b2b_id ? (
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                            <span className="truncate">{clienteNome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-medium text-[#1C2833]">
                              {op.expand?.funil_id?.nome_funil}
                            </p>
                            <Badge variant="outline" className="text-[10px] border-[#D5DBDB]">
                              {op.etapa_atual}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#1C2833]">
                          {formatCurrencyBRL(op.valor_estimado)}
                        </td>
                        <td className="px-4 py-3 text-[#5D6D7E]">
                          {op.expand?.vendedor_id?.name || 'Administrador NTC'}
                        </td>
                        <td className="px-4 py-3">
                          {followStatus === 'missing' && (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              Sem follow-up
                            </Badge>
                          )}
                          {followStatus === 'overdue' && (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              Vencido ({formatDateBR(op.proxima_acao_data)})
                            </Badge>
                          )}
                          {followStatus === 'soon' && (
                            <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                              Em 48h ({formatDateBR(op.proxima_acao_data)})
                            </Badge>
                          )}
                          {followStatus === 'ok' && (
                            <span className="text-[11px] text-[#5D6D7E]">
                              {formatDateBR(op.proxima_acao_data)}
                            </span>
                          )}
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

      {/* DRAWER DE DETALHES DE OPORTUNIDADE COMPARTILHADO COM KANBAN */}
      <OpportunityDrawer
        opportunityId={selectedOppId}
        onClose={() => {
          searchParams.delete('oppId')
          setSearchParams(searchParams)
        }}
        onUpdate={fetchOpps}
      />
    </div>
  )
}
