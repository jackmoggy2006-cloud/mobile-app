import type {
  AppState,
  Debt,
  Expense,
  MonthPlan,
  PayStrategy,
  PaymentAllocation,
} from '../types'

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Estimate months to pay off a single debt given a fixed monthly payment. */
export function monthsToPayOff(
  balance: number,
  apr: number,
  payment: number,
): number | null {
  if (balance <= 0) return 0
  if (payment <= 0) return null

  const monthlyRate = apr / 100 / 12
  if (monthlyRate === 0) {
    return Math.ceil(balance / payment)
  }

  // If payment doesn't cover interest, never pays off
  if (payment <= balance * monthlyRate) return null

  const months =
    Math.log(payment / (payment - balance * monthlyRate)) /
    Math.log(1 + monthlyRate)

  return Math.ceil(months)
}

/** Simulate full payoff schedule with strategy-based extra payments. */
export function simulatePayoff(
  debts: Debt[],
  monthlyBudget: number,
  strategy: PayStrategy,
  maxMonths = 600,
): { months: number | null; totalInterest: number } {
  if (debts.length === 0 || monthlyBudget <= 0) {
    return { months: debts.every((d) => d.balance <= 0) ? 0 : null, totalInterest: 0 }
  }

  const balances = debts.map((d) => ({
    ...d,
    balance: d.balance,
  }))

  let totalInterest = 0
  let month = 0

  while (month < maxMonths) {
    const remaining = balances.filter((d) => d.balance > 0.005)
    if (remaining.length === 0) {
      return { months: month, totalInterest: roundMoney(totalInterest) }
    }

    // Accrue interest
    for (const d of remaining) {
      const interest = roundMoney((d.balance * d.apr) / 100 / 12)
      d.balance = roundMoney(d.balance + interest)
      totalInterest += interest
    }

    let budget = monthlyBudget

    // Pay minimums first
    for (const d of remaining) {
      const pay = Math.min(d.minimum, d.balance, budget)
      d.balance = roundMoney(d.balance - pay)
      budget = roundMoney(budget - pay)
    }

    if (budget < 0) {
      return { months: null, totalInterest: roundMoney(totalInterest) }
    }

    // Apply extras by strategy
    const stillOpen = balances
      .filter((d) => d.balance > 0.005)
      .sort((a, b) => {
        if (strategy === 'avalanche') {
          if (b.apr !== a.apr) return b.apr - a.apr
          return a.balance - b.balance
        }
        if (a.balance !== b.balance) return a.balance - b.balance
        return b.apr - a.apr
      })

    for (const d of stillOpen) {
      if (budget <= 0) break
      const pay = Math.min(d.balance, budget)
      d.balance = roundMoney(d.balance - pay)
      budget = roundMoney(budget - pay)
    }

    month += 1
  }

  return { months: null, totalInterest: roundMoney(totalInterest) }
}

function sortForExtra(debts: Debt[], strategy: PayStrategy): Debt[] {
  return [...debts].sort((a, b) => {
    if (strategy === 'avalanche') {
      if (b.apr !== a.apr) return b.apr - a.apr
      return a.balance - b.balance
    }
    if (a.balance !== b.balance) return a.balance - b.balance
    return b.apr - a.apr
  })
}

export function buildMonthPlan(state: AppState): MonthPlan {
  const income = Math.max(0, state.income || 0)
  const expensesTotal = roundMoney(
    state.expenses.reduce((sum, e) => sum + Math.max(0, e.amount || 0), 0),
  )
  const activeDebts = state.debts.filter((d) => (d.balance || 0) > 0)
  const minimumsTotal = roundMoney(
    activeDebts.reduce((sum, d) => sum + Math.max(0, d.minimum || 0), 0),
  )

  const availableForDebt = roundMoney(income - expensesTotal)
  const shortfall = roundMoney(Math.max(0, minimumsTotal - availableForDebt))
  const canCoverMinimums = shortfall <= 0

  const extrasPool = canCoverMinimums
    ? roundMoney(Math.max(0, availableForDebt - minimumsTotal))
    : 0

  const extrasById = new Map<string, number>()
  let remainingExtra = extrasPool

  if (remainingExtra > 0) {
    for (const debt of sortForExtra(activeDebts, state.strategy)) {
      if (remainingExtra <= 0) break
      const room = Math.max(0, roundMoney(debt.balance - debt.minimum))
      const extra = Math.min(room, remainingExtra)
      extrasById.set(debt.id, extra)
      remainingExtra = roundMoney(remainingExtra - extra)
    }
  }

  const allocations: PaymentAllocation[] = state.debts.map((debt) => {
    const minimum =
      debt.balance > 0 ? Math.min(Math.max(0, debt.minimum), debt.balance) : 0
    const extra = extrasById.get(debt.id) ?? 0
    const total = roundMoney(minimum + extra)
    return {
      debtId: debt.id,
      name: debt.name || 'Untitled debt',
      minimum: roundMoney(minimum),
      extra: roundMoney(extra),
      total,
      balance: debt.balance,
      apr: debt.apr,
      monthsToPayoff: monthsToPayOff(debt.balance, debt.apr, total),
    }
  })

  const debtPaymentsTotal = roundMoney(
    allocations.reduce((sum, a) => sum + a.total, 0),
  )
  const extrasTotal = roundMoney(
    allocations.reduce((sum, a) => sum + a.extra, 0),
  )

  // Leftover = income - expenses - debt payments
  // Also includes any unused extra that couldn't be applied (edge case)
  const leftover = canCoverMinimums
    ? roundMoney(income - expensesTotal - debtPaymentsTotal)
    : 0

  const budgetForSim = canCoverMinimums
    ? roundMoney(minimumsTotal + extrasTotal)
    : 0

  const sim =
    canCoverMinimums && activeDebts.length > 0
      ? simulatePayoff(activeDebts, budgetForSim, state.strategy)
      : { months: activeDebts.length === 0 ? 0 : null, totalInterest: 0 }

  return {
    income,
    expensesTotal,
    availableForDebt,
    minimumsTotal,
    extrasTotal,
    debtPaymentsTotal,
    leftover,
    shortfall,
    canCoverMinimums,
    allocations,
    strategy: state.strategy,
    projectedMonths: sim.months,
    projectedInterest: sim.totalInterest,
  }
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatMonths(months: number | null): string {
  if (months === null) return '—'
  if (months === 0) return 'Paid'
  if (months < 12) return `${months} mo`
  const y = Math.floor(months / 12)
  const m = months % 12
  if (m === 0) return `${y} yr`
  return `${y} yr ${m} mo`
}

export function createDebt(partial?: Partial<Debt>): Debt {
  return {
    id: crypto.randomUUID(),
    name: '',
    balance: 0,
    apr: 0,
    minimum: 0,
    dueDay: 1,
    ...partial,
  }
}

export function createExpense(partial?: Partial<Expense>): Expense {
  return {
    id: crypto.randomUUID(),
    name: '',
    amount: 0,
    ...partial,
  }
}
