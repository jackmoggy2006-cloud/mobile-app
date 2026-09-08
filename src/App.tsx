import { useEffect, useState } from 'react'
import { DebtSheet } from './components/DebtSheet'
import { ExpenseSheet } from './components/ExpenseSheet'
import { PlanSummary } from './components/PlanSummary'
import {
  buildMonthPlan,
  createDebt,
  createExpense,
  formatMoney,
} from './lib/calculator'
import { clearSavedState, loadState, saveState } from './lib/storage'
import type { AppState, Debt, Expense, PayStrategy } from './types'

function numVal(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const plan = buildMonthPlan(state)
  const hasAnyData =
    state.income > 0 || state.debts.length > 0 || state.expenses.length > 0

  useEffect(() => {
    saveState(state)
  }, [state])

  const updateDebt = (id: string, field: keyof Debt, value: string | number) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    }))
  }

  const updateExpense = (
    id: string,
    field: keyof Expense,
    value: string | number,
  ) => {
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    }))
  }

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="grid-fade" />
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◇
          </span>
          <div>
            <p className="brand-name">Cove</p>
            <p className="brand-tag">Pay your debts. Keep what’s left.</p>
          </div>
        </div>
        {hasAnyData && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Clear everything and start over?')) {
                clearSavedState()
                setState(loadState())
              }
            }}
          >
            Clear all
          </button>
        )}
      </header>

      <main>
        <section className="hero">
          <h1 className="hero-brand">Cove</h1>
          <p className="hero-line">
            Enter what you earn, what you spend, and what you owe. Cove tells you
            exactly what to pay each month — and how much you still get to keep.
          </p>
        </section>

        <ol className="how-to" aria-label="How to use Cove">
          <li>
            <strong>1. Income</strong>
            <span>How much money you get each month</span>
          </li>
          <li>
            <strong>2. Bills</strong>
            <span>Rent, food, and other living costs</span>
          </li>
          <li>
            <strong>3. Debts</strong>
            <span>Credit cards, loans, and minimums</span>
          </li>
          <li>
            <strong>4. Plan</strong>
            <span>See what to pay and what’s left</span>
          </li>
        </ol>

        <section className="income-panel" aria-labelledby="income-heading">
          <div className="income-copy">
            <p className="step-label">Step 1</p>
            <h2 id="income-heading">Your monthly income</h2>
            <p>Put the money you actually take home each month.</p>
          </div>
          <label className="income-field">
            <span className="sr-only">Monthly income</span>
            <span className="currency">$</span>
            <input
              value={state.income || ''}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) =>
                setState((prev) => ({ ...prev, income: numVal(e.target.value) }))
              }
            />
          </label>
          <dl className="income-meta">
            <div>
              <dt>Left after bills</dt>
              <dd>{formatMoney(plan.availableForDebt)}</dd>
            </div>
            <div>
              <dt>Debt minimums</dt>
              <dd>{formatMoney(plan.minimumsTotal)}</dd>
            </div>
            <div>
              <dt>You keep</dt>
              <dd className={plan.canCoverMinimums ? 'ok' : 'bad'}>
                {plan.canCoverMinimums
                  ? formatMoney(plan.leftover)
                  : `Need ${formatMoney(plan.shortfall)} more`}
              </dd>
            </div>
          </dl>
        </section>

        <div className="workspace">
          <ExpenseSheet
            expenses={state.expenses}
            onChange={updateExpense}
            onAdd={() =>
              setState((prev) => ({
                ...prev,
                expenses: [...prev.expenses, createExpense()],
              }))
            }
            onRemove={(id) =>
              setState((prev) => ({
                ...prev,
                expenses: prev.expenses.filter((e) => e.id !== id),
              }))
            }
          />

          <DebtSheet
            debts={state.debts}
            onChange={updateDebt}
            onAdd={() =>
              setState((prev) => ({
                ...prev,
                debts: [...prev.debts, createDebt({ dueDay: 1 })],
              }))
            }
            onRemove={(id) =>
              setState((prev) => ({
                ...prev,
                debts: prev.debts.filter((d) => d.id !== id),
              }))
            }
          />
        </div>

        <PlanSummary
          plan={plan}
          strategy={state.strategy}
          hasIncome={state.income > 0}
          hasDebts={state.debts.length > 0}
          onStrategyChange={(strategy: PayStrategy) =>
            setState((prev) => ({ ...prev, strategy }))
          }
        />
      </main>

      <footer className="footer">
        <p>Your numbers stay on this phone or computer. Nothing is uploaded.</p>
      </footer>
    </div>
  )
}
