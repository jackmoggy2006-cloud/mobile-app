import { useEffect, useRef } from 'react'
import { groveLevel } from '../game/economy'
import type { FloatingText, GameState } from '../types'

interface Props {
  state: GameState
  floats: FloatingText[]
  pulse: number
  onTap: (x: number, y: number) => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
}

export function GameCanvas({ state, floats, pulse, onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const stateRef = useRef(state)
  const floatsRef = useRef(floats)
  const pulseRef = useRef(pulse)

  useEffect(() => {
    stateRef.current = state
    floatsRef.current = floats
    pulseRef.current = pulse
  }, [state, floats, pulse])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawTree = (
      x: number,
      y: number,
      scale: number,
      sway: number,
      lit: boolean,
    ) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(sway)
      ctx.scale(scale, scale)
      ctx.fillStyle = '#3d2a1c'
      ctx.fillRect(-4, -8, 8, 28)
      ctx.beginPath()
      ctx.moveTo(0, -58)
      ctx.lineTo(28, -8)
      ctx.lineTo(-28, -8)
      ctx.closePath()
      ctx.fillStyle = lit ? '#1f6b4a' : '#16553a'
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(0, -78)
      ctx.lineTo(20, -34)
      ctx.lineTo(-20, -34)
      ctx.closePath()
      ctx.fillStyle = lit ? '#2f8f62' : '#1d6a48'
      ctx.fill()
      if (lit) {
        ctx.beginPath()
        ctx.arc(0, -48, 6, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 186, 92, 0.85)'
        ctx.fill()
      }
      ctx.restore()
    }

    const draw = (now: number) => {
      const g = stateRef.current
      const level = groveLevel(g)
      const t = now / 1000

      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#1a3a48')
      sky.addColorStop(0.45, '#2f5d55')
      sky.addColorStop(1, '#6d8f4e')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)

      // soft sun
      const sunX = width * 0.78
      const sunY = height * 0.22
      const sun = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120)
      sun.addColorStop(0, 'rgba(255, 214, 140, 0.55)')
      sun.addColorStop(1, 'rgba(255, 214, 140, 0)')
      ctx.fillStyle = sun
      ctx.fillRect(sunX - 120, sunY - 120, 240, 240)

      // ground
      ctx.fillStyle = '#3f5d34'
      ctx.beginPath()
      ctx.ellipse(width / 2, height * 0.82, width * 0.55, height * 0.18, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2f4a2a'
      ctx.beginPath()
      ctx.ellipse(width / 2, height * 0.86, width * 0.62, height * 0.14, 0, 0, Math.PI * 2)
      ctx.fill()

      const treeCount = Math.min(12, 3 + level)
      for (let i = 0; i < treeCount; i += 1) {
        const nx = 0.18 + (i / Math.max(1, treeCount - 1)) * 0.64
        const x = width * nx + Math.sin(t * 0.4 + i) * 4
        const y = height * (0.68 + (i % 3) * 0.035)
        const scale = 0.7 + (i % 4) * 0.12 + pulseRef.current * 0.04
        const sway = Math.sin(t * 1.2 + i * 0.7) * 0.04
        drawTree(x, y, scale, sway, i < g.generators.sapling + 2)
      }

      // fireflies
      const fireflies = Math.min(40, g.generators.firefly * 3 + Math.floor(level / 2))
      for (let i = 0; i < fireflies; i += 1) {
        const fx =
          width * (0.2 + ((i * 37) % 60) / 100) + Math.sin(t * 1.7 + i) * 18
        const fy =
          height * (0.35 + ((i * 19) % 40) / 100) + Math.cos(t * 1.3 + i) * 12
        const alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 4 + i))
        ctx.beginPath()
        ctx.arc(fx, fy, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 214, 110, ${alpha})`
        ctx.fill()
      }

      // kiln glow
      if (g.generators.kiln > 0) {
        const kx = width * 0.18
        const ky = height * 0.74
        ctx.fillStyle = '#2a211c'
        ctx.fillRect(kx - 18, ky - 22, 36, 28)
        const glow = ctx.createRadialGradient(kx, ky - 8, 2, kx, ky - 8, 28)
        glow.addColorStop(0, 'rgba(255, 140, 60, 0.8)')
        glow.addColorStop(1, 'rgba(255, 140, 60, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(kx, ky - 8, 28, 0, Math.PI * 2)
        ctx.fill()
      }

      // groveheart
      if (g.generators.groveheart > 0) {
        const cx = width * 0.5
        const cy = height * 0.58
        const beat = 1 + Math.sin(t * 3) * 0.08 + pulseRef.current * 0.1
        ctx.beginPath()
        ctx.ellipse(cx, cy, 26 * beat, 18 * beat, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 170, 80, 0.35)'
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(cx, cy, 12 * beat, 9 * beat, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 210, 120, 0.9)'
        ctx.fill()
      }

      // tap particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy -= 0.03
        p.life -= 1
        const a = Math.max(0, p.life / p.max)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 196, 100, ${a})`
        ctx.fill()
        return p.life > 0
      })

      // floating text
      for (const f of floatsRef.current) {
        const age = (performance.now() - f.bornAt) / 900
        if (age > 1) continue
        ctx.globalAlpha = 1 - age
        ctx.fillStyle = '#fff4d2'
        ctx.font = '700 18px "Fraunces", Georgia, serif'
        ctx.textAlign = 'center'
        ctx.fillText(f.text, f.x, f.y - age * 36)
        ctx.globalAlpha = 1
      }

      // subtle vignette
      const vig = ctx.createRadialGradient(
        width / 2,
        height / 2,
        height * 0.2,
        width / 2,
        height / 2,
        height * 0.75,
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(8, 20, 18, 0.35)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, width, height)

      raf = requestAnimationFrame(draw)
    }

    resize()
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const handlePointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    for (let i = 0; i < 8; i += 1) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -Math.random() * 2.2 - 0.4,
        life: 28 + Math.random() * 18,
        max: 46,
        size: 1.5 + Math.random() * 2,
      })
    }
    onTap(x, y)
  }

  return (
    <canvas
      ref={canvasRef}
      className="grove-canvas"
      aria-label="Kindlewood grove. Tap to gather resin."
      onPointerDown={(e) => {
        e.preventDefault()
        handlePointer(e.clientX, e.clientY)
      }}
    />
  )
}
