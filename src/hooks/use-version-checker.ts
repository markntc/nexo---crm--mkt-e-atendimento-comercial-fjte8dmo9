import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CURRENT_APP_VERSION,
  fetchRemoteVersion,
  isNewVersionAvailable,
  hasActiveUserModalOrWorkflow,
  type RemoteVersionInfo,
} from '@/lib/appVersion'

const SESSION_RELOAD_KEY = 'ntc_app_version_auto_reloaded'
const DISMISSED_VERSION_KEY = 'ntc_app_version_dismissed'

export interface UseVersionCheckerOptions {
  checkIntervalMs?: number // padrão: 2 minutos (120000)
  autoReloadIfIdle?: boolean // se verdadeiro e sem modal/digitação, recarrega uma vez
}

export interface UseVersionCheckerResult {
  currentVersion: string
  newVersion: string | null
  remoteInfo: RemoteVersionInfo | null
  isUpdateAvailable: boolean
  isDismissed: boolean
  dismissUpdate: () => void
  applyUpdate: () => void
  isChecking: boolean
  checkNow: () => Promise<void>
}

export function useVersionChecker(options: UseVersionCheckerOptions = {}): UseVersionCheckerResult {
  const {
    checkIntervalMs = 120000, // 2 minutos
    autoReloadIfIdle = true,
  } = options

  const [newVersion, setNewVersion] = useState<string | null>(null)
  const [remoteInfo, setRemoteInfo] = useState<RemoteVersionInfo | null>(null)
  const [isDismissed, setIsDismissed] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState<boolean>(false)
  const checkingRef = useRef(false)

  const applyUpdate = useCallback(() => {
    try {
      // Limpa sessionStorage de recarregamento para o próximo ciclo se necessário
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_RELOAD_KEY)
        // Força recarga sem cache no navegador
        window.location.reload()
      }
    } catch {
      window.location.replace(window.location.href)
    }
  }, [])

  const dismissUpdate = useCallback(() => {
    if (newVersion) {
      try {
        sessionStorage.setItem(DISMISSED_VERSION_KEY, newVersion)
      } catch {
        // Ignora erro de storage
      }
    }
    setIsDismissed(true)
  }, [newVersion])

  const checkNow = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    setIsChecking(true)

    try {
      const remote = await fetchRemoteVersion()
      if (remote && isNewVersionAvailable(remote.version)) {
        setRemoteInfo(remote)
        setNewVersion(remote.version)

        // Verifica se usuário já descartou essa mesma versão na sessão
        const dismissed = sessionStorage.getItem(DISMISSED_VERSION_KEY)
        if (dismissed === remote.version) {
          setIsDismissed(true)
          return
        }

        // Tenta auto-recarregar se for seguro (sem modal / workflow)
        // e se ainda não foi feito um reload nesta sessão para evitar loops
        const alreadyReloadedFor = sessionStorage.getItem(SESSION_RELOAD_KEY)

        if (autoReloadIfIdle && alreadyReloadedFor !== remote.version) {
          const isBusy = hasActiveUserModalOrWorkflow()
          if (!isBusy) {
            // Marca flag ANTES do reload para evitar loop em cascata caso o cache ainda persista
            try {
              sessionStorage.setItem(SESSION_RELOAD_KEY, remote.version)
            } catch {
              // ignora
            }
            console.log(
              `[Nexo NTC] Nova versão detectada (${remote.version}). Recarregando de forma transparente...`,
            )
            applyUpdate()
            return
          }
        }
      }
    } catch (err) {
      console.warn('[Nexo NTC] Verificação de versão encontrou uma falha silenciosa:', err)
    } finally {
      setIsChecking(false)
      checkingRef.current = false
    }
  }, [autoReloadIfIdle, applyUpdate])

  useEffect(() => {
    // 1. Verificação inicial após boot do app (aguarda 2 segundos para não concorrer com requests de login/dados)
    const initialTimer = setTimeout(() => {
      checkNow()
    }, 2000)

    // 2. Verificação periódica suave
    const intervalTimer = setInterval(() => {
      checkNow()
    }, checkIntervalMs)

    // 3. Verificação ao retornar à aba/janela (visibilitychange e focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkNow()
      }
    }

    const handleFocus = () => {
      checkNow()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(intervalTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkNow, checkIntervalMs])

  return {
    currentVersion: CURRENT_APP_VERSION,
    newVersion,
    remoteInfo,
    isUpdateAvailable: Boolean(newVersion && isNewVersionAvailable(newVersion)),
    isDismissed,
    dismissUpdate,
    applyUpdate,
    isChecking,
    checkNow,
  }
}
