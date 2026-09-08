import { GENERATORS, MAX_OFFLINE_MS, UPGRADES } from './catalog'
import type { GameState, GeneratorId, UpgradeId } from '../types'

export function createInitialState(now = Date.now()): GameState {
  return {
    resin: 0,
    totalResin: 0,
    tapPower: 1,
    generators: {
      sapling: 0,
      firefly: 0,
      kiln: 0,
      groveheart: 0,
    },
    upgrades: {
      tapStrength: 0,
      resinVein: 0,
      emberChorus: 0,
      deepRoots: 0,
    },
    lastTickAt: now,
    createdAt: now,
  }
}

export function generatorCost(id: GeneratorId, owned: number): number {
  const def = GENERATORS.find((g) => g.id === id)!
  return Math.ceil(def.baseCost * def.costGrowth ** owned)
}

export function upgradeCost(id: UpgradeId, owned: number): number {
  const def = UPGRADES.find((u) => u.id === id)!
  return Math.ceil(def.baseCost * def.costGrowth ** owned)
}

export function productionMultiplier(state: GameState): number {
  const vein = 1 + state.upgrades.resinVein * 0.15
  const chorus = 1 + state.upgrades.emberChorus * 0.25
  return vein * chorus
}

export function resinPerSecond(state: GameState): number {
  const mult = productionMultiplier(state)
  return GENERATORS.reduce((sum, def) => {
    return sum + def.baseRate * state.generators[def.id] * mult
  }, 0)
}

export function effectiveTapPower(state: GameState): number {
  return state.tapPower + state.upgrades.tapStrength
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

export function tapGrove(state: GameState): { state: GameState; gained: number } {
  const gained = effectiveTapPower(state)
  return {
    gained,
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

export function groveLevel(state: GameState): number {
  const count =
    state.generators.sapling +
    state.generators.firefly * 2 +
    state.generators.kiln * 4 +
    state.generators.groveheart * 8
  return Math.min(24, Math.floor(count / 3) + Math.floor(state.totalResin / 500))
}
