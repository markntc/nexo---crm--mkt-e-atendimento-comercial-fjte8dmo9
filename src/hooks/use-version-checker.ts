import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CURRENT_APP_VERSION,
  fetchRemoteVersion,
  isNewVersionAvailable,
  hasActiveUserModalOrWorkflow,
  type RemoteVersionInfo,
} from '@/lib/appVersion'

const SESSION_RELOAD_KEY = 'ntc_app_version_auto_reloaded'
const LOCAL_RELOAD_KEY = 'ntc_app_version_auto_reloaded_v2'
const DISMISSED_VERSION_KEY = 'ntc_app_version_dismissed'

// Guard em memória persistente durante o ciclo de vida do script / módulo:
// Impede categoricamente mais de 1 recarga automática por versão mesmo se
// sessionStorage e localStorage falharem, forem limpos ou bloqueados no iframe.
const inMemoryReloadedVersions = new Set<string>()

/**
 * Detecta se o aplicativo está sendo executado dentro de um iframe
 * (ex: preview do builder, embed, etc.).
 */
export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    // Acesso a window.top bloqueado por cross-origin => está dentro de iframe
    return true
  }
}

/**
 * Verifica se já houve recarga para esta versão específica em qualquer camada
 * (memória, sessionStorage ou localStorage).
 */
function hasAlreadyReloadedForVersion(version: string): boolean {
  if (!version) return false

  // 1. Guard em memória
  if (inMemoryReloadedVersions.has(version)) {
    return true
  }

  // 2. Guard em sessionStorage
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const val = window.sessionStorage.getItem(SESSION_RELOAD_KEY)
      if (val === version) return true
    }
  } catch {
    // sessionStorage inacessível
  }

  // 3. Guard em localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(LOCAL_RELOAD_KEY)
      if (val === version) return true
    }
  } catch {
    // localStorage inacessível
  }

  return false
}

/**
 * Marca uma versão como recarregada em todas as camadas disponíveis
 * (memória, sessionStorage e localStorage com try/catch).
 */
function markVersionAsReloaded(version: string): void {
  if (!version) return

  // 1. Memória
  inMemoryReloadedVersions.add(version)

  // 2. sessionStorage
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_RELOAD_KEY, version)
    }
  } catch {
    // ignore
  }

  // 3. localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_RELOAD_KEY, version)
    }
  } catch {
    // ignore
  }
}

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
      if (typeof window !== 'undefined') {
        // Se uma nova versão está detectada, registra que já recarregou para ela antes de disparar
        if (newVersion) {
          markVersionAsReloaded(newVersion)
        }
        // Força recarga sem cache no navegador
        window.location.reload()
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.location.replace(window.location.href)
      }
    }
  }, [newVersion])

  const dismissUpdate = useCallback(() => {
    if (newVersion) {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(DISMISSED_VERSION_KEY, newVersion)
        }
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
        try {
          const dismissed =
            typeof window !== 'undefined' && window.sessionStorage
              ? window.sessionStorage.getItem(DISMISSED_VERSION_KEY)
              : null
          if (dismissed === remote.version) {
            setIsDismissed(true)
            return
          }
        } catch {
          // ignore
        }

        // REGRA CRÍTICA ANTI-LOOP:
        // 1. Em IFRAME (preview do builder): NUNCA recarregar automaticamente.
        //    Apenas exibe o banner de atualização para o usuário decidir quando aplicar.
        const inIframe = isRunningInIframe()
        if (inIframe) {
          // Apenas notifica visualmente através do banner
          return
        }

        // 2. FORA DE IFRAME:
        //    Tenta auto-recarregar se habilitado (autoReloadIfIdle), se o usuário não estiver em workflow/modal
        //    E NUNCA mais de 1x por versão (trava em memória + localStorage + sessionStorage).
        const alreadyReloaded = hasAlreadyReloadedForVersion(remote.version)

        if (autoReloadIfIdle && !alreadyReloaded) {
          const isBusy = hasActiveUserModalOrWorkflow()
          if (!isBusy) {
            // Marca flag em memória, sessionStorage e localStorage ANTES do reload
            markVersionAsReloaded(remote.version)

            console.log(
              `[Nexo NTC] Nova versão detectada (${remote.version}). Recarregando de forma transparente (fora de iframe)...`,
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
    // Com debounce/throttling de 30 segundos para não amplificar verificações repetitivas
    let lastEventCheckTime = 0
    const THROTTLE_MS = 30000

    const triggerThrottledCheck = () => {
      const now = Date.now()
      if (now - lastEventCheckTime < THROTTLE_MS) {
        return
      }
      lastEventCheckTime = now
      checkNow()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerThrottledCheck()
      }
    }

    const handleFocus = () => {
      triggerThrottledCheck()
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
