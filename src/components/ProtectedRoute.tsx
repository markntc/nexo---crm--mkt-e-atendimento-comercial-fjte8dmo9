// src/components/ProtectedRoute.tsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  allowedRoles?: ('Administrador' | 'Supervisor' | 'Vendedor' | 'Diretoria' | 'Representante')[]
  denyRepresentante?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  allowedRoles,
  denyRepresentante = false,
}) => {
  const { isAuthenticated, isLoading, isAdmin, isRepresentante, perfilGlobal } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F6F7] text-xs text-[#5D6D7E] space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B4F72]" />
        <span>Validando sessão segura NTC...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    // Acesso não autorizado a rotas restritas a Administrador (ex: /preferencias)
    return <Navigate to="/" replace />
  }

  if (denyRepresentante && isRepresentante) {
    // Representante tem escopo restrito (sem preferências, conciliação, importação, relatórios, tarefas, etc.)
    return <Navigate to="/" replace />
  }

  if (allowedRoles && !allowedRoles.includes(perfilGlobal)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
