import {
  buildMonthPlan,
  createDebt,
  createExpense,
  monthsToPayOff,
  simulatePayoff,
} from './calculator'
import type { AppState } from '../types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function almostEqual(a: number, b: number, eps = 0.02) {
  return Math.abs(a - b) <= eps
}

const base: AppState = {
  income: 4000,
  strategy: 'avalanche',
  expenses: [
    createExpense({ name: 'Rent', amount: 1500 }),
    createExpense({ name: 'Food', amount: 400 }),
  ],
  debts: [
    createDebt({
      name: 'Card',
      balance: 2000,
      apr: 24,
      minimum: 50,
      dueDay: 1,
    }),
    createDebt({
      name: 'Loan',
      balance: 5000,
      apr: 6,
      minimum: 200,
      dueDay: 15,
    }),
  ],
}

const plan = buildMonthPlan(base)

assert(plan.expensesTotal === 1900, `expensesTotal expected 1900 got ${plan.expensesTotal}`)
assert(plan.availableForDebt === 2100, `available expected 2100 got ${plan.availableForDebt}`)
assert(plan.minimumsTotal === 250, `minimums expected 250 got ${plan.minimumsTotal}`)
assert(plan.canCoverMinimums, 'should cover minimums')
assert(plan.extrasTotal > 0, 'should have extras')

// Avalanche: extra should go to Card (higher APR)
const card = plan.allocations.find((a: { name: string }) => a.name === 'Card')!
const loan = plan.allocations.find((a: { name: string }) => a.name === 'Loan')!
assert(card.extra > 0, 'avalanche should put extra on high APR card')
assert(loan.extra === 0, 'loan should only get minimum under avalanche')
assert(almostEqual(card.total, card.minimum + card.extra), 'card total = min + extra')
assert(plan.leftover >= 0, 'leftover should be non-negative')

const snowball = buildMonthPlan({ ...base, strategy: 'snowball' })
const snowCard = snowball.allocations.find((a: { name: string }) => a.name === 'Card')!
const snowLoan = snowball.allocations.find((a: { name: string }) => a.name === 'Loan')!
assert(snowCard.extra > 0, 'snowball should attack smaller balance first')
assert(snowLoan.extra === 0, 'larger loan should not get extra under snowball')

const short = buildMonthPlan({
  ...base,
  income: 2000,
})
assert(!short.canCoverMinimums, 'should detect shortfall')
assert(short.shortfall > 0, 'shortfall amount should be positive')
assert(short.leftover === 0, 'no leftover when short')

assert(monthsToPayOff(1000, 0, 100) === 10, 'zero APR payoff months')
assert(monthsToPayOff(1000, 20, 5) === null, 'payment below interest never pays off')

const sim = simulatePayoff(base.debts, 250 + 500, 'avalanche')
assert(sim.months !== null && sim.months > 0, 'simulation should finish')
assert(sim.totalInterest >= 0, 'interest non-negative')

console.log('All calculator checks passed.')
