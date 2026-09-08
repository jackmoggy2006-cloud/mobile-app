export type GeneratorId =
  | 'sapling'
  | 'dripvine'
  | 'firefly'
  | 'resinpress'
  | 'kiln'
  | 'ambermill'
  | 'groveheart'
  | 'starroot'

export type WorkerId =
  | 'sproutling'
  | 'amberkin'
  | 'barkwalker'
  | 'lanternfolk'
  | 'cartbearer'
  | 'grovewarden'

export type UpgradeId =
  | 'tapStrength'
  | 'stickyFingers'
  | 'keenCrit'
  | 'resinVein'
  | 'emberChorus'
  | 'sapSymphony'
  | 'swiftFeet'
  | 'heavyPails'
  | 'nightLanterns'
  | 'kilnDraft'
  | 'goldenSap'
  | 'deepRoots'

export type MilestoneId =
  | 'firstDrip'
  | 'hiredHelp'
  | 'warmKiln'
  | 'busyGrove'
  | 'amberRush'
  | 'canopySong'
  | 'starlit'

export interface GeneratorDef {
  id: GeneratorId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  baseRate: number
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
}

export interface UpgradeDef {
  id: UpgradeId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  /** Shown in shop; actual math lives in economy.ts */
  effectLabel: string
}

export interface MilestoneDef {
  id: MilestoneId
  name: string
  blurb: string
  needTotal: number
  reward: number
}

export interface GameState {
  resin: number
  totalResin: number
  tapPower: number
  generators: Record<GeneratorId, number>
  workers: Record<WorkerId, number>
  upgrades: Record<UpgradeId, number>
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
