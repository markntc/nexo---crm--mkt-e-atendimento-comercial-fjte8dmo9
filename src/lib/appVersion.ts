// src/lib/appVersion.ts
// Versão canônica compilada no bundle atual do cliente
import pb from '@/lib/pocketbase/client'

export const CURRENT_APP_VERSION = '0.0.45'
export const CURRENT_BUILD_TIMESTAMP = 1791477900000

export interface RemoteVersionInfo {
  version: string
  buildTime?: string
  buildTimestamp?: number
  source?: 'version_json' | 'index_html' | 'backend_api'
}

/**
 * Verifica se o usuário tem modal aberto ou formulário/operação em andamento
 * para evitar interrupção abrupta.
 */
export function hasActiveUserModalOrWorkflow(): boolean {
  if (typeof document === 'undefined') return false

  // 1. Radix Dialog, Sheet, AlertDialog, Popover, Select aberto
  const hasRadixDialog = Boolean(
    document.querySelector('[role="dialog"]') ||
    document.querySelector('[role="alertdialog"]') ||
    document.querySelector('[data-state="open"][data-radix-popper-content-wrapper]') ||
    document.querySelector('.radix-state-open'),
  )

  // 2. Elemento com classe de modal ou drawer aberta
  const hasModalClass = Boolean(
    document.querySelector('.fixed.inset-0.z-50') || document.querySelector('[aria-modal="true"]'),
  )

  // 3. Inputs ou textareas focados onde o usuário pode estar digitando
  const activeEl = document.activeElement
  const isTyping = Boolean(
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      (activeEl as HTMLElement).isContentEditable),
  )

  return hasRadixDialog || hasModalClass || isTyping
}

/**
 * Consulta a versão remota atualmente publicada no servidor através de múltiplas estratégias seguras:
 * 1. /version.json com cache-busting
 * 2. Fetch do index.html (inspecionando a meta tag app-version ou hash dos scripts)
 * 3. /backend/v1/versao no PocketBase
 */
export async function fetchRemoteVersion(): Promise<RemoteVersionInfo | null> {
  const cacheBuster = `_cb=${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  // Estratégia 1: /version.json
  try {
    const res = await fetch(`/version.json?${cacheBuster}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data.version === 'string' && data.version.trim()) {
        return {
          version: data.version.trim(),
          buildTime: data.buildTime,
          buildTimestamp: data.buildTimestamp,
          source: 'version_json',
        }
      }
    }
  } catch {
    // Continua para a próxima estratégia
  }

  // Estratégia 2: Fetch do index.html remoto
  try {
    const res = await fetch(`/?${cacheBuster}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    })
    if (res.ok) {
      const htmlText = await res.text()
      // Tenta achar <meta name="app-version" content="(.*?)"
      const metaMatch = htmlText.match(
        /<meta[^>]*name=["']app-version["'][^>]*content=["']([^"']+)["']/i,
      )
      if (metaMatch && metaMatch[1]) {
        return {
          version: metaMatch[1].trim(),
          source: 'index_html',
        }
      }
    }
  } catch {
    // Continua para a próxima estratégia
  }

  // Estratégia 3: Hook do backend /backend/v1/versao via pb.send
  try {
    const data = await pb.send<{ version?: string; updated_at?: string; timestamp?: number }>(
      `/backend/v1/versao?${cacheBuster}`,
      {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      },
    )
    if (data && typeof data.version === 'string' && data.version.trim()) {
      return {
        version: data.version.trim(),
        buildTime: data.updated_at,
        buildTimestamp: data.timestamp,
        source: 'backend_api',
      }
    }
  } catch {
    // Nenhuma estratégia respondeu
  }

  return null
}

/**
 * Compara se a versão remota é diferente da versão atual do app em execução.
 */
export function isNewVersionAvailable(remoteVersion: string): boolean {
  if (!remoteVersion) return false
  const cleanRemote = remoteVersion.trim().replace(/^v/, '')
  const cleanCurrent = CURRENT_APP_VERSION.trim().replace(/^v/, '')
  return cleanRemote !== cleanCurrent
}
