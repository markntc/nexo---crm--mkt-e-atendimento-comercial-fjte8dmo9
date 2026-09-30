// src/components/Layout.tsx
import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useBrand } from '@/contexts/BrandContext'
import pb from '@/lib/pocketbase/client'
import { GlobalSearch } from './GlobalSearch'
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
  KanbanSquare,
  Users2,
  Target,
  CheckSquare,
  GitCompare,
  FileSpreadsheet,
  ShieldCheck,
  BarChart3,
  Menu,
  LogOut,
  ChevronDown,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, logout } = useAuth()
  const { marcas, activeBrand, isConsolidated, setActiveBrandId, currentBrandColor } = useBrand()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isSidebarPinned, setIsSidebarPinned] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)

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
      const [tarefasRes, dupRes, b2bRes, b2cRes] = await Promise.all([
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
          .collection('clientes_b2b')
          .getList(1, 1)
          .catch(() => ({ totalItems: 0 })),
        pb
          .collection('clientes_b2c')
          .getList(1, 1)
          .catch(() => ({ totalItems: 0 })),
      ])

      setTarefasVencidasCount(tarefasRes.totalItems || 0)
      setDuplicidadesCount(dupRes.totalItems || 0)
      setContatosCount((b2bRes.totalItems || 0) + (b2cRes.totalItems || 0))
    } catch {
      // Ignora erro de contagem para não travar layout
    }
  }

  useEffect(() => {
    fetchSidebarCounts()
    const timer = setInterval(fetchSidebarCounts, 30000)
    return () => clearInterval(timer)
  }, [activeBrand])

  const isExpanded = isSidebarPinned || isSidebarHovered

  // Menu principal do CRM conforme Pipedrive
  // Item unificado de "Negócios" no lugar de separar Pipelines e Oportunidades
  // Item "Contatos" unificado para Pessoas B2C e Organizações B2B
  const navItems = [
    { label: 'Visão Geral', path: '/', icon: LayoutDashboard },
    {
      label: 'Negócios',
      path: '/negocios',
      icon: KanbanSquare,
      badge: null,
      activeMatches: ['/negocios', '/pipelines', '/oportunidades'],
    },
    {
      label: 'Contatos',
      path: '/contatos',
      icon: Users2,
      badge: contatosCount > 0 ? contatosCount : null,
      activeMatches: ['/contatos', '/clientes'],
    },
    { label: 'Leads', path: '/leads', icon: Target, badge: null },
    {
      label: 'Tarefas',
      path: '/tarefas',
      icon: CheckSquare,
      badge: tarefasVencidasCount > 0 ? tarefasVencidasCount : null,
    },
    {
      label: 'Conciliação',
      path: '/conciliacao',
      icon: GitCompare,
      badge: duplicidadesCount > 0 ? duplicidadesCount : null,
    },
    { label: 'Importação', path: '/importacao', icon: FileSpreadsheet, badge: null },
    { label: 'Privacidade LGPD', path: '/preferencias', icon: ShieldCheck, badge: null },
    { label: 'Painéis & Relatórios', path: '/relatorios', icon: BarChart3, badge: null },
  ]

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

  const BrandSelectorComponent = ({ compact = false }: { compact?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all mx-auto"
            title={isConsolidated ? 'Consolidado NTC' : activeBrand?.nome}
          >
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-white/60 shadow-sm"
              style={{
                backgroundColor: isConsolidated ? '#3B82F6' : currentBrandColor,
              }}
            />
          </button>
        ) : (
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all text-left border border-white/10"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/50"
                style={{
                  backgroundColor: isConsolidated ? '#3B82F6' : currentBrandColor,
                }}
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-300 leading-none">
                  Marca Ativa
                </p>
                <p className="text-xs font-semibold text-white truncate mt-0.5">
                  {isConsolidated ? 'Consolidado (Todas)' : activeBrand?.nome}
                </p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-1.5" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1.5 shadow-xl border-slate-200">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-[#5D6D7E]">
          Contexto Multimarca
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setActiveBrandId(null)}
          className={cn(
            'flex items-center justify-between cursor-pointer rounded-lg text-xs font-semibold py-2 px-2.5',
            isConsolidated ? 'bg-sky-50 text-[#1B4F72]' : 'text-[#1C2833]',
          )}
        >
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-[#1B4F72]" />
            <span>Consolidado (Todas as Marcas)</span>
          </div>
          {isConsolidated && <span className="text-[10px] font-bold text-[#1B4F72]">Ativo</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-200/60" />
        {marcas.map((m) => {
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
                <span className="text-[10px] font-bold shrink-0" style={{ color: m.cor_destaque }}>
                  Ativo
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
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
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={cn(
          'hidden lg:flex flex-col bg-[#201A29] text-white shrink-0 sticky top-0 h-screen z-40 transition-all duration-200 ease-in-out border-r border-[#2C243B] select-none',
          isExpanded ? 'w-[240px] shadow-2xl' : 'w-[68px]',
        )}
      >
        {/* Top Logo / Pipedrive 'P' or 'N' Icon */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-[#2C243B]">
          <div className="flex items-center space-x-3 overflow-hidden">
            {/* Logo Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#017848] to-[#015835] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
              N
            </div>
            {isExpanded && (
              <div className="min-w-0 flex-1 animate-fade-in">
                <h2 className="text-sm font-bold text-white leading-none truncate tracking-tight">
                  CRM NTC
                </h2>
                <p className="text-[10px] text-slate-300 font-medium tracking-wider uppercase mt-1 truncate">
                  Multimarca
                </p>
              </div>
            )}
          </div>

          {isExpanded && (
            <button
              type="button"
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              title={isSidebarPinned ? 'Desafixar menu' : 'Fixar menu aberto'}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isSidebarPinned ? (
                <PanelLeftClose className="w-4 h-4 text-emerald-400" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Brand Selector */}
        <div className="p-2 border-b border-[#2C243B]">
          <BrandSelectorComponent compact={!isExpanded} />
        </div>

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

        {/* Footer: User profile */}
        <div className="p-2 border-t border-[#2C243B]">
          {isExpanded ? (
            <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#017848] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.name || 'Administrador'}
                  </p>
                  <p className="text-[10px] text-slate-300 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair do sistema"
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-11 h-11 rounded-xl mx-auto flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#017848] text-white flex items-center justify-center text-xs font-bold">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={12}
                className="bg-[#0B0C10] text-white text-xs"
              >
                Sair ({user?.name || 'Usuário'})
              </TooltipContent>
            </Tooltip>
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#017848] to-[#015835] text-white flex items-center justify-center font-bold text-base shadow-sm">
              N
            </div>
            <div>
              <SheetTitle className="text-sm font-bold text-white">CRM NTC</SheetTitle>
              <p className="text-[11px] text-slate-300">Pipedrive Edition</p>
            </div>
          </SheetHeader>

          <div className="p-3 border-b border-[#2C243B]">
            <BrandSelectorComponent />
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

            {/* Brand Accent Indicator Top Bar */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-full shadow-xs"
                style={{ backgroundColor: isConsolidated ? '#3B82F6' : currentBrandColor }}
              />
              <span className="text-slate-800 max-w-[150px] truncate">
                {isConsolidated ? 'Consolidado NTC' : activeBrand?.nome}
              </span>
            </div>
          </div>

          {/* Global Search centralizado estilo Pipedrive ("Pesquisar no Pipedrive") */}
          <div className="flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-6">
            <GlobalSearch />
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
                      {user?.name || 'Administrador NTC'}
                    </p>
                    <p className="text-[11px] leading-none text-slate-500">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/preferencias')}
                  className="text-xs cursor-pointer rounded-lg"
                >
                  <ShieldCheck className="w-4 h-4 mr-2 text-slate-500" />
                  Privacidade & LGPD
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/relatorios')}
                  className="text-xs cursor-pointer rounded-lg"
                >
                  <BarChart3 className="w-4 h-4 mr-2 text-slate-500" />
                  Painéis & Relatórios
                </DropdownMenuItem>
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

        {/* MOBILE BRAND HORIZONTAL CHIP ROW */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2 overflow-x-auto flex items-center space-x-1.5 scrollbar-none">
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
      </div>
    </div>
  )
}
