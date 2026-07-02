import type { AppState } from '../types'

const STORAGE_KEY = 'fittrack-data'

const defaultState: AppState = {
  workouts: [],
  metrics: [],
  goals: [
    {
      id: 'default-1',
      title: 'Work out 4 times this week',
      type: 'workouts_per_week',
      target: 4,
      current: 0,
      unit: 'workouts',
      completed: false,
    },
    {
      id: 'default-2',
      title: 'Run 20 km this month',
      type: 'distance',
      target: 20,
      current: 0,
      unit: 'km',
      completed: false,
    },
  ],
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultState, goals: [...defaultState.goals] }
    const parsed = JSON.parse(raw) as AppState
    return {
      workouts: parsed.workouts ?? [],
      metrics: parsed.metrics ?? [],
      goals: parsed.goals?.length ? parsed.goals : [...defaultState.goals],
    }
  } catch {
    return { ...defaultState, goals: [...defaultState.goals] }
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
