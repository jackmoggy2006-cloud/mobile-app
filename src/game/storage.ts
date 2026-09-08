import { SAVE_KEY } from './catalog'
import {
  createInitialState,
  emptyGenerators,
  emptyUpgrades,
  emptyWorkers,
  reconcileOffline,
} from './economy'
import type { GameState, MilestoneId } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readCounts<T extends string>(
  raw: unknown,
  empty: Record<T, number>,
): Record<T, number> {
  const src = isRecord(raw) ? raw : {}
  const out = { ...empty }
  for (const key of Object.keys(empty) as T[]) {
    out[key] = readNumber(src[key], 0)
  }
  return out
}

export function loadGame(): {
  state: GameState
  offlineMs: number
  gained: number
} {
  try {
    const raw =
      localStorage.getItem(SAVE_KEY) ??
      localStorage.getItem('kindlewood-save-v1')
    if (!raw) {
      return { state: createInitialState(), offlineMs: 0, gained: 0 }
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return { state: createInitialState(), offlineMs: 0, gained: 0 }
    }
    const base = createInitialState()
    const claimed = Array.isArray(parsed.claimedMilestones)
      ? (parsed.claimedMilestones.filter(
          (id): id is MilestoneId => typeof id === 'string',
        ) as MilestoneId[])
      : []
    const state: GameState = {
      resin: readNumber(parsed.resin, 0),
      totalResin: readNumber(parsed.totalResin, 0),
      tapPower: readNumber(parsed.tapPower, 1),
      generators: readCounts(parsed.generators, emptyGenerators()),
      workers: readCounts(parsed.workers, emptyWorkers()),
      upgrades: readCounts(parsed.upgrades, emptyUpgrades()),
      claimedMilestones: claimed,
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
  localStorage.removeItem('kindlewood-save-v1')
}
