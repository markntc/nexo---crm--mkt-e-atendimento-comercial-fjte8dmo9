// src/components/WonDealCelebrationModal.tsx
// Modal de parabéns exibido após um negócio ser movido para "Ganho" (apenas para quem executou a ação)
import { Building2, DollarSign, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrencyBRL } from '@/lib/formatters'

export interface WonDealCelebrationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteNome: string
  valor: number
  vendedorNome: string
}

export function WonDealCelebrationModal({
  open,
  onOpenChange,
  clienteNome,
  valor,
  vendedorNome,
}: WonDealCelebrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl font-black text-[#017848]">
            Negócio Ganho! 🏆
          </DialogTitle>
          <DialogDescription>Parabéns pelo fechamento!</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[#E3E7EB] bg-[#F6F7F9] divide-y divide-[#E3E7EB]">
          <div className="flex items-center gap-3 px-4 py-3">
            <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 w-20 shrink-0">Cliente</span>
            <span className="text-sm font-semibold text-slate-900 truncate">{clienteNome}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <DollarSign className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 w-20 shrink-0">Valor</span>
            <span className="text-sm font-black text-slate-900">{formatCurrencyBRL(valor)}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <UserRound className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 w-20 shrink-0">Vendedor</span>
            <span className="text-sm font-semibold text-slate-900 truncate">{vendedorNome}</span>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full bg-[#017848] hover:bg-[#015f3a] text-white"
        >
          Continuar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
