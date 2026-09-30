// src/pages/Index.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import type { Oportunidade, Atividade, Lead } from '@/types'
import { formatCurrencyBRL, formatDateBR, getFollowUpStatus } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Percent,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  Briefcase,
  Target,
  FileSpreadsheet,
  Building2,
  Calendar,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

export default function Index() {
  const navigate = useNavigate()
  const { activeBrand, isConsolidated, currentBrandColor } = useBrand()

  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      let oppFilter = ''
      let ativFilter = ''
      let leadFilter = ''

      if (activeBrand) {
        oppFilter = `marca_id = "${activeBrand.id}"`
        ativFilter = `marca_id = "${activeBrand.id}"`
        leadFilter = `marca_id = "${activeBrand.id}"`
      }

      const [oppRes, ativRes, leadRes] = await Promise.all([
        pb.collection('oportunidades').getFullList<Oportunidade>({
          filter: oppFilter || undefined,
          expand: 'marca_id,cliente_b2b_id,cliente_b2c_id,vendedor_id',
          sort: '-created',
        }),
        pb.collection('atividades').getFullList<Atividade>({
          filter: ativFilter || undefined,
          expand: 'marca_id,oportunidade_id,responsavel_id',
          sort: 'data_vencimento',
        }),
        pb.collection('leads').getFullList<Lead>({
          filter: leadFilter || undefined,
          expand: 'marca_id',
          sort: '-created',
        }),
      ])

      setOportunidades(oppRes)
      setAtividades(ativRes)
      setLeads(leadRes)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeBrand])

  // Cálculos de KPIs
  const totalOportunidades = oportunidades.length
  const valorTotalPipeline = oportunidades.reduce((sum, o) => sum + (o.valor_estimado || 0), 0)

  // Tarefas vencidas
  const now = new Date()
  const tarefasVencidas = atividades.filter((a) => {
    if (a.concluida) return false
    const due = new Date(a.data_vencimento)
    return due.getTime() < now.getTime()
  })

  // Taxa de conversão (ganhos sobre total com desfecho ou total)
  const oportunidadesGanhas = oportunidades.filter(
    (o) =>
      o.etapa_atual.toLowerCase().includes('ganho') ||
      o.etapa_atual.toLowerCase().includes('concluído'),
  ).length
  const taxaConversao =
    totalOportunidades > 0 ? ((oportunidadesGanhas / totalOportunidades) * 100).toFixed(1) : '0.0'

  // Gráfico de Valor por Etapa
  const etapaMap: Record<string, number> = {}
  const etapaCountMap: Record<string, number> = {}
  oportunidades.forEach((o) => {
    const et = o.etapa_atual || 'Outros'
    etapaMap[et] = (etapaMap[et] || 0) + (o.valor_estimado || 0)
    etapaCountMap[et] = (etapaCountMap[et] || 0) + 1
  })

  const barChartData = Object.keys(etapaMap).map((et) => ({
    etapa: et.length > 15 ? et.substring(0, 15) + '...' : et,
    etapaCompleta: et,
    valor: etapaMap[et],
  }))

  // Cores do gráfico de donut
  const DONUT_COLORS = ['#1B4F72', '#2E86C1', '#27AE60', '#E67E22', '#8E44AD', '#34495E', '#F39C12']
  const donutChartData = Object.keys(etapaCountMap).map((et) => ({
    name: et,
    value: etapaCountMap[et],
  }))

  // Gráfico de Leads por Origem
  const leadOrigemMap: Record<string, number> = {}
  leads.forEach((l) => {
    leadOrigemMap[l.origem] = (leadOrigemMap[l.origem] || 0) + 1
  })
  const leadsBarData = Object.keys(leadOrigemMap).map((origem) => ({
    origem,
    quantidade: leadOrigemMap[origem],
  }))

  // Próximas 5 tarefas pendentes
  const proximasTarefas = atividades.filter((a) => !a.concluida).slice(0, 5)

  const toggleConcluirTarefa = async (at: Atividade) => {
    try {
      await pb.collection('atividades').update(at.id, {
        concluida: !at.concluida,
      })
      fetchData()
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: isConsolidated ? '#1B4F72' : currentBrandColor }}
            />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
              {isConsolidated
                ? 'Visão Geral Consolidada — Todas as Marcas'
                : `Visão Geral — ${activeBrand?.nome}`}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Métricas executivas, pipelines comerciais ativos e atividades do CRM
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Button
            onClick={() => navigate('/importacao')}
            variant="outline"
            size="sm"
            className="text-xs h-9 border-[#D5DBDB] hover:bg-slate-100"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-[#5D6D7E]" />
            Importar
          </Button>
          <Button
            onClick={() => navigate('/negocios?action=new')}
            size="sm"
            className="text-xs h-9 font-bold text-white shadow-sm rounded-xl bg-[#017848] hover:bg-[#01653c]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* LINHA DE 4 KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card className="border-[#D5DBDB] bg-white shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: isConsolidated ? '#1B4F72' : currentBrandColor }}
          />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5D6D7E]">
                Oportunidades em Aberto
              </span>
              <div className="p-2 rounded-lg bg-blue-50 text-[#1B4F72]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-[#1C2833]">{totalOportunidades}</div>
              <p className="text-[11px] text-[#5D6D7E] mt-1">Negociações ativas nos funis</p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="border-[#D5DBDB] bg-white shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: isConsolidated ? '#1B4F72' : currentBrandColor }}
          />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5D6D7E]">
                Valor Total em Pipeline
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-[#1C2833] truncate">
                {formatCurrencyBRL(valorTotalPipeline)}
              </div>
              <p className="text-[11px] text-[#5D6D7E] mt-1">Montante total estimado</p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="border-[#D5DBDB] bg-white shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: tarefasVencidas.length > 0 ? '#E74C3C' : '#27AE60' }}
          />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5D6D7E]">
                Tarefas Vencidas
              </span>
              <div
                className={`p-2 rounded-lg ${
                  tarefasVencidas.length > 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-[#1C2833]">{tarefasVencidas.length}</div>
              <p className="text-[11px] text-[#5D6D7E] mt-1">
                Compromissos pendentes com prazo expirado
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card className="border-[#D5DBDB] bg-white shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: isConsolidated ? '#1B4F72' : currentBrandColor }}
          />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5D6D7E]">
                Taxa de Conversão
              </span>
              <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-[#1C2833]">{taxaConversao}%</div>
              <p className="text-[11px] text-[#5D6D7E] mt-1">Avanço em fechamento de vendas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS PRINCIPAIS (Valor por Etapa + Donut de Oportunidades) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Valor por Etapa */}
        <Card className="lg:col-span-2 border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
              Valor por Etapa do Funil (BRL)
            </CardTitle>
            <CardDescription className="text-xs text-[#5D6D7E]">
              Distribuição financeira das oportunidades conforme a evolução comercial
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {barChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-[#5D6D7E] text-xs">
                <Briefcase className="w-8 h-8 mb-2 stroke-1 text-slate-400" />
                <p>Nenhuma oportunidade cadastrada para esta marca ainda.</p>
                <Button
                  onClick={() => navigate('/negocios')}
                  variant="outline"
                  size="sm"
                  className="text-xs border-[#E3E7EB] rounded-xl hover:bg-slate-50"
                >
                  Ver no Funil
                </Button>{' '}
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                  >
                    <XAxis
                      dataKey="etapa"
                      tick={{ fontSize: 11, fill: '#5D6D7E' }}
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#5D6D7E' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: number) => [formatCurrencyBRL(val), 'Valor Estimado']}
                      labelFormatter={(label, item) => item[0]?.payload?.etapaCompleta || label}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #D5DBDB',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="valor"
                      fill={isConsolidated ? '#1B4F72' : currentBrandColor}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico 2: Donut Distribuição de Oportunidades */}
        <Card className="border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
              Distribuição por Etapa
            </CardTitle>
            <CardDescription className="text-xs text-[#5D6D7E]">
              Volume de negócios por fase
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {donutChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-[#5D6D7E] text-xs">
                <Target className="w-8 h-8 mb-2 stroke-1 text-slate-400" />
                <p>Sem dados de etapas disponíveis.</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {donutChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`${val} oportunidade(s)`, 'Quantidade']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #D5DBDB',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      formatter={(val) => <span className="text-[11px] text-[#1C2833]">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO INFERIOR: OPORTUNIDADES RECENTES + PRÓXIMAS TAREFAS + LEADS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabela das 5 oportunidades mais recentes (2 colunas) */}
        <Card className="lg:col-span-2 border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                Oportunidades Recentes
              </CardTitle>
              <CardDescription className="text-xs text-[#5D6D7E]">
                Últimas movimentações comerciais registradas
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate('/oportunidades')}
              variant="ghost"
              size="sm"
              className="text-xs text-[#1B4F72] hover:text-[#154360]"
            >
              Ver todas
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {oportunidades.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5D6D7E]">
                Nenhuma oportunidade encontrada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-[#D5DBDB] text-[10px] uppercase font-bold tracking-wider text-[#5D6D7E]">
                    <tr>
                      <th className="px-4 py-2.5">Oportunidade</th>
                      <th className="px-4 py-2.5">Cliente</th>
                      <th className="px-4 py-2.5">Etapa</th>
                      <th className="px-4 py-2.5 text-right">Valor BRL</th>
                      <th className="px-4 py-2.5">Follow-up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5DBDB]/60">
                    {oportunidades.slice(0, 5).map((op) => {
                      const clienteNome =
                        op.expand?.cliente_b2b_id?.razao_social ||
                        op.expand?.cliente_b2c_id?.nome_completo ||
                        'Cliente Não Vinculado'
                      const followStatus = getFollowUpStatus(op.proxima_acao_data)

                      return (
                        <tr
                          key={op.id}
                          onClick={() => navigate(`/negocios?oppId=${op.id}`)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-[#1C2833] max-w-[200px] truncate">
                            {op.titulo}
                            {isConsolidated && op.expand?.marca_id && (
                              <span
                                className="block text-[10px] font-normal"
                                style={{ color: op.expand.marca_id.cor_destaque }}
                              >
                                {op.expand.marca_id.nome}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#5D6D7E] max-w-[160px] truncate">
                            {clienteNome}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium border-[#D5DBDB] bg-white text-[#1C2833]"
                            >
                              {op.etapa_atual}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#1C2833]">
                            {formatCurrencyBRL(op.valor_estimado)}
                          </td>
                          <td className="px-4 py-3">
                            {followStatus === 'missing' && (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-medium">
                                Sem follow-up
                              </Badge>
                            )}
                            {followStatus === 'overdue' && (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-medium">
                                Vencido ({formatDateBR(op.proxima_acao_data)})
                              </Badge>
                            )}
                            {followStatus === 'soon' && (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-medium">
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
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista das próximas 5 tarefas com checkbox */}
        <Card className="border-[#D5DBDB] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                Próximas Tarefas
              </CardTitle>
              <CardDescription className="text-xs text-[#5D6D7E]">
                Compromissos pendentes na agenda
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate('/tarefas')}
              variant="ghost"
              size="sm"
              className="text-xs text-[#1B4F72] hover:text-[#154360]"
            >
              Ver todas
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            {proximasTarefas.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#5D6D7E]">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500" />
                <p>Nenhuma tarefa pendente para esta marca!</p>
              </div>
            ) : (
              proximasTarefas.map((at) => {
                const isOverdue = new Date(at.data_vencimento).getTime() < now.getTime()
                return (
                  <div
                    key={at.id}
                    className="p-2.5 rounded-lg border border-[#D5DBDB]/70 hover:border-[#D5DBDB] bg-slate-50/50 flex items-start space-x-3 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleConcluirTarefa(at)}
                      className="mt-0.5 w-4 h-4 rounded border border-[#5D6D7E] hover:border-emerald-600 hover:bg-emerald-50 flex items-center justify-center shrink-0"
                    >
                      {at.concluida && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1C2833] truncate">{at.descricao}</p>
                      <div className="flex items-center space-x-2 mt-1 text-[11px] text-[#5D6D7E]">
                        <span className="font-medium text-[#1B4F72]">{at.tipo}</span>
                        <span>•</span>
                        <span
                          className={`flex items-center ${
                            isOverdue ? 'text-red-600 font-bold' : 'text-[#5D6D7E]'
                          }`}
                        >
                          <Clock className="w-3 h-3 mr-1 inline" />
                          {formatDateBR(at.data_vencimento)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICO DE LEADS DOS ÚLTIMOS 30 DIAS POR ORIGEM */}
      <Card className="border-[#D5DBDB] bg-white shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                Captação de Leads por Origem
              </CardTitle>
              <CardDescription className="text-xs text-[#5D6D7E]">
                Canais de entrada e geração de interesse no ecossistema NTC
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate('/contatos?sub=leads')}
              variant="outline"
              size="sm"
              className="text-xs border-[#D5DBDB]"
            >
              Gerenciar Leads
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {leadsBarData.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-[#5D6D7E] text-xs">
              <Target className="w-6 h-6 mb-1 text-slate-400" />
              <p>Nenhum lead capturado para a marca ativa.</p>
            </div>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsBarData} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#5D6D7E' }} />
                  <YAxis
                    dataKey="origem"
                    type="category"
                    tick={{ fontSize: 11, fill: '#1C2833' }}
                    width={110}
                  />
                  <Tooltip
                    formatter={(val: number) => [`${val} lead(s)`, 'Volume']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #D5DBDB',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="quantidade" fill="#2E86C1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
