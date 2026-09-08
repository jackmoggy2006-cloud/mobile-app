import { useEffect, useRef } from 'react'
import { MAX_VISIBLE_WORKERS, WORKERS } from '../game/catalog'
import { groveLevel, workerSpeedBonus } from '../game/economy'
import type { FloatingText, GameState, WorkerId } from '../types'

interface Props {
  state: GameState
  floats: FloatingText[]
  pulse: number
  onTap: (x: number, y: number) => void
  onWorkerDeposit: (x: number, y: number, amount: number) => void
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

type WorkerPhase = 'toTree' | 'gather' | 'toVat' | 'deposit'

interface SimWorker {
  key: string
  type: WorkerId
  x: number
  y: number
  tx: number
  ty: number
  phase: WorkerPhase
  timer: number
  facing: 1 | -1
  bob: number
  haul: number
}

interface TreeSpot {
  x: number
  y: number
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export function GameCanvas({
  state,
  floats,
  pulse,
  onTap,
  onWorkerDeposit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const workersRef = useRef<SimWorker[]>([])
  const treesRef = useRef<TreeSpot[]>([])
  const stateRef = useRef(state)
  const floatsRef = useRef(floats)
  const pulseRef = useRef(pulse)
  const depositRef = useRef(onWorkerDeposit)
  const lastFrameRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
    floatsRef.current = floats
    pulseRef.current = pulse
    depositRef.current = onWorkerDeposit
  }, [state, floats, pulse, onWorkerDeposit])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let width = 0
    let height = 0
    let dpr = 1

    const vat = () => ({ x: width * 0.12, y: height * 0.78 })

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

    const syncWorkers = (g: GameState) => {
      const desired: { type: WorkerId; key: string }[] = []
      let slots = MAX_VISIBLE_WORKERS
      for (const def of WORKERS) {
        const owned = g.workers[def.id]
        const show = Math.min(owned, def.maxVisible, slots)
        slots -= show
        for (let i = 0; i < show; i += 1) {
          desired.push({ type: def.id, key: `${def.id}-${i}` })
        }
        if (slots <= 0) break
      }

      const map = new Map(workersRef.current.map((w) => [w.key, w]))
      const next: SimWorker[] = []
      const v = vat()
      for (const d of desired) {
        const existing = map.get(d.key)
        if (existing) {
          next.push(existing)
          continue
        }
        const seed = hashSeed(d.key)
        const trees = treesRef.current
        const spot = trees[Math.floor(seed * Math.max(1, trees.length))] ?? {
          x: width * 0.5,
          y: height * 0.7,
        }
        next.push({
          key: d.key,
          type: d.type,
          x: v.x + (seed - 0.5) * 40,
          y: v.y + (seed - 0.5) * 20,
          tx: spot.x,
          ty: spot.y,
          phase: 'toTree',
          timer: 0,
          facing: 1,
          bob: seed * Math.PI * 2,
          haul: 0,
        })
      }
      workersRef.current = next
    }

    const pickTree = (seed: number): TreeSpot => {
      const trees = treesRef.current
      if (trees.length === 0) {
        return { x: width * 0.55, y: height * 0.7 }
      }
      return trees[Math.floor(seed * trees.length) % trees.length]
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

    const drawVat = (x: number, y: number, t: number) => {
      ctx.fillStyle = '#2a211c'
      ctx.beginPath()
      ctx.ellipse(x, y + 8, 28, 12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#3d2f24'
      ctx.fillRect(x - 22, y - 18, 44, 26)
      ctx.fillStyle = `rgba(240, 180, 90, ${0.55 + Math.sin(t * 3) * 0.1})`
      ctx.beginPath()
      ctx.ellipse(x, y - 10, 16, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c8d2c4'
      ctx.font = '600 11px "Source Sans 3", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Vat', x, y + 28)
    }

    const drawWorker = (w: SimWorker, t: number) => {
      const def = WORKERS.find((d) => d.id === w.type)!
      const scale = def.size
      const bob = Math.sin(t * 10 + w.bob) * (w.phase === 'gather' ? 1.2 : 2.2)
      ctx.save()
      ctx.translate(w.x, w.y + bob)
      ctx.scale(w.facing * scale, scale)

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.beginPath()
      ctx.ellipse(0, 10, 9, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()

      // legs
      const stride = Math.sin(t * 12 + w.bob) * (w.phase.startsWith('to') ? 3 : 0.5)
      ctx.strokeStyle = def.accent
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-3, 4)
      ctx.lineTo(-3 - stride, 10)
      ctx.moveTo(3, 4)
      ctx.lineTo(3 + stride, 10)
      ctx.stroke()

      // body
      ctx.fillStyle = def.hue
      ctx.beginPath()
      const bw = 14
      const bh = 16
      const br = 5
      const bx = -7
      const by = -10
      ctx.moveTo(bx + br, by)
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, br)
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, br)
      ctx.arcTo(bx, by + bh, bx, by, br)
      ctx.arcTo(bx, by, bx + bw, by, br)
      ctx.closePath()
      ctx.fill()

      // head
      ctx.beginPath()
      ctx.arc(0, -14, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#f3e6c8'
      ctx.fill()

      // hat / accent
      ctx.fillStyle = def.accent
      if (w.type === 'lanternfolk') {
        ctx.fillRect(-5, -22, 10, 4)
        ctx.beginPath()
        ctx.arc(8, -6, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 220, 120, 0.9)'
        ctx.fill()
      } else if (w.type === 'cartbearer') {
        ctx.fillRect(8, -2, 12, 8)
        ctx.strokeStyle = def.accent
        ctx.strokeRect(8, -2, 12, 8)
      } else if (w.type === 'grovewarden') {
        ctx.beginPath()
        ctx.moveTo(0, -26)
        ctx.lineTo(7, -16)
        ctx.lineTo(-7, -16)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.ellipse(0, -19, 7, 3.5, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // resin haul
      if (w.haul > 0 || w.phase === 'toVat' || w.phase === 'deposit') {
        ctx.beginPath()
        ctx.arc(-9, -2, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 186, 92, 0.95)'
        ctx.fill()
      }

      ctx.restore()
    }

    const updateWorkers = (g: GameState, dt: number, t: number) => {
      const speedMul = workerSpeedBonus(g)
      const v = vat()
      for (const w of workersRef.current) {
        const def = WORKERS.find((d) => d.id === w.type)!
        const speed = def.speed * speedMul

        if (w.phase === 'toTree' || w.phase === 'toVat') {
          const dx = w.tx - w.x
          const dy = w.ty - w.y
          const dist = Math.hypot(dx, dy) || 1
          const step = speed * dt
          if (dist <= step) {
            w.x = w.tx
            w.y = w.ty
            if (w.phase === 'toTree') {
              w.phase = 'gather'
              w.timer = 0.45 + hashSeed(w.key + 'g') * 0.55
              w.haul = 0.4 + hashSeed(w.key + 'h') * 1.8
            } else {
              w.phase = 'deposit'
              w.timer = 0.28
            }
          } else {
            w.x += (dx / dist) * step
            w.y += (dy / dist) * step
            w.facing = dx >= 0 ? 1 : -1
          }
        } else if (w.phase === 'gather') {
          w.timer -= dt
          if (w.timer <= 0) {
            w.phase = 'toVat'
            w.tx = v.x + (hashSeed(w.key + String(t | 0)) - 0.5) * 24
            w.ty = v.y - 8
          }
        } else if (w.phase === 'deposit') {
          w.timer -= dt
          if (w.timer <= 0) {
            const amount = Math.max(0.1, w.haul * (0.8 + def.baseRate * 0.15))
            depositRef.current(w.x, w.y - 18, amount)
            w.haul = 0
            const tree = pickTree(hashSeed(w.key + String((t * 10) | 0)))
            w.phase = 'toTree'
            w.tx = tree.x + (hashSeed(w.key + 'x') - 0.5) * 18
            w.ty = tree.y + 6
          }
        }
      }
    }

    const draw = (now: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = now
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000)
      lastFrameRef.current = now
      const g = stateRef.current
      const level = groveLevel(g)
      const t = now / 1000

      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#1a3a48')
      sky.addColorStop(0.45, '#2f5d55')
      sky.addColorStop(1, '#6d8f4e')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)

      const sunX = width * 0.78
      const sunY = height * 0.22
      const sun = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120)
      sun.addColorStop(0, 'rgba(255, 214, 140, 0.55)')
      sun.addColorStop(1, 'rgba(255, 214, 140, 0)')
      ctx.fillStyle = sun
      ctx.fillRect(sunX - 120, sunY - 120, 240, 240)

      ctx.fillStyle = '#3f5d34'
      ctx.beginPath()
      ctx.ellipse(width / 2, height * 0.82, width * 0.55, height * 0.18, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2f4a2a'
      ctx.beginPath()
      ctx.ellipse(width / 2, height * 0.86, width * 0.62, height * 0.14, 0, 0, Math.PI * 2)
      ctx.fill()

      const treeCount = Math.min(12, 3 + Math.floor(level / 2))
      const trees: TreeSpot[] = []
      for (let i = 0; i < treeCount; i += 1) {
        const nx = 0.28 + (i / Math.max(1, treeCount - 1)) * 0.58
        const x = width * nx + Math.sin(t * 0.4 + i) * 4
        const y = height * (0.66 + (i % 3) * 0.035)
        trees.push({ x, y })
        const scale = 0.7 + (i % 4) * 0.12 + pulseRef.current * 0.04
        const sway = Math.sin(t * 1.2 + i * 0.7) * 0.04
        drawTree(x, y, scale, sway, i < g.generators.sapling + g.workers.sproutling + 2)
      }
      treesRef.current = trees

      drawVat(vat().x, vat().y, t)

      // fireflies
      const fireflies = Math.min(
        40,
        g.generators.firefly * 3 + g.workers.lanternfolk * 2 + Math.floor(level / 2),
      )
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

      if (g.generators.kiln > 0 || g.generators.resinpress > 0) {
        const kx = width * 0.22
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

      if (g.generators.groveheart > 0 || g.generators.starroot > 0) {
        const cx = width * 0.55
        const cy = height * 0.56
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

      syncWorkers(g)
      updateWorkers(g, dt, t)

      // sort workers by y for simple depth
      const sorted = [...workersRef.current].sort((a, b) => a.y - b.y)
      for (const w of sorted) drawWorker(w, t)

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

      for (const f of floatsRef.current) {
        const age = (performance.now() - f.bornAt) / 900
        if (age > 1) continue
        ctx.globalAlpha = 1 - age
        ctx.fillStyle = f.color ?? '#fff4d2'
        ctx.font = '700 18px "Fraunces", Georgia, serif'
        ctx.textAlign = 'center'
        ctx.fillText(f.text, f.x, f.y - age * 36)
        ctx.globalAlpha = 1
      }

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
      aria-label="Kindlewood grove. Tap to gather resin. Workers collect for you."
      onPointerDown={(e) => {
        e.preventDefault()
        handlePointer(e.clientX, e.clientY)
      }}
    />
  )
}
