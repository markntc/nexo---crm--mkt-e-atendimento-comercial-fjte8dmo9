// src/components/Layout.tsx
import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useBrand } from '@/contexts/BrandContext'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  LayoutDashboard,
  KanbanSquare,
  Users2,
  Target,
  Briefcase,
  CheckSquare,
  GitCompare,
  FileSpreadsheet,
  ShieldCheck,
  BarChart3,
  Menu,
  LogOut,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, logout } = useAuth()
  const { marcas, activeBrand, isConsolidated, setActiveBrandId, currentBrandColor } = useBrand()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { label: 'Visão Geral', path: '/', icon: LayoutDashboard },
    { label: 'Pipelines', path: '/pipelines', icon: KanbanSquare },
    { label: 'Clientes', path: '/clientes', icon: Users2 },
    { label: 'Leads', path: '/leads', icon: Target },
    { label: 'Oportunidades', path: '/oportunidades', icon: Briefcase },
    { label: 'Tarefas', path: '/tarefas', icon: CheckSquare },
    { label: 'Conciliação', path: '/conciliacao', icon: GitCompare },
    { label: 'Importação', path: '/importacao', icon: FileSpreadsheet },
    { label: 'Preferências', path: '/preferencias', icon: ShieldCheck },
    { label: 'Relatórios', path: '/relatorios', icon: BarChart3 },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const BrandSelectorComponent = ({ className }: { className?: string }) => (
    <div className={cn('relative', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#D5DBDB] bg-white hover:bg-slate-50 transition-colors shadow-xs"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                style={{
                  backgroundColor: isConsolidated ? '#1B4F72' : currentBrandColor,
                }}
              />
              <div className="text-left min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-[#5D6D7E] leading-tight">
                  Marca Ativa
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#1C2833] truncate">
                  {isConsolidated ? 'Consolidado (Todas)' : activeBrand?.nome}
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#5D6D7E] shrink-0 ml-1.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-1.5 shadow-lg border-[#D5DBDB]">
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-[#5D6D7E]">
            Contexto Multimarca
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setActiveBrandId(null)}
            className={cn(
              'flex items-center justify-between cursor-pointer rounded-md text-xs font-semibold py-2 px-2.5',
              isConsolidated ? 'bg-slate-100 text-[#1B4F72]' : 'text-[#1C2833]',
            )}
          >
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#1B4F72]" />
              <span>Consolidado (Todas as Marcas)</span>
            </div>
            {isConsolidated && <span className="text-[10px] font-bold text-[#1B4F72]">Ativo</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#D5DBDB]/60" />
          {marcas.map((m) => {
            const isSelected = !isConsolidated && activeBrand?.id === m.id
            return (
              <DropdownMenuItem
                key={m.id}
                onClick={() => setActiveBrandId(m.id)}
                className={cn(
                  'flex items-center justify-between cursor-pointer rounded-md text-xs font-semibold py-2 px-2.5',
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
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F6F7] flex flex-col lg:flex-row text-[#1C2833]">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white border-r border-[#D5DBDB] shrink-0 sticky top-0 h-screen z-30">
        {/* Brand Header / Logo */}
        <div className="p-4 border-b border-[#D5DBDB] flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#1B4F72] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#1C2833] leading-none truncate">Nexo</h2>
            <p className="text-[11px] text-[#5D6D7E] mt-1 font-medium truncate">NTC COMPANT</p>
          </div>
        </div>

        {/* Brand Selector */}
        <div className="p-3 border-b border-[#D5DBDB]/70 bg-slate-50/50">
          <BrandSelectorComponent />
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5D6D7E]">
            Módulos CRM
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#1B4F72] text-white shadow-xs font-semibold'
                    : 'text-[#5D6D7E] hover:text-[#1C2833] hover:bg-slate-100/80',
                )}
              >
                <Icon
                  className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-[#5D6D7E]')}
                />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>

        {/* User Footer */}
      </aside>

      {/* MOBILE DRAWER */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-white">
          <SheetHeader className="p-4 border-b border-[#D5DBDB] text-left flex flex-row items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#1B4F72] text-white flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <SheetTitle className="text-sm font-bold text-[#1C2833]">
                NTC Sistema Integrado
              </SheetTitle>
              <p className="text-[11px] text-[#5D6D7E]">Governança & CRM Multimarca</p>
            </div>
          </SheetHeader>

          <div className="p-3 border-b border-[#D5DBDB]/70">
            <BrandSelectorComponent />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate(item.path)
                  }}
                  className={cn(
                    'w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'bg-[#1B4F72] text-white font-semibold'
                      : 'text-[#5D6D7E] hover:text-[#1C2833] hover:bg-slate-100',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>

          <div className="p-4 border-t border-[#D5DBDB] bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#1C2833] truncate">
                  {user?.name || 'Administrador'}
                </p>
                <p className="text-[10px] text-[#5D6D7E] truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-red-600 hover:bg-red-50"
              >
                Sair
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP HEADER */}
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-[#D5DBDB] flex items-center justify-between px-3 sm:px-6">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Hamburger on Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 text-[#5D6D7E]"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Brand Accent Indicator */}
            <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-100 border border-[#D5DBDB]/80 text-xs font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: isConsolidated ? '#1B4F72' : currentBrandColor }}
              />
              <span className="text-[#1C2833] max-w-[140px] truncate">
                {isConsolidated ? 'Consolidado NTC' : activeBrand?.nome}
              </span>
            </div>
          </div>

          {/* Global Search */}
          <div className="flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-4">
            <GlobalSearch />
          </div>

          {/* User Profile Menu */}
          <div className="flex items-center space-x-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1B4F72] text-white flex items-center justify-center text-xs font-bold">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#5D6D7E] hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-[#D5DBDB]">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-bold leading-none text-[#1C2833]">
                      {user?.name || 'Administrador NTC'}
                    </p>
                    <p className="text-[11px] leading-none text-[#5D6D7E]">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#D5DBDB]/60" />
                <DropdownMenuItem
                  onClick={() => navigate('/preferencias')}
                  className="text-xs cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 mr-2 text-[#5D6D7E]" />
                  Privacidade & LGPD
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/relatorios')}
                  className="text-xs cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 mr-2 text-[#5D6D7E]" />
                  Painéis & Relatórios
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#D5DBDB]/60" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-xs text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair do Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* MOBILE BRAND HORIZONTAL CHIP ROW */}
        <div className="lg:hidden bg-white border-b border-[#D5DBDB] px-3 py-2 overflow-x-auto flex items-center space-x-1.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveBrandId(null)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors border',
              isConsolidated
                ? 'bg-[#1B4F72] text-white border-[#1B4F72]'
                : 'bg-slate-50 text-[#5D6D7E] border-[#D5DBDB]',
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
                  'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors border flex items-center space-x-1.5',
                  isSelected
                    ? 'text-white border-transparent'
                    : 'bg-white text-[#5D6D7E] border-[#D5DBDB]',
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-[1600px] w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
