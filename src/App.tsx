import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { Hud } from './components/Hud'
import { ShopPanel } from './components/ShopPanel'
import {
  applyPassive,
  buyGenerator,
  buyPrestige,
  buyUpgrade,
  buyWorker,
  claimMilestone,
  createInitialState,
  effectiveTapPower,
  performRebirth,
  resinPerSecond,
  sparksFromRun,
  tapGrove,
  totalWorkers,
  unlockZone,
} from './game/economy'
import { clearSave, loadGame, saveGame } from './game/storage'
import { formatDuration, formatResin } from './lib/format'
import type {
  FloatingText,
  GeneratorId,
  MilestoneId,
  PrestigeId,
  UpgradeId,
  WorkerId,
  ZoneId,
} from './types'

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

  const pushFloat = useCallback(
    (x: number, y: number, text: string, color?: string) => {
      floatId.current += 1
      setFloats((prev) => [
        ...prev.slice(-28),
        {
          id: floatId.current,
          x,
          y,
          text,
          color,
          bornAt: performance.now(),
        },
      ])
    },
    [],
  )

  const onTap = (x: number, y: number) => {
    const result = tapGrove(stateRef.current)
    setState(result.state)
    setPulse(1)
    pushFloat(
      x,
      y,
      result.crit
        ? `CRIT +${formatResin(result.gained)}`
        : `+${formatResin(result.gained)}`,
      result.crit ? '#ffe08a' : undefined,
    )
  }

  const onWorkerDeposit = useCallback(
    (x: number, y: number, amount: number) => {
      pushFloat(x, y, `+${formatResin(amount)}`, '#b8e6a8')
    },
    [pushFloat],
  )

  const onBuyGenerator = (id: GeneratorId) => {
    setState((prev) => buyGenerator(prev, id) ?? prev)
  }

  const onBuyWorker = (id: WorkerId) => {
    setState((prev) => buyWorker(prev, id) ?? prev)
  }

  const onBuyUpgrade = (id: UpgradeId) => {
    setState((prev) => buyUpgrade(prev, id) ?? prev)
  }

  const onBuyPrestige = (id: PrestigeId) => {
    setState((prev) => buyPrestige(prev, id) ?? prev)
  }

  const onUnlockZone = (id: ZoneId) => {
    setState((prev) => {
      const next = unlockZone(prev, id)
      if (!next) return prev
      setToast(`Area unlocked: ${id}`)
      return next
    })
  }

  const onClaimMilestone = (id: MilestoneId) => {
    setState((prev) => {
      const next = claimMilestone(prev, id)
      if (!next) return prev
      setToast(`Goal claimed! +${formatResin(next.resin - prev.resin)} resin`)
      return next
    })
  }

  const onRebirth = () => {
    const gained = sparksFromRun(stateRef.current.totalResin)
    if (
      !window.confirm(
        `Rebirth the grove for +${gained} Amber Sparks?\n\nResin, workers, buildings, and run upgrades reset. Sparks, permanent upgrades, and unlocked areas stay.`,
      )
    ) {
      return
    }
    setState((prev) => {
      const next = performRebirth(prev)
      if (!next) return prev
      setToast(`Rebirth complete! +${gained} Amber Sparks`)
      setFloats([])
      return next
    })
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
  const workers = totalWorkers(state)

  return (
    <div className="app">
      <Hud
        resin={state.resin}
        rate={rate}
        tapPower={tapPower}
        workers={workers}
        sparks={state.sparks}
        rebirths={state.rebirths}
        zones={state.unlockedZones.length}
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
            onWorkerDeposit={onWorkerDeposit}
          />
          <p className="grove-hint">
            Tap · hire workers · unlock areas · rebirth for sparks
          </p>
        </div>
        <ShopPanel
          state={state}
          onBuyGenerator={onBuyGenerator}
          onBuyWorker={onBuyWorker}
          onBuyUpgrade={onBuyUpgrade}
          onBuyPrestige={onBuyPrestige}
          onUnlockZone={onUnlockZone}
          onClaimMilestone={onClaimMilestone}
          onRebirth={onRebirth}
        />
      </main>
    </div>
  )
}
