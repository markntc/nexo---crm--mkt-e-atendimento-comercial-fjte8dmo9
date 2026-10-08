import React from 'react'
import { RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVersionChecker } from '@/hooks/use-version-checker'

interface VersionUpdateBannerProps {
  className?: string
}

export const VersionUpdateBanner: React.FC<VersionUpdateBannerProps> = ({ className = '' }) => {
  const { isUpdateAvailable, isDismissed, newVersion, currentVersion, applyUpdate, dismissUpdate } =
    useVersionChecker()

  if (!isUpdateAvailable || isDismissed) {
    return null
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={`relative z-50 bg-[#001f3f] border-b border-emerald-500/40 text-white shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="text-xs sm:text-sm text-slate-100 font-medium">
            <span>Uma nova versão do Nexo NTC está disponível</span>
            {newVersion && (
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-600/30 text-emerald-300 border border-emerald-500/30">
                v{newVersion}
              </span>
            )}
            <span className="hidden sm:inline text-slate-300 ml-1.5 font-normal">
              (versão atual: v{currentVersion}). Atualize para carregar novos recursos e correções
              de listagem.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
          <Button
            size="sm"
            onClick={applyUpdate}
            className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar agora
          </Button>

          <button
            type="button"
            onClick={dismissUpdate}
            aria-label="Lembrar mais tarde"
            title="Lembrar mais tarde"
            className="h-8 w-8 inline-flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default VersionUpdateBanner
