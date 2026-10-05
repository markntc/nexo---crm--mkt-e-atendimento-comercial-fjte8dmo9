// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { AuthRecord } from 'pocketbase'

import type { PerfilGlobal, PermissoesUsuario } from '@/types'

export interface AuthContextType {
  user: AuthRecord | null
  isAuthenticated: boolean
  isAdmin: boolean
  isDiretoria: boolean
  isSupervisor: boolean
  isVendedor: boolean
  isRepresentante: boolean
  perfilGlobal: PerfilGlobal
  permissoes: PermissoesUsuario
  marcasAutorizadasIds: string[] | null // null = todas (Admin/Diretoria sem restrição)
  escopoVisibilidade: 'proprios' | 'equipe' | 'marca_inteira'
  podeVerConsolidado: boolean
  podeAcessarPreferencias: boolean
  podeAcessarConciliacao: boolean
  podeAcessarRelatorios: boolean
  podeAcessarImportacao: boolean
  pode: (
    acao: 'preferencias' | 'conciliacao' | 'importacao' | 'consolidado' | 'relatorios',
    marcaId?: string,
  ) => boolean
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, pass: string, passConfirm: string) => Promise<void>
  confirmVerification: (token: string) => Promise<void>
  confirmEmailChange: (token: string, pass: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthRecord | null>(pb.authStore.record)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Escuta mudanças de authStore
    const unsubscribe = pb.authStore.onChange((token, record) => {
      setUser(record)
    })

    // Se houver token armazenado, tenta revalidar na montagem
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then((res) => {
          setUser(res.record)
        })
        .catch((err) => {
          // Só limpa o authStore se o token estiver explicitamente inválido ou expirado (status 401/403)
          // Se for erro transitório de rede (offline, timeout), não derruba a sessão local
          const isAuthError = err?.status === 401 || err?.status === 403
          if (isAuthError) {
            pb.authStore.clear()
            setUser(null)
          } else {
            console.warn('Falha transitória no authRefresh inicial, mantendo sessão em cache:', err)
          }
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  // Renovação periódica de sessão automática enquanto o usuário estiver ativo na aplicação
  useEffect(() => {
    // Se não estiver logado, não precisa agendar renovação
    if (!user || !pb.authStore.isValid) return

    let lastActivityTime = Date.now()
    let isRefreshing = false

    const handleUserActivity = () => {
      lastActivityTime = Date.now()
    }

    // Monitora interações do usuário (cliques, digitação, rolagem, toques)
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart']
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true })
    })

    // Checagem a cada 10 minutos (600.000 ms)
    // Se o usuário interagiu nas últimas 2 horas, realiza authRefresh proativo
    const intervalId = window.setInterval(
      async () => {
        if (isRefreshing) return
        if (!pb.authStore.isValid) return

        const inactiveTimeMs = Date.now() - lastActivityTime
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000

        // Se o usuário esteve ativo nas últimas 2h, renova o token
        if (inactiveTimeMs < TWO_HOURS_MS) {
          try {
            isRefreshing = true
            const res = await pb.collection('users').authRefresh()
            setUser(res.record)
          } catch (err: any) {
            const isAuthExpired = err?.status === 401 || err?.status === 403
            if (isAuthExpired) {
              console.warn('Sessão expirada no backend, redirecionando para login.')
              pb.authStore.clear()
              setUser(null)
            } else {
              console.warn('Tentativa periódica de authRefresh encontrou erro transitório:', err)
            }
          } finally {
            isRefreshing = false
          }
        }
      },
      10 * 60 * 1000,
    )

    // Também renova quando a aba voltar a ficar visível se o usuário esteve ativo
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && pb.authStore.isValid && !isRefreshing) {
        const inactiveTimeMs = Date.now() - lastActivityTime
        const THIRTY_MINUTES_MS = 30 * 60 * 1000
        if (inactiveTimeMs < THIRTY_MINUTES_MS) {
          try {
            isRefreshing = true
            const res = await pb.collection('users').authRefresh()
            setUser(res.record)
          } catch (err: any) {
            if (err?.status === 401 || err?.status === 403) {
              pb.authStore.clear()
              setUser(null)
            }
          } finally {
            isRefreshing = false
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  const login = async (email: string, pass: string) => {
    const res = await pb.collection('users').authWithPassword(email, pass)
    setUser(res.record)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const requestPasswordReset = async (email: string) => {
    await pb.collection('users').requestPasswordReset(email)
  }

  const confirmPasswordReset = async (token: string, pass: string, passConfirm: string) => {
    await pb.collection('users').confirmPasswordReset(token, pass, passConfirm)
  }

  const confirmVerification = async (token: string) => {
    await pb.collection('users').confirmVerification(token)
  }

  const confirmEmailChange = async (token: string, pass: string) => {
    await pb.collection('users').confirmEmailChange(token, pass)
    pb.authStore.clear()
    setUser(null)
  }

  const rawPerfil = (user?.perfil_global as PerfilGlobal) || 'Vendedor'
  const isSuperAdminEmail = user?.email === 'skip.adm@ntc.ind.br'
  const isAdmin = rawPerfil === 'Administrador' || isSuperAdminEmail
  const isDiretoria = !isAdmin && rawPerfil === 'Diretoria'
  const isSupervisor = !isAdmin && !isDiretoria && rawPerfil === 'Supervisor'
  const isRepresentante = !isAdmin && !isDiretoria && !isSupervisor && rawPerfil === 'Representante'
  const isVendedor =
    !isAdmin &&
    !isDiretoria &&
    !isSupervisor &&
    !isRepresentante &&
    (rawPerfil === 'Vendedor' || !rawPerfil)
  const perfilGlobal: PerfilGlobal = isAdmin
    ? 'Administrador'
    : isDiretoria
      ? 'Diretoria'
      : isSupervisor
        ? 'Supervisor'
        : isRepresentante
          ? 'Representante'
          : 'Vendedor'

  const userPermissoes = (user?.permissoes as PermissoesUsuario) || {}

  // Supervisor e Vendedor têm restrição de marcas autorizadas
  // Administrador e Diretoria têm acesso irrestrito a todas as marcas
  const marcasAutorizadasIds: string[] | null =
    isAdmin || isDiretoria
      ? null
      : Array.isArray(userPermissoes.marcas_permitidas)
        ? userPermissoes.marcas_permitidas
        : []

  // Escopo de visibilidade:
  // Administrador / Diretoria: marca_inteira
  // Supervisor: 'equipe' por padrão (ou o que estiver configurado)
  // Representante: SEMPRE 'proprios' fixo (só o dele, nunca equipe, nunca marca inteira)
  // Vendedor: 'proprios' por padrão (ou o configurado nas permissões)
  const escopoVisibilidade: 'proprios' | 'equipe' | 'marca_inteira' =
    isAdmin || isDiretoria
      ? 'marca_inteira'
      : isRepresentante
        ? 'proprios'
        : userPermissoes.escopo_visibilidade || (isSupervisor ? 'equipe' : 'proprios')

  // Regras da Matriz NTC:
  // 1. Consolidado ("Todas as marcas"): visível e selecionável APENAS para Administrador e Diretoria
  const podeVerConsolidado = isAdmin || isDiretoria

  // 5. Preferências: acessível APENAS por Administrador
  const podeAcessarPreferencias = isAdmin

  // 6. Conciliação: visível e executável para Administrador, Supervisor e Vendedor; OCULTO para Diretoria e Representante
  const podeAcessarConciliacao =
    !isRepresentante && (isAdmin || (!isDiretoria && userPermissoes.pode_conciliar !== false))

  // 7. Relatórios & Painéis: Administrador, Diretoria, Supervisor e Vendedor; OCULTO e BLOQUEADO para Representante
  const podeAcessarRelatorios = !isRepresentante

  // 8. Importação: Administrador e Vendedor/Supervisor (se autorizado); OCULTO e BLOQUEADO para Diretoria e Representante
  const podeAcessarImportacao =
    !isRepresentante && !isDiretoria && (isAdmin || userPermissoes.pode_importar !== false)

  const pode = (
    acao: 'preferencias' | 'conciliacao' | 'importacao' | 'consolidado' | 'relatorios',
    marcaId?: string,
  ): boolean => {
    if (acao === 'preferencias') return podeAcessarPreferencias
    if (acao === 'consolidado') return podeVerConsolidado
    if (acao === 'conciliacao') return podeAcessarConciliacao
    if (acao === 'relatorios') return podeAcessarRelatorios
    if (acao === 'importacao') return podeAcessarImportacao
    if (marcaId && marcasAutorizadasIds !== null) {
      return marcasAutorizadasIds.includes(marcaId)
    }
    return true
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && pb.authStore.isValid,
        isAdmin,
        isDiretoria,
        isSupervisor,
        isVendedor,
        isRepresentante,
        perfilGlobal,
        permissoes: userPermissoes,
        marcasAutorizadasIds,
        escopoVisibilidade,
        podeVerConsolidado,
        podeAcessarPreferencias,
        podeAcessarConciliacao,
        podeAcessarRelatorios,
        podeAcessarImportacao,
        pode,
        isLoading,
        login,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        confirmVerification,
        confirmEmailChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
