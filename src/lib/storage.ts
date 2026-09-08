import type { AppState } from '../types'

const STORAGE_KEY = 'cove-debt-planner-v2'

export const defaultState = (): AppState => ({
  income: 0,
  strategy: 'avalanche',
  debts: [],
  expenses: [],
})

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || typeof parsed !== 'object') return defaultState()
    return {
      income: Number(parsed.income) || 0,
      strategy: parsed.strategy === 'snowball' ? 'snowball' : 'avalanche',
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    }
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearSavedState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
