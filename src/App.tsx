import { useEffect, useRef, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { Hud } from './components/Hud'
import { ShopPanel } from './components/ShopPanel'
import {
  applyPassive,
  buyGenerator,
  buyUpgrade,
  createInitialState,
  effectiveTapPower,
  resinPerSecond,
  tapGrove,
} from './game/economy'
import { clearSave, loadGame, saveGame } from './game/storage'
import { formatDuration, formatResin } from './lib/format'
import type { FloatingText, GeneratorId, UpgradeId } from './types'

export default function App() {
  const [boot] = useState(() => loadGame())
  const [state, setState] = useState(boot.state)
  const [floats, setFloats] = useState<FloatingText[]>([])
  const [pulse, setPulse] = useState(0)
  const [toast, setToast] = useState<string | null>(() => {
    if (boot.offlineMs > 5000 && boot.gained > 0) {
      return `While you were away (${formatDuration(boot.offlineMs)}): +${formatResin(boot.gained)} resin`
    }
    return null
  })
  const floatId = useRef(0)
  const stateRef = useRef(boot.state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const dt = now - last
      if (dt >= 50) {
        last = now
        setState((prev) => applyPassive(prev, dt))
        setPulse((p) => Math.max(0, p - dt / 400))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    saveGame(state)
  }, [state])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    const id = window.setInterval(() => {
      setFloats((prev) => prev.filter((f) => performance.now() - f.bornAt < 900))
    }, 200)
    return () => window.clearInterval(id)
  }, [])

  const onTap = (x: number, y: number) => {
    const result = tapGrove(stateRef.current)
    setState(result.state)
    setPulse(1)
    floatId.current += 1
    setFloats((prev) => [
      ...prev.slice(-20),
      {
        id: floatId.current,
        x,
        y,
        text: `+${formatResin(result.gained)}`,
        bornAt: performance.now(),
      },
    ])
  }

  const onBuyGenerator = (id: GeneratorId) => {
    setState((prev) => buyGenerator(prev, id) ?? prev)
  }

  const onBuyUpgrade = (id: UpgradeId) => {
    setState((prev) => buyUpgrade(prev, id) ?? prev)
  }

  const onReset = () => {
    if (!window.confirm('Clear your Kindlewood save and start over?')) return
    clearSave()
    const fresh = createInitialState()
    setState(fresh)
    setFloats([])
    setToast('Grove reset. Tap to begin again.')
  }

  const rate = resinPerSecond(state)
  const tapPower = effectiveTapPower(state)

  return (
    <div className="app">
      <Hud
        resin={state.resin}
        rate={rate}
        tapPower={tapPower}
        toast={toast}
        onReset={onReset}
      />
      <main className="stage">
        <div className="grove-shell">
          <GameCanvas
            state={state}
            floats={floats}
            pulse={pulse}
            onTap={onTap}
          />
          <p className="grove-hint">Tap the grove to gather resin</p>
        </div>
        <ShopPanel
          state={state}
          onBuyGenerator={onBuyGenerator}
          onBuyUpgrade={onBuyUpgrade}
        />
      </main>
    </div>
  )
}
