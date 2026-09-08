import { SAVE_KEY } from './catalog'
import { createInitialState, reconcileOffline } from './economy'
import type { GameState } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function loadGame(): {
  state: GameState
  offlineMs: number
  gained: number
} {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) {
      return { state: createInitialState(), offlineMs: 0, gained: 0 }
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return { state: createInitialState(), offlineMs: 0, gained: 0 }
    }
    const base = createInitialState()
    const generators = isRecord(parsed.generators) ? parsed.generators : {}
    const upgrades = isRecord(parsed.upgrades) ? parsed.upgrades : {}
    const state: GameState = {
      resin: readNumber(parsed.resin, 0),
      totalResin: readNumber(parsed.totalResin, 0),
      tapPower: readNumber(parsed.tapPower, 1),
      generators: {
        sapling: readNumber(generators.sapling, 0),
        firefly: readNumber(generators.firefly, 0),
        kiln: readNumber(generators.kiln, 0),
        groveheart: readNumber(generators.groveheart, 0),
      },
      upgrades: {
        tapStrength: readNumber(upgrades.tapStrength, 0),
        resinVein: readNumber(upgrades.resinVein, 0),
        emberChorus: readNumber(upgrades.emberChorus, 0),
        deepRoots: readNumber(upgrades.deepRoots, 0),
      },
      lastTickAt: readNumber(parsed.lastTickAt, base.lastTickAt),
      createdAt: readNumber(parsed.createdAt, base.createdAt),
    }
    return reconcileOffline(state)
  } catch {
    return { state: createInitialState(), offlineMs: 0, gained: 0 }
  }
}

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
