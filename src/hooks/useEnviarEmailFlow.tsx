// src/hooks/useEnviarEmailFlow.tsx
// Fluxo do botão "Enviar e-mail" (fichas de Pessoa/Organização e modal de negócio).
// O botão é SEMPRE clicável: cada clique leva a uma ação —
//   1. cliente sem e-mail → mensagem clara (toast);
//   2. Outlook não conectado → inicia o login Microsoft na hora
//      (mesmo mecanismo do app connectors, sem OAuth reimplementado);
//   3. conectado + com e-mail → abre o redator (EmailComposerModal).
import { useCallback, useRef, useState } from 'react'

import { toast } from '@/hooks/use-toast'
import { ConnectPopupBlockedError, connect, listConnectors } from '@/lib/skipConnectors'

const OUTLOOK_TOOLKIT = 'outlook'

export const MSG_SEM_EMAIL = 'Não há e-mail de contato cadastrado'

export interface EmailFlowTarget {
  nome: string
  email: string | null
}

interface UseEnviarEmailFlowArgs {
  /** Alvo do clique, lido no momento do clique (nunca valor defasado). */
  getTarget: () => EmailFlowTarget | null
  /** Abre o redator com o destinatário preenchido. */
  onSuccess: (target: { nome: string; email: string }) => void
}

const erroTexto = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : String(err ?? '')

export function useEnviarEmailFlow({ getTarget, onSuccess }: UseEnviarEmailFlowArgs) {
  const [isBusy, setIsBusy] = useState(false)
  const busyRef = useRef(false)

  const handleEnviarEmail = useCallback(async () => {
    if (busyRef.current) return
    const target = getTarget()
    if (!target) return

    // Cliente sem e-mail: mensagem clara, sem abrir o redator.
    if (!target.email?.trim()) {
      toast({
        title: MSG_SEM_EMAIL,
        description: 'Edite a ficha para incluir um e-mail antes de enviar.',
      })
      return
    }

    busyRef.current = true
    setIsBusy(true)
    try {
      // Status do conector: se a checagem falhar (ex.: sessão recém-aberta),
      // seguimos para o connect — todo clique leva a uma ação.
      let connected = false
      try {
        const all = await listConnectors()
        connected = all.find((c) => c.toolkit === OUTLOOK_TOOLKIT)?.status === 'connected'
      } catch {
        connected = false
      }

      if (!connected) {
        // Login Microsoft imediatamente: conecta uma vez e mantém conectado
        // (conta do próprio usuário, app connectors).
        try {
          await connect(OUTLOOK_TOOLKIT)
          return
        } catch (err: unknown) {
          if (err instanceof ConnectPopupBlockedError) {
            // Pop-up bloqueado: oferece o link de consentimento como ação do toast.
            toast({
              title: 'Pop-up bloqueado pelo navegador',
              description: 'Use o link abaixo para concluir a conexão com o Outlook.',
              action: (
                <a
                  href={err.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold underline text-[#1B4F72]"
                >
                  Abrir página de conexão
                </a>
              ),
            })
            return
          }
          toast({
            variant: 'destructive',
            title: 'Não foi possível iniciar a conexão com o Outlook',
            description: erroTexto(err),
          })
          return
        }
      }

      // Conectado: abre o redator com o destinatário preenchido.
      onSuccess(target as { nome: string; email: string })
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }, [getTarget, onSuccess])

  return { handleEnviarEmail, isBusy }
}
