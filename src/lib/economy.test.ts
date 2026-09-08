import { buyGenerator, buyUpgrade, createInitialState, generatorCost, resinPerSecond } from '../game/economy'
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
  let state: GameState = {
    ...base,
    resin: 1000,
    generators: { ...base.generators, sapling: 10 },
  }
  const rate = resinPerSecond(state)
  assert(rate > 0.9 && rate < 1.1, `expected ~1 rps, got ${rate}`)
  const bought = buyGenerator(state, 'firefly')
  assert(bought !== null, 'can buy firefly')
  assert(bought!.generators.firefly === 1, 'firefly owned')
  assert(bought!.resin < state.resin, 'resin spent')
}

{
  const poor = buyUpgrade(base, 'tapStrength')
  assert(poor === null, 'cannot afford upgrade')
  const rich = buyUpgrade({ ...base, resin: 500 }, 'tapStrength')
  assert(rich !== null && rich.upgrades.tapStrength === 1, 'upgrade purchased')
}

{
  assert(formatResin(12) === '12', 'format small')
  assert(formatResin(1500).endsWith('K'), 'format thousands')
}

console.log('economy tests passed')
