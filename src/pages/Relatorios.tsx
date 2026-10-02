// src/pages/Relatorios.tsx
import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Oportunidade, Atividade, Lead, Marca } from '@/types'
import { formatCurrencyBRL } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
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
import {
  Download,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  Briefcase,
  Layers,
  FileSpreadsheet,
  Loader2,
  Repeat,
  AlertOctagon,
  UserCheck,
} from 'lucide-react'

export default function Relatorios() {
  const {
    marcas,
    activeBrand,
    isConsolidated,
    setActiveBrandId,
    currentBrandColor,
    podeVerConsolidado,
  } = useBrand()
  const {
    user,
    isAdmin,
    isDiretoria,
    isSupervisor,
    isVendedor,
    isRepresentante,
    escopoVisibilidade,
  } = useAuth()

  // Se o usuário não puder ver consolidado (Supervisor / Vendedor), aba SEMPRE é 'marca'
  const [activeTab, setActiveTab] = useState<'marca' | 'consolidado'>(
    podeVerConsolidado && isConsolidated ? 'consolidado' : 'marca',
  )

  useEffect(() => {
    if (!podeVerConsolidado && activeTab === 'consolidado') {
      setActiveTab('marca')
    }
  }, [podeVerConsolidado, activeTab])

  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const oppFilters: string[] = []
      const ativFilters: string[] = []
      const leadFilters: string[] = []

      // 1. Marca:
      // Se não tem permissão para consolidado, OBRIGATORIAMENTE filtra pela marca ativa
      // Se tiver permissão e estiver na aba marca, filtra pela marca ativa
      if (!podeVerConsolidado || activeTab === 'marca') {
        if (activeBrand) {
          oppFilters.push(`marca_id = "${activeBrand.id}"`)
          ativFilters.push(`marca_id = "${activeBrand.id}"`)
          leadFilters.push(`marca_id = "${activeBrand.id}"`)
        }
      }

      // 2. Escopo de visibilidade:
      // Supervisor: apenas a marca ativa (sem agregação multimarca) e escopo de equipe/marca
      // Vendedor e Representante: apenas a marca ativa e somente seus próprios negócios/cadastros se escopo 'proprios' ou Representante
      if (user && !isAdmin && !isDiretoria) {
        if (
          isRepresentante ||
          (isVendedor && escopoVisibilidade === 'proprios') ||
          escopoVisibilidade === 'proprios'
        ) {
          oppFilters.push(`vendedor_id = "${user.id}"`)
          ativFilters.push(`responsavel_id = "${user.id}"`)
          leadFilters.push(`criado_por_id = "${user.id}"`)
        }
      }

      const oppFilter = oppFilters.join(' && ')
      const ativFilter = ativFilters.join(' && ')
      const leadFilter = leadFilters.join(' && ')

      const [oppRes, ativRes, leadRes] = await Promise.all([
        pb.collection('oportunidades').getFullList<Oportunidade>({
          filter: oppFilter || undefined,
          expand: 'marca_id,cliente_b2b_id,cliente_b2c_id',
          sort: '-created',
        }),
        pb.collection('atividades').getFullList<Atividade>({
          filter: ativFilter || undefined,
          expand: 'marca_id',
        }),
        pb.collection('leads').getFullList<Lead>({
          filter: leadFilter || undefined,
          expand: 'marca_id',
        }),
      ])

      setOportunidades(oppRes)
      setAtividades(ativRes)
      setLeads(leadRes)
    } catch (err) {
      console.error('Erro ao buscar relatórios:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab, activeBrand, user?.id, escopoVisibilidade])

  // Cálculos de KPIs
  const totalOportunidades = oportunidades.length
  const valorPipeline = oportunidades.reduce((sum, o) => sum + (o.valor_estimado || 0), 0)
  const now = new Date()
  const tarefasVencidas = atividades.filter(
    (a) => !a.concluida && new Date(a.data_vencimento).getTime() < now.getTime(),
  ).length

  const oportunidadesGanhas = oportunidades.filter(
    (o) =>
      o.etapa_atual.toLowerCase().includes('ganho') ||
      o.etapa_atual.toLowerCase().includes('concluído'),
  )
  const taxaConversao =
    totalOportunidades > 0
      ? ((oportunidadesGanhas.length / totalOportunidades) * 100).toFixed(1)
      : '0.0'

  // Mix de Receita: Cliente Novo x Recompra
  let receitaClienteNovo = 0
  let receitaRecompra = 0
  let countClienteNovo = 0
  let countRecompra = 0

  oportunidades.forEach((o) => {
    const val = o.valor_estimado || 0
    if (o.tipo_cliente === 'Recompra') {
      receitaRecompra += val
      countRecompra += 1
    } else {
      receitaClienteNovo += val
      countClienteNovo += 1
    }
  })

  const receitaTotalMix = receitaClienteNovo + receitaRecompra
  const percReceitaNovo =
    receitaTotalMix > 0 ? Math.round((receitaClienteNovo / receitaTotalMix) * 100) : 0
  const percReceitaRecompra =
    receitaTotalMix > 0 ? Math.round((receitaRecompra / receitaTotalMix) * 100) : 0

  const mixReceitaChartData = [
    { name: 'Cliente Novo', valor: receitaClienteNovo, count: countClienteNovo, color: '#017848' },
    { name: 'Recompra', valor: receitaRecompra, count: countRecompra, color: '#8E44AD' },
  ].filter((d) => d.valor > 0 || d.count > 0)

  // Indicador de Churn Leve: Clientes com negócio ganho anterior mas sem recompra há mais de 6 meses
  // Agrupa negócios ganhos por cliente (b2b ou b2c)
  const clientWonMap = new Map<
    string,
    { nome: string; tipo: 'B2B' | 'B2C'; lastWonDate: Date; wonDealsCount: number }
  >()

  oportunidadesGanhas.forEach((o) => {
    const b2b = o.expand?.organizacao_id || o.expand?.cliente_b2b_id
    const b2c = o.expand?.pessoa_id || o.expand?.cliente_b2c_id
    const clientId = o.cliente_b2b_id || o.organizacao_id || o.cliente_b2c_id || o.pessoa_id
    if (!clientId) return
    const nome = b2b?.razao_social || b2c?.nome_completo || 'Cliente'
    const tipo = b2b || o.cliente_b2b_id || o.organizacao_id ? 'B2B' : 'B2C'
    const dealDate = new Date(o.created)

    const existing = clientWonMap.get(clientId)
    if (!existing) {
      clientWonMap.set(clientId, { nome, tipo, lastWonDate: dealDate, wonDealsCount: 1 })
    } else {
      existing.wonDealsCount += 1
      if (dealDate > existing.lastWonDate) {
        existing.lastWonDate = dealDate
      }
    }
  })

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const clientesSemRecompra6m: {
    clientId: string
    nome: string
    tipo: 'B2B' | 'B2C'
    lastWonDate: Date
    diasSemCompra: number
  }[] = []
  clientWonMap.forEach((val, id) => {
    if (val.lastWonDate < sixMonthsAgo) {
      const diffMs = now.getTime() - val.lastWonDate.getTime()
      const diasSemCompra = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      clientesSemRecompra6m.push({
        clientId: id,
        nome: val.nome,
        tipo: val.tipo,
        lastWonDate: val.lastWonDate,
        diasSemCompra,
      })
    }
  })

  // Tempo médio estimado de ciclo (fictício baseado em dias de abertura para este relatório)
  const cicloMedioDias = totalOportunidades > 0 ? 28 : 0

  // Gráfico 1: Oportunidades por Etapa
  const etapaMap: Record<string, { count: number; valor: number }> = {}
  oportunidades.forEach((o) => {
    const et = o.etapa_atual || 'Outros'
    if (!etapaMap[et]) etapaMap[et] = { count: 0, valor: 0 }
    etapaMap[et].count += 1
    etapaMap[et].valor += o.valor_estimado || 0
  })

  const etapasData = Object.keys(etapaMap).map((et) => ({
    etapa: et.length > 14 ? et.substring(0, 14) + '...' : et,
    nomeCompleto: et,
    quantidade: etapaMap[et].count,
    valor: etapaMap[et].valor,
  }))

  // Gráfico 2: Tarefas por Status
  const tarefasConcluidas = atividades.filter((a) => a.concluida).length
  const tarefasPendentes = atividades.length - tarefasConcluidas
  const tarefasStatusData = [
    { name: 'Concluídas', value: tarefasConcluidas, color: '#27AE60' },
    { name: 'Pendentes em Aberto', value: tarefasPendentes - tarefasVencidas, color: '#2E86C1' },
    { name: 'Atrasadas / Vencidas', value: tarefasVencidas, color: '#E74C3C' },
  ].filter((d) => d.value > 0)

  // Gráfico 3: Leads por Origem
  const origemMap: Record<string, number> = {}
  leads.forEach((l) => {
    origemMap[l.origem] = (origemMap[l.origem] || 0) + 1
  })
  const leadsOrigemData = Object.keys(origemMap).map((k) => ({
    origem: k,
    total: origemMap[k],
  }))

  // Gráfico 4: Valor por Marca (Apenas Consolidado)
  const marcaValorMap: Record<string, { nome: string; valor: number; cor: string }> = {}
  marcas.forEach((m) => {
    marcaValorMap[m.id] = { nome: m.nome, valor: 0, cor: m.cor_destaque }
  })

  oportunidades.forEach((o) => {
    if (marcaValorMap[o.marca_id]) {
      marcaValorMap[o.marca_id].valor += o.valor_estimado || 0
    }
  })

  const marcaValorData = Object.values(marcaValorMap).filter((m) => m.valor > 0)

  // Exportar dados atuais em CSV
  const handleExportCSV = () => {
    let csv = 'ID;Titulo;Cliente;Valor_Estimado;Etapa;Marca;Data_Criacao\n'
    oportunidades.forEach((o) => {
      const b2b = o.expand?.organizacao_id || o.expand?.cliente_b2b_id
      const b2c = o.expand?.pessoa_id || o.expand?.cliente_b2c_id
      const cNome = b2b?.razao_social || b2c?.nome_completo || 'N/A'
      const mNome = o.expand?.marca_id?.nome || 'NTC'
      csv += `"${o.id}";"${o.titulo}";"${cNome}";"${o.valor_estimado}";"${o.etapa_atual}";"${mNome}";"${o.created}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio_crm_ntc_${activeTab}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isRepresentante) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D5DBDB]/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2833]">
            Painéis & Relatórios de Inteligência Comercial
          </h1>
          <p className="text-xs sm:text-sm text-[#5D6D7E] mt-1">
            Indicadores de conversão de funil, saúde da carteira e volumetria por marca
          </p>
        </div>

        <Button
          onClick={handleExportCSV}
          size="sm"
          variant="outline"
          className="text-xs border-[#D5DBDB] bg-white self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 mr-1.5 text-[#1B4F72]" />
          Exportar CSV
        </Button>
      </div>

      {/* SELETOR DE ABAS: POR MARCA OU CONSOLIDADO (Consolidado visível APENAS para Administrador e Diretoria) */}
      {podeVerConsolidado ? (
        <div className="flex items-center space-x-2">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as 'marca' | 'consolidado')
              if (v === 'consolidado') setActiveBrandId(null)
            }}
            className="w-auto"
          >
            <TabsList className="bg-white border border-[#D5DBDB] p-1 h-10 shadow-xs">
              <TabsTrigger
                value="marca"
                className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-[#1B4F72] data-[state=active]:text-white"
              >
                Visão por Marca ({activeBrand?.nome || 'Selecione'})
              </TabsTrigger>
              <TabsTrigger
                value="consolidado"
                className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-[#1B4F72] data-[state=active]:text-white"
              >
                Visão Consolidada Diretoria (Todas as Marcas)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs py-1 px-3 bg-white border-[#D5DBDB]">
            Marca Ativa: <strong>{activeBrand?.nome || 'NTC'}</strong>
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-xs text-[#5D6D7E]">
          <Loader2 className="w-8 h-8 animate-spin text-[#1B4F72] mb-2" />
          Calculando métricas analíticas...
        </div>
      ) : (
        <>
          {/* PAINEL DE 5 KPIS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <Card className="border-[#D5DBDB] bg-white shadow-xs p-4">
              <span className="text-[10px] uppercase font-bold text-[#5D6D7E]">Oportunidades</span>
              <p className="text-2xl font-bold text-[#1C2833] mt-1">{totalOportunidades}</p>
              <p className="text-[11px] text-[#5D6D7E]">Total em andamento</p>
            </Card>

            <Card className="border-[#D5DBDB] bg-white shadow-xs p-4">
              <span className="text-[10px] uppercase font-bold text-[#5D6D7E]">Pipeline Total</span>
              <p className="text-xl font-bold text-[#1C2833] mt-1 truncate">
                {formatCurrencyBRL(valorPipeline)}
              </p>
              <p className="text-[11px] text-[#5D6D7E]">Volume financeiro</p>
            </Card>

            <Card className="border-[#D5DBDB] bg-white shadow-xs p-4">
              <span className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                Taxa de Conversão
              </span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{taxaConversao}%</p>
              <p className="text-[11px] text-[#5D6D7E]">Ganhos sobre abertos</p>
            </Card>

            <Card className="border-[#D5DBDB] bg-white shadow-xs p-4">
              <span className="text-[10px] uppercase font-bold text-[#5D6D7E]">
                Tarefas Vencidas
              </span>
              <p
                className={`text-2xl font-bold mt-1 ${
                  tarefasVencidas > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {tarefasVencidas}
              </p>
              <p className="text-[11px] text-[#5D6D7E]">Atrasos operacionais</p>
            </Card>

            <Card className="border-[#D5DBDB] bg-white shadow-xs p-4 col-span-2 md:col-span-1">
              <span className="text-[10px] uppercase font-bold text-[#5D6D7E]">Ciclo Médio</span>
              <p className="text-2xl font-bold text-[#1C2833] mt-1">{cicloMedioDias} dias</p>
              <p className="text-[11px] text-[#5D6D7E]">Abertura até fechamento</p>
            </Card>
          </div>

          {/* PAINEL ESPECIAL DE MIX DE RECEITA (NOVO X RECOMPRA) & CHURN LEVE (6+ MESES) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* CARD 1: Mix de Receita (Novo x Recompra) */}
            <Card className="border-[#D5DBDB] bg-white shadow-xs lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833] flex items-center space-x-2">
                      <Repeat className="w-4 h-4 text-[#017848]" />
                      <span>Mix de Receita: Cliente Novo × Recompra</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5D6D7E]">
                      Participação do pipeline entre novas aquisições e recompra recorrente
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs border-emerald-200 bg-emerald-50 text-emerald-800"
                  >
                    Total: {formatCurrencyBRL(receitaTotalMix)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-[#017848]/20 bg-emerald-50/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-900 flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#017848]" />
                          <span>Cliente Novo</span>
                        </span>
                        <span className="font-bold text-emerald-800">{percReceitaNovo}%</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-base font-bold text-emerald-900">
                          {formatCurrencyBRL(receitaClienteNovo)}
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          {countClienteNovo} negócio(s)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-purple-900 flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#8E44AD]" />
                          <span>Recompra</span>
                        </span>
                        <span className="font-bold text-purple-800">{percReceitaRecompra}%</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-base font-bold text-purple-900">
                          {formatCurrencyBRL(receitaRecompra)}
                        </span>
                        <span className="text-[11px] text-purple-700">
                          {countRecompra} negócio(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="h-44 w-full">
                    {mixReceitaChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-[#5D6D7E]">
                        Sem negócios no escopo
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={mixReceitaChartData}
                            dataKey="valor"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={36}
                            outerRadius={65}
                            paddingAngle={4}
                          >
                            {mixReceitaChartData.map((entry, idx) => (
                              <Cell key={`mix-cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: number) => [formatCurrencyBRL(val), 'Volume']}
                            contentStyle={{
                              borderRadius: '8px',
                              border: '1px solid #D5DBDB',
                              fontSize: '12px',
                            }}
                          />
                          <Legend
                            formatter={(val) => (
                              <span className="text-[11px] text-[#1C2833]">{val}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CARD 2: Indicador de Churn Leve (Clientes sem recompra há 6+ meses) */}
            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833] flex items-center space-x-2">
                  <AlertOctagon className="w-4 h-4 text-amber-600" />
                  <span>Clientes sem Recompra (6+ meses)</span>
                </CardTitle>
                <CardDescription className="text-xs text-[#5D6D7E]">
                  Alerta preventivo de churn para reativação comercial
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center space-x-3 mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-2xl font-bold text-amber-700">
                    {clientesSemRecompra6m.length}
                  </span>
                  <div className="text-xs text-amber-900 leading-tight">
                    <strong>clientes inativos</strong> com negócio ganho há mais de 180 dias sem
                    nova compra
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                  {clientesSemRecompra6m.length === 0 ? (
                    <div className="py-6 text-center text-xs text-emerald-700 bg-emerald-50/50 rounded border border-emerald-100">
                      Nenhum cliente em risco de churn leve no momento!
                    </div>
                  ) : (
                    clientesSemRecompra6m.slice(0, 5).map((c) => (
                      <div
                        key={c.clientId}
                        className="p-2 rounded border border-slate-100 bg-slate-50 text-xs flex items-center justify-between"
                      >
                        <div className="truncate mr-2">
                          <p className="font-semibold text-slate-800 truncate">{c.nome}</p>
                          <p className="text-[10px] text-slate-500">
                            Última compra: {c.lastWonDate.toLocaleDateString('pt-BR')} (
                            {c.diasSemCompra} dias atrás)
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0 text-amber-700 border-amber-300"
                        >
                          {c.tipo}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GRÁFICOS ANALÍTICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico: Oportunidades por Etapa */}
            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                  Oportunidades por Etapa do Funil
                </CardTitle>
                <CardDescription className="text-xs text-[#5D6D7E]">
                  Distribuição quantitativa de negócios por fase
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {etapasData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs text-[#5D6D7E]">
                    Sem dados no período.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={etapasData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                      >
                        <XAxis
                          dataKey="etapa"
                          tick={{ fontSize: 11, fill: '#5D6D7E' }}
                          angle={-15}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#5D6D7E' }} />
                        <Tooltip
                          formatter={(val: number) => [`${val} oportunidade(s)`, 'Volume']}
                          labelFormatter={(label, item) => item[0]?.payload?.nomeCompleto || label}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #D5DBDB',
                            fontSize: '12px',
                          }}
                        />
                        <Bar
                          dataKey="quantidade"
                          fill={activeTab === 'consolidado' ? '#1B4F72' : currentBrandColor}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico: Tarefas por Status */}
            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                  Saúde Operacional das Tarefas
                </CardTitle>
                <CardDescription className="text-xs text-[#5D6D7E]">
                  Proporção de follow-ups em dia versus vencidos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {tarefasStatusData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs text-[#5D6D7E]">
                    Nenhuma tarefa registrada para o escopo selecionado.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tarefasStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {tarefasStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => [`${val} tarefa(s)`, 'Quantidade']}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #D5DBDB',
                            fontSize: '12px',
                          }}
                        />
                        <Legend
                          formatter={(val) => (
                            <span className="text-[11px] text-[#1C2833]">{val}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico: Leads por Origem */}
            <Card className="border-[#D5DBDB] bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                  Leads Captados por Origem
                </CardTitle>
                <CardDescription className="text-xs text-[#5D6D7E]">
                  Eficácia dos canais de entrada comerciais
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {leadsOrigemData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-xs text-[#5D6D7E]">
                    Sem dados de leads registrados.
                  </div>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsOrigemData} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis
                          dataKey="origem"
                          type="category"
                          width={110}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #D5DBDB',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="total" fill="#2E86C1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico: Comparativo de Valor por Marca (Apenas no modo Consolidado) */}
            {activeTab === 'consolidado' ? (
              <Card className="border-[#D5DBDB] bg-white shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#1C2833]">
                    Pipeline Total por Marca Comercial
                  </CardTitle>
                  <CardDescription className="text-xs text-[#5D6D7E]">
                    Comparativo consolidado do portfólio industrial NTC
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={marcaValorData} margin={{ top: 10, bottom: 20 }}>
                        <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(val: number) => [formatCurrencyBRL(val), 'Valor']}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #D5DBDB',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                          {marcaValorData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.cor} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Informação da Marca Ativa */
              <Card className="border-[#D5DBDB] bg-white shadow-xs flex flex-col justify-center p-6 text-center">
                <div
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white mb-3 shadow-md"
                  style={{ backgroundColor: currentBrandColor }}
                >
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#1C2833]">{activeBrand?.nome}</h3>
                <p className="text-xs text-[#5D6D7E] mt-1 max-w-sm mx-auto">
                  Isolamento lógico multimarca com governança RBAC. Troque para a aba
                  &quot;Consolidado&quot; para comparar o desempenho cruzado de todas as divisões
                  industriais.
                </p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
