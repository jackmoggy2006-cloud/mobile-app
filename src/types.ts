export type GeneratorId = 'sapling' | 'firefly' | 'kiln' | 'groveheart'

export type UpgradeId = 'tapStrength' | 'resinVein' | 'emberChorus' | 'deepRoots'

export interface GeneratorDef {
  id: GeneratorId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  baseRate: number
}

export interface UpgradeDef {
  id: UpgradeId
  name: string
  blurb: string
  baseCost: number
  costGrowth: number
  effect: number
}

export interface GameState {
  resin: number
  totalResin: number
  tapPower: number
  generators: Record<GeneratorId, number>
  upgrades: Record<UpgradeId, number>
  lastTickAt: number
  createdAt: number
}

export interface FloatingText {
  id: number
  x: number
  y: number
  text: string
  bornAt: number
}
