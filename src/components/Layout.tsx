// src/components/Layout.tsx
import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useBrand } from '@/contexts/BrandContext'
import pb from '@/lib/pocketbase/client'
import { GlobalSearch } from './GlobalSearch'
import { NtcLogo } from './NtcLogo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Funnel,
  Users2,
  Target,
  CheckSquare,
  GitCompare,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  BarChart3,
  Menu,
  LogOut,
  ChevronDown,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Briefcase,
  Building2,
  User,
  FileText,
  Sparkles,
} from 'lucide-react'
import { CURRENT_APP_VERSION } from '@/lib/appVersion'
import { cn } from '@/lib/utils'
import { QuickActionModal, type QuickActionType } from './QuickActionModal'

export default function Layout() {
  const {
    user,
    logout,
    isAdmin,
    isDiretoria,
    isRepresentante,
    podeVerConsolidado,
    podeAcessarPreferencias,
    podeAcessarConciliacao,
    podeAcessarRelatorios,
    podeAcessarImportacao,
    perfilGlobal,
  } = useAuth()
  const { marcas, activeBrand, isConsolidated, setActiveBrandId, currentBrandColor } = useBrand()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Pin no localStorage — se pin ativado, fica aberto (240px); se pin desativado, fica recolhido (68px) e NÃO abre no hover
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(() => {
    const saved = localStorage.getItem('ntc_sidebar_pinned')
    return saved !== null ? saved === 'true' : true
  })
  const [quickAction, setQuickAction] = useState<QuickActionType>(null)

  useEffect(() => {
    localStorage.setItem('ntc_sidebar_pinned', String(isSidebarPinned))
  }, [isSidebarPinned])

  // Badges em tempo real
  const [tarefasVencidasCount, setTarefasVencidasCount] = useState<number>(0)
  const [duplicidadesCount, setDuplicidadesCount] = useState<number>(0)
  const [contatosCount, setContatosCount] = useState<number>(0)

  const navigate = useNavigate()
  const location = useLocation()

  // Buscar contagens para os badges pretos do menu estilo Pipedrive
  const fetchSidebarCounts = async () => {
    try {
      const nowIso = new Date().toISOString()
      const [tarefasRes, dupRes, b2bRes, b2cRes, leadsRes] = await Promise.all([
        pb
          .collection('atividades')
          .getList(1, 1, {
            filter: `concluida = false && data_vencimento < "${nowIso}"`,
          })
          .catch(() => ({ totalItems: 0 })),
        pb
          .collection('duplicidades')
          .getList(1, 1, {
            filter: `status = "Aberta" || status = "Em Revisão"`,
          })
          .catch(() => ({ totalItems: 0 })),
        pb
          .collection('organizacoes')
          .getList(1, 1)
          .catch(() => ({ totalItems: 0 })),
        pb
          .collection('pessoas')
          .getList(1, 1)
          .catch(() => ({ totalItems: 0 })),
        pb
          .collection('leads')
          .getList(1, 1)
          .catch(() => ({ totalItems: 0 })),
      ])

      setTarefasVencidasCount(tarefasRes.totalItems || 0)
      setDuplicidadesCount(dupRes.totalItems || 0)
      setContatosCount(
        (b2bRes.totalItems || 0) + (b2cRes.totalItems || 0) + (leadsRes.totalItems || 0),
      )
    } catch {
      // Ignora erro de contagem para não travar layout
    }
  }

  useEffect(() => {
    fetchSidebarCounts()
    const timer = setInterval(fetchSidebarCounts, 30000)
    return () => clearInterval(timer)
  }, [activeBrand])

  // Quando o pin está desativado, o menu NÃO expande no hover: só abre com pin ativado
  const isExpanded = isSidebarPinned

  // Menu principal do CRM adaptativo por perfil:
  // - Representante: menu MÍNIMO (apenas Visão Geral, Negócios e Contatos).
  //   SEM Conciliação, Importação, Preferências, Painéis & Relatórios, Tarefas.
  // - Preferências: visível APENAS para Administrador (oculto para Diretoria, Supervisor, Vendedor, Representante)
  // - Conciliação: visível para Admin, Supervisor, Vendedor; OCULTO para Diretoria e Representante
  // - Importação: oculta para Diretoria e Representante
  // - Painéis & Relatórios: oculta para Representante
  const allNavItems = [
    { label: 'Visão Geral', path: '/', icon: LayoutDashboard, visible: true },
    {
      label: 'Negócios',
      path: '/negocios',
      icon: Funnel,
      badge: null,
      activeMatches: ['/negocios', '/pipelines', '/oportunidades'],
      visible: true,
    },
    {
      label: 'Contatos',
      path: '/contatos',
      icon: Users2,
      badge: contatosCount > 0 ? contatosCount : null,
      activeMatches: ['/contatos', '/clientes', '/leads'],
      visible: true,
    },
    {
      label: 'Tarefas',
      path: '/tarefas',
      icon: CheckSquare,
      badge: tarefasVencidasCount > 0 ? tarefasVencidasCount : null,
      visible: !isRepresentante,
    },
    {
      label: 'Conciliação',
      path: '/conciliacao',
      icon: GitCompare,
      badge: duplicidadesCount > 0 ? duplicidadesCount : null,
      visible: podeAcessarConciliacao,
    },
    {
      label: 'Importação',
      path: '/importacao',
      icon: FileSpreadsheet,
      badge: null,
      visible: podeAcessarImportacao,
    },
    {
      label: 'Painéis & Relatórios',
      path: '/relatorios',
      icon: BarChart3,
      badge: null,
      visible: podeAcessarRelatorios,
    },
    {
      label: 'Preferências',
      path: '/preferencias',
      icon: Settings,
      badge: null,
      visible: podeAcessarPreferencias,
    },
  ]

  const navItems = allNavItems.filter((item) => item.visible)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isItemActive = (item: (typeof navItems)[0]) => {
    if (item.activeMatches) {
      return item.activeMatches.some(
        (match) =>
          location.pathname === match || (match !== '/' && location.pathname.startsWith(match)),
      )
    }
    if (item.path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(item.path)
  }

  // Seletor ÚNICO de Marca para o Header (substitui o chip e centraliza a troca de marca)
  const HeaderBrandSelector = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Selecionar Marca ou Consolidado"
          className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-xs font-semibold transition-all shadow-2xs group focus:outline-none focus:ring-2 focus:ring-[#017848]/30"
        >
          <span
            className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0 ring-1 ring-black/10 group-hover:scale-110 transition-transform"
            style={{ backgroundColor: isConsolidated ? '#3B82F6' : currentBrandColor }}
          />
          <span className="text-slate-800 max-w-[170px] truncate">
            {isConsolidated
              ? 'Consolidado (Todas as Marcas)'
              : activeBrand?.nome || 'Selecione a Marca'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-800 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1.5 shadow-xl border-slate-200">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-[#5D6D7E]">
          {podeVerConsolidado ? 'Contexto Multimarca' : 'Marcas Autorizadas'}
        </DropdownMenuLabel>

        {/* Opção "Consolidado" visível APENAS para Administrador e Diretoria */}
        {podeVerConsolidado && (
          <>
            <DropdownMenuItem
              onClick={() => setActiveBrandId(null)}
              className={cn(
                'flex items-center justify-between cursor-pointer rounded-lg text-xs font-semibold py-2 px-2.5',
                isConsolidated ? 'bg-sky-50 text-[#1B4F72]' : 'text-[#1C2833]',
              )}
            >
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-[#1B4F72]" />
                <span>Todas as Marcas (Consolidado)</span>
              </div>
              {isConsolidated && (
                <span className="text-[10px] font-bold text-[#1B4F72]">Ativo</span>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200/60" />
          </>
        )}

        {marcas.length === 0 ? (
          <div className="px-2.5 py-3 text-center text-xs text-slate-500">
            Nenhuma marca autorizada cadastrada.
          </div>
        ) : (
          marcas.map((m) => {
            const isSelected = !isConsolidated && activeBrand?.id === m.id
            return (
              <DropdownMenuItem
                key={m.id}
                onClick={() => setActiveBrandId(m.id)}
                className={cn(
                  'flex items-center justify-between cursor-pointer rounded-lg text-xs font-semibold py-2 px-2.5',
                  isSelected ? 'bg-slate-100 font-bold' : 'text-[#1C2833]',
                )}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: m.cor_destaque }}
                  />
                  <span className="truncate">{m.nome}</span>
                </div>
                {isSelected && (
                  <span
                    className="text-[10px] font-bold shrink-0"
                    style={{ color: m.cor_destaque }}
                  >
                    Ativo
                  </span>
                )}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col lg:flex-row text-[#1C2833] font-sans antialiased">
      {/*
        DESKTOP SIDEBAR PIPEDRIVE STYLE:
        Recolhida por padrão (~68px) mostrando apenas ícones em fundo roxo escuro (#201A29 / #241C35).
        Ao passar o mouse ou clicar em pin, expande para 240px com transição suave.
      */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-[#201A29] text-white shrink-0 sticky top-0 h-screen z-40 transition-all duration-200 ease-in-out border-r border-[#2C243B] select-none',
          isExpanded ? 'w-[240px] shadow-2xl' : 'w-[68px]',
        )}
      >
        {/* Top Logo / Pipedrive 'P' or 'N' Icon */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-[#2C243B]">
          <div className="flex items-center space-x-3 overflow-hidden w-full">
            {/* Logo NTC Oficial (Ícone com 3 paralelogramos vermelhos ou completo) */}
            <div className="relative shrink-0 flex items-center justify-center">
              <NtcLogo
                variant="icon"
                className="w-10 h-10 rounded-xl shadow-md ring-1 ring-white/10 hover:ring-white/20 transition-all cursor-pointer"
                alt="NTC Company"
              />
            </div>
            {isExpanded && (
              <div className="min-w-0 flex-1 animate-fade-in flex flex-col justify-center">
                <div className="flex items-center space-x-1.5"></div>
                <div className="flex items-center space-x-1.5 mt-1">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    Nexo CRM
                  </span>
                  <span className="text-[9px] text-slate-400">| Multimarca</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Brand Identity — exibe a marca ativa sem controle duplicado de troca (quem troca é o header) */}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isItemActive(item)

            const linkContent = (
              <NavLink
                to={item.path}
                className={cn(
                  'relative group flex items-center rounded-xl transition-all font-medium text-xs',
                  isExpanded ? 'px-3 py-2.5 space-x-3' : 'w-11 h-11 mx-auto justify-center',
                  active
                    ? 'bg-[#312544] text-white font-semibold ring-1 ring-white/15 shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-white/10',
                )}
              >
                {/* Active indicator bar */}
                {active && (
                  <span
                    className={cn(
                      'absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#017848]',
                      !isExpanded && 'left-0.5',
                    )}
                  />
                )}

                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-transform group-hover:scale-105',
                      active ? 'text-white' : 'text-slate-200',
                    )}
                  />
                  {/* Badge contador sobreposto quando recolhido */}
                  {!isExpanded && item.badge !== null && item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#0B0C10] text-white ring-1 ring-white/20 shadow-md">
                      {item.badge}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="flex-1 flex items-center justify-between min-w-0 animate-fade-in">
                    <span className="truncate">{item.label}</span>
                    {item.badge !== null && item.badge !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0B0C10] text-slate-200 ring-1 ring-white/10 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            )

            // Se recolhido, exibe Tooltip no hover estilo Pipedrive
            if (!isExpanded) {
              return (
                <Tooltip key={item.path} delayDuration={150}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={12}
                    className="bg-[#0B0C10] text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xl border border-white/10 flex items-center space-x-2"
                  >
                    <span>{item.label}</span>
                    {item.badge !== null && item.badge !== undefined && (
                      <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.path}>{linkContent}</div>
          })}
        </div>

        {/* Footer: Versão do App e Fixador do Menu Lateral como a ÚLTIMA opção fixa do menu (base da sidebar) */}
        <div className="p-2 border-t border-[#2C243B] space-y-1">
          {isExpanded ? (
            <>
              <div className="px-3 py-1 flex items-center justify-between text-[11px] text-slate-400 select-none">
                <span className="flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Nexo NTC
                </span>
                <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300">
                  v{CURRENT_APP_VERSION}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarPinned(false)}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors text-left"
                title="Desafixar menu (recolher barra lateral)"
              >
                <PinOff className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Desafixar Menu</span>
              </button>
            </>
          ) : (
            <>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <div className="w-11 h-6 mx-auto flex items-center justify-center text-[10px] font-mono text-slate-400 select-none cursor-default">
                    v{CURRENT_APP_VERSION}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-[#0B0C10] text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xl border border-white/10"
                >
                  <span>Nexo CRM v{CURRENT_APP_VERSION}</span>
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsSidebarPinned(true)}
                    className="w-11 h-11 mx-auto flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Fixar menu lateral"
                  >
                    <Pin className="w-5 h-5 text-emerald-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-[#0B0C10] text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xl border border-white/10"
                >
                  <span>Fixar menu aberto</span>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[280px] p-0 flex flex-col bg-[#201A29] text-white border-r border-[#2C243B]"
        >
          <SheetHeader className="p-4 border-b border-[#2C243B] text-left flex flex-row items-center space-x-3">
            <NtcLogo
              variant="icon"
              className="w-10 h-10 rounded-xl shadow-sm ring-1 ring-white/10"
              alt="NTC Company"
            />
            <div>
              <div className="flex items-center space-x-1.5">
                <SheetTitle className="text-sm font-black text-white leading-none">
                  NTC COMPANY
                </SheetTitle>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">Nexo CRM • Pipedrive Edition</p>
            </div>
          </SheetHeader>

          {/* Mobile Identity */}
          <div className="p-3 border-b border-[#2C243B] flex items-center space-x-2.5">
            <span
              className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/40"
              style={{ backgroundColor: isConsolidated ? '#3B82F6' : currentBrandColor }}
            />
            <div className="min-w-0">
              <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 leading-none">
                Marca Ativa
              </p>
              <p className="text-xs font-semibold text-white truncate mt-0.5">
                {isConsolidated ? 'Consolidado NTC' : activeBrand?.nome || 'NTC'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isItemActive(item)
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate(item.path)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left',
                    active
                      ? 'bg-[#312544] text-white font-semibold ring-1 ring-white/10'
                      : 'text-slate-200 hover:text-white hover:bg-white/10',
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0B0C10] text-slate-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="p-4 border-t border-[#2C243B] bg-black/20">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.name || 'Administrador'}
                </p>
                <p className="text-[10px] text-slate-300 truncate">{user?.email}</p>
                <p className="text-[10px] font-mono text-emerald-400 mt-0.5">
                  v{CURRENT_APP_VERSION}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-red-400 hover:bg-red-500/10"
              >
                Sair
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP HEADER ESTILO PIPEDRIVE */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E3E7EB] flex items-center justify-between px-3 sm:px-6 shadow-xs">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Hamburger on Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 text-slate-600 rounded-xl hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Seletor Único de Marca no Header (Desktop) */}
            <div className="hidden sm:block">
              <HeaderBrandSelector />
            </div>
          </div>

          {/* Global Search centralizado + Botão '+' de Ação Rápida estilo Pipedrive */}
          <div className="flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-6 flex items-center space-x-2">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>

            {/* BOTÃO '+' DE AÇÃO RÁPIDA ESTILO PIPEDRIVE */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full bg-[#017848] hover:bg-[#01653c] text-white shadow-xs shrink-0 font-bold transition-transform active:scale-95"
                  title="Criação Rápida (+)"
                  aria-label="Adicionar item rapidamente"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52 rounded-xl shadow-xl border-slate-200 p-1"
              >
                <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-2 py-1">
                  Criação Rápida {activeBrand ? `• ${activeBrand.nome}` : ''}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => setQuickAction('lead')}
                  className="text-xs font-semibold py-2 px-2.5 rounded-lg cursor-pointer text-slate-800 hover:bg-slate-100"
                >
                  <Target className="w-4 h-4 mr-2.5 text-amber-500" />
                  <span>Lead</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setQuickAction('negocio')}
                  className="text-xs font-semibold py-2 px-2.5 rounded-lg cursor-pointer text-slate-800 hover:bg-slate-100"
                >
                  <Briefcase className="w-4 h-4 mr-2.5 text-emerald-600" />
                  <span>Negócio</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setQuickAction('pessoa')}
                  className="text-xs font-semibold py-2 px-2.5 rounded-lg cursor-pointer text-slate-800 hover:bg-slate-100"
                >
                  <User className="w-4 h-4 mr-2.5 text-blue-600" />
                  <span>Pessoa</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setQuickAction('organizacao')}
                  className="text-xs font-semibold py-2 px-2.5 rounded-lg cursor-pointer text-slate-800 hover:bg-slate-100"
                >
                  <Building2 className="w-4 h-4 mr-2.5 text-sky-600" />
                  <span>Organização</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => setQuickAction('nota')}
                  className="text-xs font-semibold py-2 px-2.5 rounded-lg cursor-pointer text-slate-800 hover:bg-slate-100"
                >
                  <FileText className="w-4 h-4 mr-2.5 text-purple-600" />
                  <span>Nota</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setQuickAction('tarefa')}
                  className="text-xs font-semibold py-2 px-2.5 rounded-lg cursor-pointer text-slate-800 hover:bg-slate-100"
                >
                  <CheckSquare className="w-4 h-4 mr-2.5 text-rose-500" />
                  <span>Tarefa</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center space-x-2 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#017848] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl border-slate-200 shadow-xl"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-bold leading-none text-slate-900">
                      {user?.name || 'Usuário NTC'}
                    </p>
                    <p className="text-[11px] leading-none text-slate-500">{user?.email}</p>
                    <div className="pt-1 flex items-center justify-between gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {perfilGlobal}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        v{CURRENT_APP_VERSION}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {podeAcessarPreferencias && (
                  <DropdownMenuItem
                    onClick={() => navigate('/preferencias')}
                    className="text-xs cursor-pointer rounded-lg"
                  >
                    <Settings className="w-4 h-4 mr-2 text-slate-500" />
                    Preferências
                  </DropdownMenuItem>
                )}
                {podeAcessarRelatorios && (
                  <DropdownMenuItem
                    onClick={() => navigate('/relatorios')}
                    className="text-xs cursor-pointer rounded-lg"
                  >
                    <BarChart3 className="w-4 h-4 mr-2 text-slate-500" />
                    Painéis & Relatórios
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-xs text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair do Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* MOBILE BRAND HORIZONTAL ROW */}
        <div className="sm:hidden bg-white border-b border-slate-200 px-3 py-2 overflow-x-auto flex items-center space-x-1.5 scrollbar-none">
          {podeVerConsolidado && (
            <button
              type="button"
              onClick={() => setActiveBrandId(null)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors border',
                isConsolidated
                  ? 'bg-[#017848] text-white border-[#017848]'
                  : 'bg-slate-50 text-slate-600 border-slate-200',
              )}
            >
              Consolidado
            </button>
          )}
          {marcas.map((m) => {
            const isSelected = !isConsolidated && activeBrand?.id === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveBrandId(m.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors border flex items-center space-x-1.5',
                  isSelected
                    ? 'text-white border-transparent'
                    : 'bg-white text-slate-600 border-slate-200',
                )}
                style={{
                  backgroundColor: isSelected ? m.cor_destaque : undefined,
                }}
              >
                {!isSelected && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: m.cor_destaque }}
                  />
                )}
                <span>{m.nome}</span>
              </button>
            )
          })}
        </div>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-[1700px] w-full mx-auto animate-fade-in">
          <Outlet />
        </main>

        {/* Modal de Ação Rápida */}
        <QuickActionModal
          type={quickAction}
          onClose={() => setQuickAction(null)}
          onSuccess={() => {
            fetchSidebarCounts()
          }}
        />
      </div>
    </div>
  )
}
