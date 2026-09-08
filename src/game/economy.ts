import {
  GENERATORS,
  MAX_OFFLINE_MS,
  MILESTONES,
  UPGRADES,
  WORKERS,
} from './catalog'
import type {
  GameState,
  GeneratorId,
  MilestoneId,
  UpgradeId,
  WorkerId,
} from '../types'

export function emptyGenerators(): Record<GeneratorId, number> {
  return {
    sapling: 0,
    dripvine: 0,
    firefly: 0,
    resinpress: 0,
    kiln: 0,
    ambermill: 0,
    groveheart: 0,
    starroot: 0,
  }
}

export function emptyWorkers(): Record<WorkerId, number> {
  return {
    sproutling: 0,
    amberkin: 0,
    barkwalker: 0,
    lanternfolk: 0,
    cartbearer: 0,
    grovewarden: 0,
  }
}

export function emptyUpgrades(): Record<UpgradeId, number> {
  return {
    tapStrength: 0,
    stickyFingers: 0,
    keenCrit: 0,
    resinVein: 0,
    emberChorus: 0,
    sapSymphony: 0,
    swiftFeet: 0,
    heavyPails: 0,
    nightLanterns: 0,
    kilnDraft: 0,
    goldenSap: 0,
    deepRoots: 0,
  }
}

export function createInitialState(now = Date.now()): GameState {
  return {
    resin: 0,
    totalResin: 0,
    tapPower: 1,
    generators: emptyGenerators(),
    workers: emptyWorkers(),
    upgrades: emptyUpgrades(),
    claimedMilestones: [],
    lastTickAt: now,
    createdAt: now,
  }
}

export function generatorCost(id: GeneratorId, owned: number): number {
  const def = GENERATORS.find((g) => g.id === id)!
  return Math.ceil(def.baseCost * def.costGrowth ** owned)
}

export function workerCost(id: WorkerId, owned: number): number {
  const def = WORKERS.find((w) => w.id === id)!
  return Math.ceil(def.baseCost * def.costGrowth ** owned)
}

export function upgradeCost(id: UpgradeId, owned: number): number {
  const def = UPGRADES.find((u) => u.id === id)!
  return Math.ceil(def.baseCost * def.costGrowth ** owned)
}

export function buildingMultiplier(state: GameState): number {
  return (
    (1 + state.upgrades.resinVein * 0.15) *
    (1 + state.upgrades.emberChorus * 0.2) *
    (1 + state.upgrades.sapSymphony * 0.18) *
    (1 + state.upgrades.goldenSap * 0.25)
  )
}

export function workerMultiplier(state: GameState): number {
  return (
    (1 + state.upgrades.swiftFeet * 0.12) *
    (1 + state.upgrades.heavyPails * 0.2) *
    (1 + state.upgrades.sapSymphony * 0.18) *
    (1 + state.upgrades.goldenSap * 0.25)
  )
}

export function generatorRate(state: GameState, id: GeneratorId): number {
  const def = GENERATORS.find((g) => g.id === id)!
  let rate = def.baseRate * state.generators[id] * buildingMultiplier(state)
  if (id === 'firefly') {
    rate *= 1 + state.upgrades.nightLanterns * 0.35
  }
  if (id === 'resinpress' || id === 'kiln' || id === 'ambermill') {
    rate *= 1 + state.upgrades.kilnDraft * 0.3
  }
  return rate
}

export function workerRate(state: GameState, id: WorkerId): number {
  const def = WORKERS.find((w) => w.id === id)!
  let rate = def.baseRate * state.workers[id] * workerMultiplier(state)
  if (id === 'lanternfolk') {
    rate *= 1 + state.upgrades.nightLanterns * 0.35
  }
  return rate
}

export function buildingsPerSecond(state: GameState): number {
  return GENERATORS.reduce((sum, def) => sum + generatorRate(state, def.id), 0)
}

export function workersPerSecond(state: GameState): number {
  return WORKERS.reduce((sum, def) => sum + workerRate(state, def.id), 0)
}

export function resinPerSecond(state: GameState): number {
  return buildingsPerSecond(state) + workersPerSecond(state)
}

export function effectiveTapPower(state: GameState): number {
  const base = state.tapPower + state.upgrades.tapStrength
  return base * (1 + state.upgrades.stickyFingers * 0.12)
}

export function critChance(state: GameState): number {
  return Math.min(0.45, state.upgrades.keenCrit * 0.04)
}

export function workerSpeedBonus(state: GameState): number {
  return 1 + state.upgrades.swiftFeet * 0.1
}

export function offlineCapMs(state: GameState): number {
  return Math.min(
    MAX_OFFLINE_MS * (1 + state.upgrades.deepRoots * 0.5),
    MAX_OFFLINE_MS * 3,
  )
}

export function applyPassive(state: GameState, elapsedMs: number): GameState {
  if (elapsedMs <= 0) return state
  const gained = resinPerSecond(state) * (elapsedMs / 1000)
  if (gained <= 0) {
    return { ...state, lastTickAt: state.lastTickAt + elapsedMs }
  }
  return {
    ...state,
    resin: state.resin + gained,
    totalResin: state.totalResin + gained,
    lastTickAt: state.lastTickAt + elapsedMs,
  }
}

export function reconcileOffline(state: GameState, now = Date.now()): {
  state: GameState
  offlineMs: number
  gained: number
} {
  const raw = Math.max(0, now - state.lastTickAt)
  const offlineMs = Math.min(raw, offlineCapMs(state))
  const before = state.resin
  const next = applyPassive({ ...state, lastTickAt: now - offlineMs }, offlineMs)
  return {
    state: { ...next, lastTickAt: now },
    offlineMs,
    gained: next.resin - before,
  }
}

export function tapGrove(state: GameState): {
  state: GameState
  gained: number
  crit: boolean
} {
  const power = effectiveTapPower(state)
  const crit = Math.random() < critChance(state)
  const gained = crit ? power * 5 : power
  return {
    gained,
    crit,
    state: {
      ...state,
      resin: state.resin + gained,
      totalResin: state.totalResin + gained,
    },
  }
}

export function buyGenerator(
  state: GameState,
  id: GeneratorId,
): GameState | null {
  const cost = generatorCost(id, state.generators[id])
  if (state.resin < cost) return null
  return {
    ...state,
    resin: state.resin - cost,
    generators: {
      ...state.generators,
      [id]: state.generators[id] + 1,
    },
  }
}

export function buyWorker(state: GameState, id: WorkerId): GameState | null {
  const cost = workerCost(id, state.workers[id])
  if (state.resin < cost) return null
  return {
    ...state,
    resin: state.resin - cost,
    workers: {
      ...state.workers,
      [id]: state.workers[id] + 1,
    },
  }
}

export function buyUpgrade(state: GameState, id: UpgradeId): GameState | null {
  const cost = upgradeCost(id, state.upgrades[id])
  if (state.resin < cost) return null
  return {
    ...state,
    resin: state.resin - cost,
    upgrades: {
      ...state.upgrades,
      [id]: state.upgrades[id] + 1,
    },
  }
}

export function claimMilestone(
  state: GameState,
  id: MilestoneId,
): GameState | null {
  if (state.claimedMilestones.includes(id)) return null
  const def = MILESTONES.find((m) => m.id === id)
  if (!def || state.totalResin < def.needTotal) return null
  return {
    ...state,
    resin: state.resin + def.reward,
    totalResin: state.totalResin + def.reward,
    claimedMilestones: [...state.claimedMilestones, id],
  }
}

export function totalWorkers(state: GameState): number {
  return WORKERS.reduce((sum, w) => sum + state.workers[w.id], 0)
}

export function groveLevel(state: GameState): number {
  const count =
    state.generators.sapling +
    state.generators.dripvine * 1.5 +
    state.generators.firefly * 2 +
    state.generators.resinpress * 3 +
    state.generators.kiln * 4 +
    state.generators.ambermill * 5 +
    state.generators.groveheart * 8 +
    state.generators.starroot * 12 +
    totalWorkers(state)
  return Math.min(
    32,
    Math.floor(count / 3) + Math.floor(state.totalResin / 800),
  )
}
