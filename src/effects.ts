interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  coin: boolean
}

interface Ring {
  x: number
  y: number
  radius: number
  life: number
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export class ParticleField {
  private readonly ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private rings: Ring[] = []
  private frame = 0
  private lastTime = 0
  private width = 0
  private height = 0

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    this.ctx = ctx
    this.resize()
    window.addEventListener('resize', this.resize, { passive: true })
  }

  burst(x: number, y: number, combo: number): void {
    if (prefersReducedMotion()) return

    const count = Math.min(30, 10 + Math.floor(combo / 2))
    const palette = ['#70c70e', '#e8d5af', '#c99a4a', '#f4efe3']

    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35
      const speed = 130 + Math.random() * 330
      const coin = Math.random() < 0.22
      const maxLife = 0.45 + Math.random() * 0.45
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife,
        size: coin ? 4 + Math.random() * 4 : 1.5 + Math.random() * 3,
        color: coin ? '#c99a4a' : palette[Math.floor(Math.random() * palette.length)] ?? '#70c70e',
        coin,
      })
    }

    this.rings.push({ x, y, radius: 12, life: 0.42 })
    if (this.particles.length > 180) {
      this.particles.splice(0, this.particles.length - 180)
    }
    this.start()
  }

  destroy(): void {
    window.removeEventListener('resize', this.resize)
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  private resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private start(): void {
    if (this.frame !== 0) return
    this.lastTime = performance.now()
    this.frame = requestAnimationFrame(this.tick)
  }

  private tick = (time: number): void => {
    const delta = Math.min((time - this.lastTime) / 1000, 0.05)
    this.lastTime = time
    this.ctx.clearRect(0, 0, this.width, this.height)

    for (const particle of this.particles) {
      particle.life -= delta
      particle.vy += 920 * delta
      particle.vx *= 0.992
      particle.x += particle.vx * delta
      particle.y += particle.vy * delta

      const alpha = Math.max(0, particle.life / particle.maxLife)
      this.ctx.globalAlpha = alpha
      this.ctx.fillStyle = particle.color

      if (particle.coin) {
        this.ctx.beginPath()
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        this.ctx.fill()
        this.ctx.globalAlpha = alpha * 0.45
        this.ctx.strokeStyle = '#3d2b12'
        this.ctx.lineWidth = 1
        this.ctx.stroke()
      } else {
        this.ctx.save()
        this.ctx.translate(particle.x, particle.y)
        this.ctx.rotate((particle.life * 9) % Math.PI)
        this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)
        this.ctx.restore()
      }
    }

    this.particles = this.particles.filter((particle) => particle.life > 0)

    for (const ring of this.rings) {
      ring.life -= delta
      ring.radius += 340 * delta
      this.ctx.globalAlpha = Math.max(0, ring.life / 0.42) * 0.55
      this.ctx.strokeStyle = '#70c70e'
      this.ctx.lineWidth = 1.5
      this.ctx.beginPath()
      this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2)
      this.ctx.stroke()
    }

    this.rings = this.rings.filter((ring) => ring.life > 0)
    this.ctx.globalAlpha = 1

    if (this.particles.length > 0 || this.rings.length > 0) {
      this.frame = requestAnimationFrame(this.tick)
    } else {
      this.frame = 0
    }
  }
}

const shakeAnimations = new WeakMap<Element, Animation>()

export function shakeElement(element: HTMLElement, strength: number): void {
  if (prefersReducedMotion()) return
  shakeAnimations.get(element)?.cancel()
  const amount = Math.min(4, strength)
  const animation = element.animate(
    [
      { transform: 'translate3d(0, 0, 0)' },
      { transform: `translate3d(${amount}px, ${-amount * 0.6}px, 0)` },
      { transform: `translate3d(${-amount * 0.8}px, ${amount * 0.4}px, 0)` },
      { transform: 'translate3d(0, 0, 0)' },
    ],
    { duration: 130, easing: 'ease-out' },
  )
  shakeAnimations.set(element, animation)
  animation.addEventListener('finish', () => shakeAnimations.delete(element), { once: true })
}

export function spawnPlusOne(layer: HTMLElement, x: number, y: number): void {
  if (prefersReducedMotion()) return
  if (layer.childElementCount > 24) layer.firstElementChild?.remove()
  const node = document.createElement('span')
  node.className = 'float-plus'
  node.textContent = '+1'
  node.style.left = `${x}px`
  node.style.top = `${y}px`
  node.addEventListener('animationend', () => node.remove(), { once: true })
  layer.append(node)
}

export class ClickSound {
  private context: AudioContext | null = null
  enabled = false

  play(combo: number): void {
    if (!this.enabled) return
    try {
      const context = this.ensureContext()
      if (!context) return
      const now = context.currentTime
      const base = 360 + Math.min(combo, 40) * 14
      const master = context.createGain()
      master.gain.setValueAtTime(0.0001, now)
      master.gain.exponentialRampToValueAtTime(0.075, now + 0.008)
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
      master.connect(context.destination)

      this.voice(context, master, base, 'sine', 0.32, now)
      this.voice(context, master, base * 2.01, 'triangle', 0.16, now, 0.35)
      if (combo % 10 === 0) {
        this.voice(context, master, base * 3.02, 'sine', 0.26, now + 0.02, 0.2)
      }
    } catch {
      // Audio is a garnish. Browsers can reject it and the counter still works.
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.context) {
      const AudioContextClass = window.AudioContext
      if (!AudioContextClass) return null
      this.context = new AudioContextClass()
    }
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  private voice(
    context: AudioContext,
    destination: AudioNode,
    frequency: number,
    type: OscillatorType,
    duration: number,
    start: number,
    detune = 0,
  ): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.detune.setValueAtTime(detune, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.62), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.9, start + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }
}
