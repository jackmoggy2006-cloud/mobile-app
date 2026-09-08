import {
  buyGenerator,
  buyUpgrade,
  buyWorker,
  claimMilestone,
  createInitialState,
  generatorCost,
  resinPerSecond,
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
  const cost1 = generatorCost('sapling', 1)
  assert(cost0 === 15, 'sapling base cost')
  assert(cost1 > cost0, 'sapling cost grows')
}

{
  const state: GameState = {
    ...base,
    resin: 1000,
    generators: { ...base.generators, sapling: 10 },
  }
  const rate = resinPerSecond(state)
  assert(rate > 0.9 && rate < 1.1, `expected ~1 rps, got ${rate}`)
  const bought = buyGenerator(state, 'dripvine')
  assert(bought !== null, 'can buy dripvine')
  assert(bought!.generators.dripvine === 1, 'dripvine owned')
  assert(bought!.resin < state.resin, 'resin spent')
}

{
  assert(workerCost('sproutling', 0) === 25, 'sproutling cost')
  const hired = buyWorker({ ...base, resin: 100 }, 'sproutling')
  assert(hired !== null && hired.workers.sproutling === 1, 'hire worker')
  assert(resinPerSecond(hired!) > 0.15, 'worker produces')
}

{
  const poor = buyUpgrade(base, 'tapStrength')
  assert(poor === null, 'cannot afford upgrade')
  const rich = buyUpgrade({ ...base, resin: 500 }, 'tapStrength')
  assert(rich !== null && rich.upgrades.tapStrength === 1, 'upgrade purchased')
}

{
  const ready = claimMilestone({ ...base, totalResin: 50, resin: 10 }, 'firstDrip')
  assert(ready !== null && ready.claimedMilestones.includes('firstDrip'), 'claim milestone')
  assert(ready!.resin > 10, 'milestone reward')
  const again = claimMilestone(ready!, 'firstDrip')
  assert(again === null, 'cannot reclaim')
}

{
  assert(formatResin(12) === '12', 'format small')
  assert(formatResin(1500).endsWith('K'), 'format thousands')
}

console.log('economy tests passed')
