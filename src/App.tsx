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
import { loadState, saveState } from './lib/storage'
import type { AppState, Debt, Expense, PayStrategy } from './types'

function numVal(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const plan = buildMonthPlan(state)

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
            <p className="brand-tag">Debt covered. Money left.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (confirm('Reset to sample data?')) {
              localStorage.removeItem('cove-debt-planner-v1')
              setState(loadState())
            }
          }}
        >
          Reset sample
        </button>
      </header>

      <main>
        <section className="hero">
          <h1 className="hero-brand">Cove</h1>
          <p className="hero-line">
            Spread your debts and bills like a sheet. Cove pays every minimum,
            aims extra where it hurts interest most, and shows what stays in your
            pocket.
          </p>
        </section>

        <section className="income-panel" aria-labelledby="income-heading">
          <div className="income-copy">
            <h2 id="income-heading">Monthly income</h2>
            <p>Take-home pay that funds bills and debt this month.</p>
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
              <dt>After bills</dt>
              <dd>{formatMoney(plan.availableForDebt)}</dd>
            </div>
            <div>
              <dt>Minimums needed</dt>
              <dd>{formatMoney(plan.minimumsTotal)}</dd>
            </div>
            <div>
              <dt>Buffer</dt>
              <dd className={plan.canCoverMinimums ? 'ok' : 'bad'}>
                {plan.canCoverMinimums
                  ? formatMoney(plan.leftover)
                  : `−${formatMoney(plan.shortfall)}`}
              </dd>
            </div>
          </dl>
        </section>

        <div className="workspace">
          <DebtSheet
            debts={state.debts}
            onChange={updateDebt}
            onAdd={() =>
              setState((prev) => ({
                ...prev,
                debts: [
                  ...prev.debts,
                  createDebt({ name: 'New debt', dueDay: 1 }),
                ],
              }))
            }
            onRemove={(id) =>
              setState((prev) => ({
                ...prev,
                debts: prev.debts.filter((d) => d.id !== id),
              }))
            }
          />

          <ExpenseSheet
            expenses={state.expenses}
            onChange={updateExpense}
            onAdd={() =>
              setState((prev) => ({
                ...prev,
                expenses: [
                  ...prev.expenses,
                  createExpense({ name: 'New bill' }),
                ],
              }))
            }
            onRemove={(id) =>
              setState((prev) => ({
                ...prev,
                expenses: prev.expenses.filter((e) => e.id !== id),
              }))
            }
          />
        </div>

        <PlanSummary
          plan={plan}
          strategy={state.strategy}
          onStrategyChange={(strategy: PayStrategy) =>
            setState((prev) => ({ ...prev, strategy }))
          }
        />
      </main>

      <footer className="footer">
        <p>
          Cove keeps minimums sacred, then stacks extras with{' '}
          {state.strategy === 'avalanche' ? 'avalanche' : 'snowball'} logic.
          Numbers stay on this device.
        </p>
      </footer>
    </div>
  )
}
