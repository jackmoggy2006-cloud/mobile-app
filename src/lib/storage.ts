import type { AppState } from '../types'
import { createDebt, createExpense } from './calculator'

const STORAGE_KEY = 'cove-debt-planner-v1'

export const defaultState = (): AppState => ({
  income: 4200,
  strategy: 'avalanche',
  debts: [
    createDebt({
      name: 'Credit card',
      balance: 3200,
      apr: 22.9,
      minimum: 95,
      dueDay: 12,
    }),
    createDebt({
      name: 'Car loan',
      balance: 9400,
      apr: 6.5,
      minimum: 285,
      dueDay: 3,
    }),
    createDebt({
      name: 'Student loan',
      balance: 14500,
      apr: 5.2,
      minimum: 165,
      dueDay: 20,
    }),
  ],
  expenses: [
    createExpense({ name: 'Rent', amount: 1450 }),
    createExpense({ name: 'Groceries', amount: 420 }),
    createExpense({ name: 'Utilities', amount: 180 }),
    createExpense({ name: 'Transport', amount: 160 }),
  ],
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
