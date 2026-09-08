import type { GeneratorDef, UpgradeDef } from '../types'

export const GENERATORS: GeneratorDef[] = [
  {
    id: 'sapling',
    name: 'Sapling',
    blurb: 'Young trees drip warm resin on their own.',
    baseCost: 15,
    costGrowth: 1.15,
    baseRate: 0.1,
  },
  {
    id: 'firefly',
    name: 'Firefly Swarm',
    blurb: 'Tiny lights herd stray sparks into jars.',
    baseCost: 100,
    costGrowth: 1.15,
    baseRate: 1,
  },
  {
    id: 'kiln',
    name: 'Resin Kiln',
    blurb: 'Slow heat concentrates droplets into wealth.',
    baseCost: 1100,
    costGrowth: 1.15,
    baseRate: 8,
  },
  {
    id: 'groveheart',
    name: 'Groveheart',
    blurb: 'A living core that sings resin into being.',
    baseCost: 12000,
    costGrowth: 1.15,
    baseRate: 47,
  },
]

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'tapStrength',
    name: 'Keen Tap',
    blurb: 'Each touch pulls more resin from the bark.',
    baseCost: 50,
    costGrowth: 1.6,
    effect: 1,
  },
  {
    id: 'resinVein',
    name: 'Resin Vein',
    blurb: 'All generators run a little richer.',
    baseCost: 250,
    costGrowth: 1.7,
    effect: 0.15,
  },
  {
    id: 'emberChorus',
    name: 'Ember Chorus',
    blurb: 'Fireflies and kilns hum in harmony.',
    baseCost: 2000,
    costGrowth: 1.75,
    effect: 0.25,
  },
  {
    id: 'deepRoots',
    name: 'Deep Roots',
    blurb: 'Offline growth holds longer in the soil.',
    baseCost: 5000,
    costGrowth: 2,
    effect: 0.5,
  },
]

export const TICK_MS = 1000 / 30
export const SAVE_KEY = 'kindlewood-save-v1'
export const MAX_OFFLINE_MS = 1000 * 60 * 60 * 8
