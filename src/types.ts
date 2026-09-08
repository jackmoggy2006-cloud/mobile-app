export type GeneratorId =
  | 'sapling'
  | 'dripvine'
  | 'firefly'
  | 'resinpress'
  | 'kiln'
  | 'ambermill'
  | 'honeycomb'
  | 'groveheart'
  | 'sapforge'
  | 'starroot'
  | 'moonwell'
  | 'worldtree'

export type WorkerId =
  | 'sproutling'
  | 'amberkin'
  | 'barkwalker'
  | 'mossrunner'
  | 'lanternfolk'
  | 'cartbearer'
  | 'driplingscout'
  | 'grovewarden'
  | 'emberbearer'
  | 'astralmote'

export type UpgradeId =
  | 'tapStrength'
  | 'stickyFingers'
  | 'keenCrit'
  | 'doubleDip'
  | 'resinVein'
  | 'emberChorus'
  | 'sapSymphony'
  | 'canopyYield'
  | 'swiftFeet'
  | 'heavyPails'
  | 'packTrain'
  | 'nightLanterns'
  | 'kilnDraft'
  | 'forgeBellows'
  | 'goldenSap'
  | 'deepRoots'
  | 'timekeeper'

export type PrestigeId =
  | 'eternalTap'
  | 'sparkMulch'
  | 'starterCrew'
  | 'deepMemory'
  | 'zoneEcho'
  | 'criticalFate'
  | 'worldPulse'

export type ZoneId =
  | 'clearing'
  | 'brook'
  | 'hollow'
  | 'ridge'
  | 'canopy'
  | 'starfall'

export type MilestoneId =
  | 'firstDrip'
  | 'hiredHelp'
  | 'warmKiln'
  | 'busyGrove'
  | 'amberRush'
  | 'canopySong'
  | 'starlit'
  | 'worldAwake'
  | 'firstRebirth'
  | 'sparkCollector'

export interface GeneratorDef {
  id: GeneratorId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  baseRate: number
  zone: ZoneId
}

export interface WorkerDef {
  id: WorkerId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  baseRate: number
  speed: number
  hue: string
  accent: string
  size: number
  maxVisible: number
  zone: ZoneId
}

export interface UpgradeDef {
  id: UpgradeId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  effectLabel: string
}

export interface PrestigeDef {
  id: PrestigeId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  effectLabel: string
  maxLevel: number
}

export interface ZoneDef {
  id: ZoneId
  name: string
  blurb: string
  /** Resin cost to unlock (0 = starting zone) */
  resinCost: number
  /** Sparks cost to unlock (0 if resin-only / free) */
  sparkCost: number
  skyTop: string
  skyBot: string
  ground: string
  groundDark: string
}

export interface MilestoneDef {
  id: MilestoneId
  name: string
  blurb: string
  needTotal: number
  reward: number
  needRebirths?: number
  needSparks?: number
}

export interface GameState {
  resin: number
  /** Resin earned this run (for goals + rebirth calc) */
  totalResin: number
  /** All-time resin across rebirths */
  lifetimeResin: number
  sparks: number
  rebirths: number
  tapPower: number
  generators: Record<GeneratorId, number>
  workers: Record<WorkerId, number>
  upgrades: Record<UpgradeId, number>
  prestige: Record<PrestigeId, number>
  unlockedZones: ZoneId[]
  claimedMilestones: MilestoneId[]
  lastTickAt: number
  createdAt: number
}

export interface FloatingText {
  id: number
  x: number
  y: number
  text: string
  bornAt: number
  color?: string
}
