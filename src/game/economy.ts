import {
  GENERATORS,
  MAX_OFFLINE_MS,
  MILESTONES,
  PRESTIGE,
  REBIRTH_DIVISOR,
  UPGRADES,
  WORKERS,
  ZONES,
} from './catalog'
import type {
  GameState,
  GeneratorId,
  MilestoneId,
  PrestigeId,
  UpgradeId,
  WorkerId,
  ZoneId,
} from '../types'

export function emptyGenerators(): Record<GeneratorId, number> {
  return {
    sapling: 0,
    dripvine: 0,
    firefly: 0,
    resinpress: 0,
    kiln: 0,
    ambermill: 0,
    honeycomb: 0,
    groveheart: 0,
    sapforge: 0,
    starroot: 0,
    moonwell: 0,
    worldtree: 0,
  }
}

export function emptyWorkers(): Record<WorkerId, number> {
  return {
    sproutling: 0,
    amberkin: 0,
    barkwalker: 0,
    mossrunner: 0,
    lanternfolk: 0,
    cartbearer: 0,
    driplingscout: 0,
    grovewarden: 0,
    emberbearer: 0,
    astralmote: 0,
  }
}

export function emptyUpgrades(): Record<UpgradeId, number> {
  return {
    tapStrength: 0,
    stickyFingers: 0,
    keenCrit: 0,
    doubleDip: 0,
    resinVein: 0,
    emberChorus: 0,
    sapSymphony: 0,
    canopyYield: 0,
    swiftFeet: 0,
    heavyPails: 0,
    packTrain: 0,
    nightLanterns: 0,
    kilnDraft: 0,
    forgeBellows: 0,
    goldenSap: 0,
    deepRoots: 0,
    timekeeper: 0,
  }
}

export function emptyPrestige(): Record<PrestigeId, number> {
  return {
    eternalTap: 0,
    sparkMulch: 0,
    starterCrew: 0,
    deepMemory: 0,
    zoneEcho: 0,
    criticalFate: 0,
    worldPulse: 0,
  }
}

export function createInitialState(now = Date.now()): GameState {
  return {
    resin: 0,
    totalResin: 0,
    lifetimeResin: 0,
    sparks: 0,
    rebirths: 0,
    tapPower: 1,
    generators: emptyGenerators(),
    workers: emptyWorkers(),
    upgrades: emptyUpgrades(),
    prestige: emptyPrestige(),
    unlockedZones: ['clearing'],
    claimedMilestones: [],
    lastTickAt: now,
    createdAt: now,
  }
}

export function zoneUnlocked(state: GameState, zone: ZoneId): boolean {
  return state.unlockedZones.includes(zone)
}

export function zoneIndex(zone: ZoneId): number {
  return ZONES.findIndex((z) => z.id === zone)
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

export function prestigeCost(id: PrestigeId, owned: number): number {
  const def = PRESTIGE.find((p) => p.id === id)!
  return Math.ceil(def.baseCost * def.costGrowth ** owned)
}

export function zoneUnlockAffordable(state: GameState, id: ZoneId): boolean {
  const def = ZONES.find((z) => z.id === id)!
  if (state.unlockedZones.includes(id)) return false
  return state.resin >= def.resinCost && state.sparks >= def.sparkCost
}

export function prestigeMultiplier(state: GameState): number {
  const sparkBonus =
    1 + state.sparks * (0.05 + state.prestige.sparkMulch * 0.03)
  const world = 1 + state.prestige.worldPulse * 0.2
  const zones =
    1 +
    Math.max(0, state.unlockedZones.length - 1) *
      (0.08 + state.prestige.zoneEcho * 0.12)
  return sparkBonus * world * zones
}

export function buildingMultiplier(state: GameState): number {
  return (
    (1 + state.upgrades.resinVein * 0.15) *
    (1 + state.upgrades.emberChorus * 0.2) *
    (1 + state.upgrades.sapSymphony * 0.18) *
    (1 + state.upgrades.goldenSap * 0.25) *
    (1 + state.upgrades.timekeeper * 0.08) *
    prestigeMultiplier(state)
  )
}

export function workerMultiplier(state: GameState): number {
  return (
    (1 + state.upgrades.swiftFeet * 0.12) *
    (1 + state.upgrades.heavyPails * 0.2) *
    (1 + state.upgrades.sapSymphony * 0.18) *
    (1 + state.upgrades.goldenSap * 0.25) *
    (1 + state.upgrades.timekeeper * 0.08) *
    prestigeMultiplier(state)
  )
}

function zoneYieldMult(state: GameState, zone: ZoneId): number {
  const depth = zoneIndex(zone)
  return 1 + depth * state.upgrades.canopyYield * 0.1
}

export function generatorRate(state: GameState, id: GeneratorId): number {
  const def = GENERATORS.find((g) => g.id === id)!
  if (!zoneUnlocked(state, def.zone)) return 0
  let rate =
    def.baseRate *
    state.generators[id] *
    buildingMultiplier(state) *
    zoneYieldMult(state, def.zone)
  if (id === 'firefly') rate *= 1 + state.upgrades.nightLanterns * 0.35
  if (id === 'resinpress' || id === 'kiln' || id === 'ambermill' || id === 'honeycomb') {
    rate *= 1 + state.upgrades.kilnDraft * 0.3
  }
  if (id === 'sapforge' || id === 'worldtree' || id === 'moonwell') {
    rate *= 1 + state.upgrades.forgeBellows * 0.4
  }
  return rate
}

export function workerRate(state: GameState, id: WorkerId): number {
  const def = WORKERS.find((w) => w.id === id)!
  if (!zoneUnlocked(state, def.zone)) return 0
  let rate =
    def.baseRate *
    state.workers[id] *
    workerMultiplier(state) *
    zoneYieldMult(state, def.zone)
  if (id === 'lanternfolk' || id === 'astralmote') {
    rate *= 1 + state.upgrades.nightLanterns * 0.35
  }
  if (id === 'cartbearer' || id === 'driplingscout' || id === 'emberbearer') {
    rate *= 1 + state.upgrades.packTrain * 0.25
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
  const base =
    state.tapPower +
    state.upgrades.tapStrength +
    state.prestige.eternalTap * 2
  return (
    base *
    (1 + state.upgrades.stickyFingers * 0.12) *
    prestigeMultiplier(state)
  )
}

export function critChance(state: GameState): number {
  return Math.min(
    0.55,
    state.upgrades.keenCrit * 0.04 + state.prestige.criticalFate * 0.03,
  )
}

export function critMultiplier(state: GameState): number {
  return 5 + state.upgrades.doubleDip
}

export function workerSpeedBonus(state: GameState): number {
  return 1 + state.upgrades.swiftFeet * 0.1
}

export function offlineCapMs(state: GameState): number {
  const deep = 1 + state.upgrades.deepRoots * 0.5 + state.prestige.deepMemory * 0.4
  return Math.min(MAX_OFFLINE_MS * deep, MAX_OFFLINE_MS * 4)
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
    lifetimeResin: state.lifetimeResin + gained,
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
  const gained = crit ? power * critMultiplier(state) : power
  return {
    gained,
    crit,
    state: {
      ...state,
      resin: state.resin + gained,
      totalResin: state.totalResin + gained,
      lifetimeResin: state.lifetimeResin + gained,
    },
  }
}

export function buyGenerator(
  state: GameState,
  id: GeneratorId,
): GameState | null {
  const def = GENERATORS.find((g) => g.id === id)!
  if (!zoneUnlocked(state, def.zone)) return null
  const cost = generatorCost(id, state.generators[id])
  if (state.resin < cost) return null
  return {
    ...state,
    resin: state.resin - cost,
    generators: { ...state.generators, [id]: state.generators[id] + 1 },
  }
}

export function buyWorker(state: GameState, id: WorkerId): GameState | null {
  const def = WORKERS.find((w) => w.id === id)!
  if (!zoneUnlocked(state, def.zone)) return null
  const cost = workerCost(id, state.workers[id])
  if (state.resin < cost) return null
  return {
    ...state,
    resin: state.resin - cost,
    workers: { ...state.workers, [id]: state.workers[id] + 1 },
  }
}

export function buyUpgrade(state: GameState, id: UpgradeId): GameState | null {
  const cost = upgradeCost(id, state.upgrades[id])
  if (state.resin < cost) return null
  return {
    ...state,
    resin: state.resin - cost,
    upgrades: { ...state.upgrades, [id]: state.upgrades[id] + 1 },
  }
}

export function buyPrestige(state: GameState, id: PrestigeId): GameState | null {
  const def = PRESTIGE.find((p) => p.id === id)!
  const owned = state.prestige[id]
  if (owned >= def.maxLevel) return null
  const cost = prestigeCost(id, owned)
  if (state.sparks < cost) return null
  return {
    ...state,
    sparks: state.sparks - cost,
    prestige: { ...state.prestige, [id]: owned + 1 },
  }
}

export function unlockZone(state: GameState, id: ZoneId): GameState | null {
  const def = ZONES.find((z) => z.id === id)
  if (!def || state.unlockedZones.includes(id)) return null
  if (state.resin < def.resinCost || state.sparks < def.sparkCost) return null
  return {
    ...state,
    resin: state.resin - def.resinCost,
    sparks: state.sparks - def.sparkCost,
    unlockedZones: [...state.unlockedZones, id],
  }
}

export function milestoneReady(state: GameState, id: MilestoneId): boolean {
  if (state.claimedMilestones.includes(id)) return false
  const def = MILESTONES.find((m) => m.id === id)
  if (!def) return false
  if (def.needRebirths != null && state.rebirths < def.needRebirths) return false
  if (def.needSparks != null && state.sparks < def.needSparks) return false
  return state.totalResin >= def.needTotal
}

export function claimMilestone(
  state: GameState,
  id: MilestoneId,
): GameState | null {
  if (!milestoneReady(state, id)) return null
  const def = MILESTONES.find((m) => m.id === id)!
  return {
    ...state,
    resin: state.resin + def.reward,
    totalResin: state.totalResin + def.reward,
    lifetimeResin: state.lifetimeResin + def.reward,
    claimedMilestones: [...state.claimedMilestones, id],
  }
}

export function sparksFromRun(totalResin: number): number {
  if (totalResin < REBIRTH_DIVISOR) return 0
  return Math.floor(Math.sqrt(totalResin / REBIRTH_DIVISOR))
}

export function canRebirth(state: GameState): boolean {
  return sparksFromRun(state.totalResin) >= 1
}

export function performRebirth(state: GameState, now = Date.now()): GameState | null {
  const gained = sparksFromRun(state.totalResin)
  if (gained < 1) return null
  const next = createInitialState(now)
  next.sparks = state.sparks + gained
  next.rebirths = state.rebirths + 1
  next.lifetimeResin = state.lifetimeResin
  next.prestige = { ...state.prestige }
  next.unlockedZones = [...state.unlockedZones]
  next.createdAt = state.createdAt
  // Keep rebirth-related milestone claims only
  next.claimedMilestones = state.claimedMilestones.filter(
    (id) => id === 'firstRebirth' || id === 'sparkCollector',
  )
  const crew = state.prestige.starterCrew
  if (crew > 0) {
    next.workers = { ...next.workers, sproutling: crew }
  }
  return next
}

export function totalWorkers(state: GameState): number {
  return WORKERS.reduce((sum, w) => sum + state.workers[w.id], 0)
}

export function groveLevel(state: GameState): number {
  const count =
    GENERATORS.reduce(
      (sum, g) => sum + state.generators[g.id] * (1 + zoneIndex(g.zone) * 0.5),
      0,
    ) + totalWorkers(state)
  return Math.min(
    48,
    Math.floor(count / 3) +
      Math.floor(state.totalResin / 800) +
      state.unlockedZones.length * 2 +
      state.rebirths * 3,
  )
}
