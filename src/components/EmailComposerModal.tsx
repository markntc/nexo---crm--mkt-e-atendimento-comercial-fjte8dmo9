// src/components/EmailComposerModal.tsx
// Redator de e-mail centralizado (padrão visual dos demais modais do CRM NTC).
// Envia pela conta Outlook conectada do PRÓPRIO usuário autenticado
// (app connectors, toolkit "outlook") — nunca por conta do builder.
// Sem templates nesta fase: assunto e corpo em texto livre.
import { useEffect, useState } from 'react'
import { Mail, Loader2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConnectorButton } from '@/components/skip/ConnectorButton'
import { toast } from '@/hooks/use-toast'
import { connect, execute, listConnectors, type ConnectorState } from '@/lib/skipConnectors'

const OUTLOOK_TOOLKIT = 'outlook'
const SEND_EMAIL_TOOL = 'OUTLOOK_SEND_EMAIL'

const MSG_SEM_OUTLOOK = 'Conecte seu Outlook para enviar e-mails'

export interface EmailComposerTarget {
  nome: string
  email: string | null | undefined
}

interface EmailComposerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: EmailComposerTarget | null
}

const erroTexto = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : String(err ?? '')

export function EmailComposerModal({ open, onOpenChange, target }: EmailComposerModalProps) {
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [sending, setSending] = useState(false)
  const [connectStatus, setConnectStatus] = useState<ConnectorState | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  // URL da tela de consentimento, quando o navegador bloqueou a janela.
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null)

  const temEmail = !!target?.email?.trim()
  const destinatario = target?.email?.trim() || ''

  // Ao abrir: limpa o rascunho e recarrega o status do conector Outlook.
  useEffect(() => {
    if (!open) return
    setAssunto('')
    setCorpo('')
    setConnectError(null)
    setBlockedUrl(null)
    setConnectStatus(null)
    let cancelled = false
    listConnectors()
      .then((all) => {
        if (!cancelled) {
          setConnectStatus(all.find((c) => c.toolkit === OUTLOOK_TOOLKIT) ?? null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setConnectError(erroTexto(err))
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Volta da tela de consentimento: o foco retorna à janela, recarrega o status.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const refresh = () => {
      listConnectors()
        .then((all) => {
          if (!cancelled) {
            setConnectStatus(all.find((c) => c.toolkit === OUTLOOK_TOOLKIT) ?? null)
          }
        })
        .catch(() => {
          // silencioso: a próxima interação reporta
        })
    }
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
    }
  }, [open])

  const handleConnect = async () => {
    setConnectError(null)
    setBlockedUrl(null)
    try {
      await connect(OUTLOOK_TOOLKIT)
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'url' in err &&
        typeof (err as { url: unknown }).url === 'string'
      ) {
        setBlockedUrl((err as { url: string }).url)
      } else {
        setConnectError(erroTexto(err))
      }
    }
  }

  const handleSend = async () => {
    if (!destinatario || !assunto.trim() || !corpo.trim() || sending) return
    setSending(true)
    try {
      const r = await execute(SEND_EMAIL_TOOL, {
        to: destinatario,
        subject: assunto.trim(),
        body: corpo,
        is_html: false,
      })
      if (!r.successful) {
        // Erro do provedor (ex.: conta desconectada, token expirado): mensagem clara.
        const detalhe = r.error || 'Não foi possível enviar o e-mail. Tente novamente.'
        const pareceDesconectado =
          detalhe.toLowerCase().includes('connect') ||
          detalhe.toLowerCase().includes('auth') ||
          detalhe.toLowerCase().includes('401') ||
          detalhe.toLowerCase().includes('token')
        toast({
          variant: 'destructive',
          title: 'Falha ao enviar e-mail',
          description: pareceDesconectado
            ? `${MSG_SEM_OUTLOOK}. Use o botão "Conectar Outlook" acima e tente de novo.`
            : detalhe,
        })
        return
      }
      toast({
        title: 'E-mail enviado',
        description: `Mensagem enviada para ${destinatario} pela sua conta Outlook.`,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      // Erro lançado = resultado desconhecido: NÃO sugerimos reenvio cego.
      console.error('Erro ao enviar e-mail via Outlook:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao enviar e-mail',
        description:
          'O envio pode não ter sido concluído. Verifique a conexão com o Outlook e confira a caixa "Itens Enviados" antes de tentar de novo.',
      })
    } finally {
      setSending(false)
    }
  }

  const naoConectado = !connectStatus || connectStatus.status !== 'connected'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#1C2833]">
            <Mail className="w-4 h-4 text-[#017848]" />
            Enviar e-mail
            {target?.nome ? (
              <span className="text-slate-500 font-medium">— {target.nome}</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {!temEmail ? (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Este contato não possui e-mail cadastrado. Edite a ficha para incluir um e-mail antes
              de enviar.
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {naoConectado && (
              <div className="space-y-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-start gap-2 text-xs text-slate-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>{MSG_SEM_OUTLOOK}</span>
                </div>
                <ConnectorButton toolkit={OUTLOOK_TOOLKIT} name="Outlook" className="pt-1" />
                {blockedUrl && (
                  <a
                    href={blockedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setBlockedUrl(null)}
                    className="text-[11px] underline text-slate-700"
                  >
                    Abrir página de conexão
                  </a>
                )}
                {connectError && <p className="text-[11px] text-red-600">{connectError}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email-to" className="text-xs font-semibold text-slate-600">
                Para
              </Label>
              <Input
                id="email-to"
                type="email"
                value={destinatario}
                readOnly
                className="h-9 text-xs rounded-xl bg-slate-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-xs font-semibold text-slate-600">
                Assunto
              </Label>
              <Input
                id="email-subject"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Assunto da mensagem"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-body" className="text-xs font-semibold text-slate-600">
                Mensagem
              </Label>
              <Textarea
                id="email-body"
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                placeholder="Escreva sua mensagem em texto livre..."
                rows={6}
                className="text-xs rounded-xl"
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-xl border-[#E3E7EB]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={sending || !temEmail || !assunto.trim() || !corpo.trim() || naoConectado}
            onClick={handleSend}
            className="text-xs font-bold rounded-xl bg-[#017848] hover:bg-[#01653c] text-white"
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
