import React from 'react'
import logoNtc from '@/assets/marca-institucional-ntccompanycoresinvertidas-acadd.jpg'
import { cn } from '@/lib/utils'

export interface NtcLogoProps {
  /**
   * 'icon': apenas o símbolo das 3 hastes / paralelogramos vermelhos (para sidebar recolhida, avatares, chips compactos)
   * 'horizontal': símbolo vermelho + wordmark NTC COMPANY em formato horizontal
   * 'full': logotipo completo quadrado original
   */
  variant?: 'icon' | 'horizontal' | 'full'
  className?: string
  alt?: string
  rounded?: boolean
}

/**
 * Logotipo oficial da NTC Company.
 * O arquivo original é uma imagem quadrada 1:1 com fundo azul-marinho (#00004d ~ #060950),
 * símbolo de 3 barras/paralelogramos vermelhos à esquerda e "NTC COMPANY" à direita.
 */
export const NtcLogo: React.FC<NtcLogoProps> = ({
  variant = 'icon',
  className,
  alt = 'NTC Company',
  rounded = true,
}) => {
  if (variant === 'icon') {
    // Foca apenas no símbolo vermelho à esquerda (as 3 hastes inclinadas)
    // No layout original: o símbolo está entre ~15% e 42% da largura horizontal e centrado verticalmente.
    return (
      <div
        className={cn(
          'relative overflow-hidden shrink-0 select-none flex items-center justify-center bg-[#060950]',
          rounded && 'rounded-xl',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <img
          src={logoNtc}
          alt={alt}
          className="absolute max-w-none pointer-events-none select-none"
          style={{
            width: '275%',
            height: '275%',
            objectFit: 'cover',
            left: '-44%',
            top: '-87%',
          }}
          loading="eager"
          decoding="async"
        />
      </div>
    )
  }

  if (variant === 'horizontal') {
    // Exibe o símbolo vermelho + o texto NTC COMPANY cortando as margens superior e inferior vazias
    // para um visual horizontal perfeito na sidebar expandida ou banners
    return (
      <div
        className={cn(
          'relative overflow-hidden shrink-0 select-none bg-[#060950]',
          rounded && 'rounded-xl',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <img
          src={logoNtc}
          alt={alt}
          className="w-full h-full object-cover object-center pointer-events-none select-none scale-[1.38]"
          loading="eager"
          decoding="async"
        />
      </div>
    )
  }

  // variant === 'full'
  return (
    <div
      className={cn(
        'relative overflow-hidden shrink-0 select-none bg-[#060950] flex items-center justify-center',
        rounded && 'rounded-xl',
        className,
      )}
      role="img"
      aria-label={alt}
    >
      <img
        src={logoNtc}
        alt={alt}
        className="w-full h-full object-contain pointer-events-none select-none"
        loading="eager"
        decoding="async"
      />
    </div>
  )
}

export default NtcLogo
