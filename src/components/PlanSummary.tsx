import type { MonthPlan, PayStrategy } from '../types'
import { formatMoney, formatMonths } from '../lib/calculator'

interface PlanSummaryProps {
  plan: MonthPlan
  strategy: PayStrategy
  onStrategyChange: (strategy: PayStrategy) => void
}

export function PlanSummary({ plan, strategy, onStrategyChange }: PlanSummaryProps) {
  return (
    <section className="plan" aria-labelledby="plan-heading">
      <div className="plan-head">
        <div>
          <h2 id="plan-heading">This month’s plan</h2>
          <p>
            Minimums stay covered first. Extra cash hits the debt that frees you
            fastest.
          </p>
        </div>

        <div className="strategy-toggle" role="group" aria-label="Payoff strategy">
          <button
            type="button"
            className={strategy === 'avalanche' ? 'active' : ''}
            onClick={() => onStrategyChange('avalanche')}
          >
            Avalanche
            <span>Highest interest first</span>
          </button>
          <button
            type="button"
            className={strategy === 'snowball' ? 'active' : ''}
            onClick={() => onStrategyChange('snowball')}
          >
            Snowball
            <span>Smallest balance first</span>
          </button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Left in pocket</span>
          <strong className={`stat-value ${plan.canCoverMinimums ? 'positive' : 'danger'}`}>
            {plan.canCoverMinimums ? formatMoney(plan.leftover) : formatMoney(0)}
          </strong>
        </div>
        <div className="stat">
          <span className="stat-label">Debt payments</span>
          <strong className="stat-value">{formatMoney(plan.debtPaymentsTotal)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Debt-free in</span>
          <strong className="stat-value">{formatMonths(plan.projectedMonths)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Est. interest</span>
          <strong className="stat-value">{formatMoney(plan.projectedInterest)}</strong>
        </div>
      </div>

      {!plan.canCoverMinimums && (
        <div className="alert alert-danger" role="alert">
          You’re short {formatMoney(plan.shortfall)} of covering minimum payments
          after bills. Raise income, trim bills, or lower a minimum to stay current.
        </div>
      )}

      {plan.canCoverMinimums && plan.leftover > 0 && (
        <div className="alert alert-ok" role="status">
          After bills and recommended debt payments, you keep{' '}
          <strong>{formatMoney(plan.leftover)}</strong> as buffer.
        </div>
      )}

      <div className="table-wrap">
        <table className="grid-table plan-table">
          <thead>
            <tr>
              <th scope="col">Debt</th>
              <th scope="col">Minimum</th>
              <th scope="col">Extra</th>
              <th scope="col">Pay this month</th>
              <th scope="col">Payoff</th>
            </tr>
          </thead>
          <tbody>
            {plan.allocations.filter((a) => a.balance > 0).length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No open debts — you’re clear.
                </td>
              </tr>
            ) : (
              plan.allocations
                .filter((a) => a.balance > 0)
                .map((a) => (
                  <tr key={a.debtId} className={a.extra > 0 ? 'highlight-row' : ''}>
                    <td data-label="Debt">
                      <div className="debt-cell">
                        <strong>{a.name}</strong>
                        <span>
                          {formatMoney(a.balance)} · {a.apr}% APR
                        </span>
                      </div>
                    </td>
                    <td data-label="Minimum">{formatMoney(a.minimum)}</td>
                    <td data-label="Extra">
                      {a.extra > 0 ? (
                        <span className="extra-tag">+{formatMoney(a.extra)}</span>
                      ) : (
                        formatMoney(0)
                      )}
                    </td>
                    <td data-label="Pay this month">
                      <strong className="pay-total">{formatMoney(a.total)}</strong>
                    </td>
                    <td data-label="Payoff">{formatMonths(a.monthsToPayoff)}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      <ol className="flow">
        <li>
          <span>1</span>
          Income {formatMoney(plan.income)} − bills {formatMoney(plan.expensesTotal)} ={' '}
          {formatMoney(plan.availableForDebt)} for debt
        </li>
        <li>
          <span>2</span>
          Cover every minimum ({formatMoney(plan.minimumsTotal)}) so nothing falls behind
        </li>
        <li>
          <span>3</span>
          Send leftover extras ({formatMoney(plan.extrasTotal)}) to the{' '}
          {strategy === 'avalanche' ? 'highest-interest' : 'smallest-balance'} debt
        </li>
      </ol>
    </section>
  )
}
