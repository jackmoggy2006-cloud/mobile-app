export type PayStrategy = 'avalanche' | 'snowball'

export interface Debt {
  id: string
  name: string
  balance: number
  apr: number
  minimum: number
  dueDay: number
}

export interface Expense {
  id: string
  name: string
  amount: number
}

export interface PaymentAllocation {
  debtId: string
  name: string
  minimum: number
  extra: number
  total: number
  balance: number
  apr: number
  monthsToPayoff: number | null
}

export interface MonthPlan {
  income: number
  expensesTotal: number
  availableForDebt: number
  minimumsTotal: number
  extrasTotal: number
  debtPaymentsTotal: number
  leftover: number
  shortfall: number
  canCoverMinimums: boolean
  allocations: PaymentAllocation[]
  strategy: PayStrategy
  projectedMonths: number | null
  projectedInterest: number
}

export interface AppState {
  income: number
  strategy: PayStrategy
  debts: Debt[]
  expenses: Expense[]
}
