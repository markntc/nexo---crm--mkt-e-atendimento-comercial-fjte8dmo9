// src/lib/confetti.ts
// Confete em canvas próprio (sem dependência externa). Cria um canvas fixo sobre a tela,
// dispara as partículas a partir de um ponto (ex.: o card arrastado) e remove o canvas ao final.

const CONFETTI_COLORS = ['#017848', '#FFD700', '#EAB308', '#FFFFFF']
const PARTICLE_COUNT = 140
const DURATION_MS = 2800
const FADE_OUT_MS = 600

export interface ConfettiOrigin {
  /** Coordenada X em pixels do viewport */
  x: number
  /** Coordenada Y em pixels do viewport */
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  color: string
  rotation: number
  vr: number
}

/**
 * Dispara uma explosão de confete. Sem `origin`, a explosão sai do centro da tela.
 */
export function fireConfetti(origin?: ConfettiOrigin): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const originX = origin?.x ?? viewportW / 2
  const originY = origin?.y ?? viewportH / 2

  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  canvas.width = viewportW * dpr
  canvas.height = viewportH * dpr
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }
  ctx.scale(dpr, dpr)

  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
    // Leque para cima, com dispersão horizontal
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2
    const speed = 6 + Math.random() * 9
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
    }
  })

  const start = performance.now()

  const frame = (now: number) => {
    const elapsed = now - start
    const alpha =
      elapsed > DURATION_MS - FADE_OUT_MS ? Math.max(0, (DURATION_MS - elapsed) / FADE_OUT_MS) : 1

    ctx.clearRect(0, 0, viewportW, viewportH)
    ctx.globalAlpha = alpha

    for (const p of particles) {
      p.vy += 0.28 // gravidade
      p.vx *= 0.985 // resistência do ar
      p.vy *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.vr

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      // Contorno suave para o branco continuar visível sobre fundo claro
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }

    if (elapsed < DURATION_MS) {
      requestAnimationFrame(frame)
    } else {
      canvas.remove()
    }
  }

  requestAnimationFrame(frame)
}
