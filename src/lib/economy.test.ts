import {
  buyGenerator,
  buyPrestige,
  buyUpgrade,
  buyWorker,
  canRebirth,
  claimMilestone,
  createInitialState,
  generatorCost,
  performRebirth,
  resinPerSecond,
  sparksFromRun,
  unlockZone,
  workerCost,
} from '../game/economy'
import { formatResin } from './format'
import type { GameState } from '../types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const base = createInitialState()

{
  const cost0 = generatorCost('sapling', 0)
  assert(cost0 === 15, 'sapling base cost')
}

{
  const state: GameState = {
    ...base,
    resin: 1000,
    generators: { ...base.generators, sapling: 10 },
  }
  const rate = resinPerSecond(state)
  assert(rate > 0.9 && rate < 1.1, `expected ~1 rps, got ${rate}`)
}

{
  assert(workerCost('sproutling', 0) === 25, 'sproutling cost')
  const hired = buyWorker({ ...base, resin: 100 }, 'sproutling')
  assert(hired !== null && hired.workers.sproutling === 1, 'hire worker')
}

{
  const locked = buyGenerator(base, 'firefly')
  assert(locked === null, 'firefly needs brook')
  const opened = unlockZone({ ...base, resin: 5000 }, 'brook')
  assert(opened !== null && opened.unlockedZones.includes('brook'), 'unlock brook')
  const bought = buyGenerator({ ...opened!, resin: 5000 }, 'firefly')
  assert(bought !== null && bought.generators.firefly === 1, 'buy firefly')
}

{
  const rich = buyUpgrade({ ...base, resin: 500 }, 'tapStrength')
  assert(rich !== null && rich.upgrades.tapStrength === 1, 'upgrade purchased')
}

{
  assert(sparksFromRun(500_000) === 0, 'below rebirth threshold')
  assert(sparksFromRun(1_000_000) === 1, 'exactly 1 spark')
  assert(sparksFromRun(4_000_000) === 2, 'sqrt sparks')
  assert(canRebirth({ ...base, totalResin: 1_000_000 }), 'can rebirth')
  const next = performRebirth({
    ...base,
    totalResin: 4_000_000,
    resin: 100,
    sparks: 3,
    rebirths: 0,
    prestige: { ...base.prestige, starterCrew: 2 },
    unlockedZones: ['clearing', 'brook'],
    generators: { ...base.generators, sapling: 5 },
  })
  assert(next !== null, 'rebirth works')
  assert(next!.sparks === 5, 'sparks kept + gained')
  assert(next!.rebirths === 1, 'rebirth counted')
  assert(next!.generators.sapling === 0, 'buildings reset')
  assert(next!.workers.sproutling === 2, 'starter crew')
  assert(next!.unlockedZones.includes('brook'), 'zones kept')
}

{
  const p = buyPrestige({ ...base, sparks: 5 }, 'eternalTap')
  assert(p !== null && p.prestige.eternalTap === 1, 'buy prestige')
}

{
  const ready = claimMilestone({ ...base, totalResin: 50, resin: 10 }, 'firstDrip')
  assert(ready !== null, 'claim milestone')
}

{
  assert(formatResin(12) === '12', 'format small')
  assert(formatResin(1500).endsWith('K'), 'format thousands')
}

console.log('economy tests passed')
