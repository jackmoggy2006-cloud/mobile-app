import type { MonthPlan, PayStrategy } from '../types'
import { formatMoney, formatMonths } from '../lib/calculator'

interface PlanSummaryProps {
  plan: MonthPlan
  strategy: PayStrategy
  hasIncome: boolean
  hasDebts: boolean
  onStrategyChange: (strategy: PayStrategy) => void
}

export function PlanSummary({
  plan,
  strategy,
  hasIncome,
  hasDebts,
  onStrategyChange,
}: PlanSummaryProps) {
  const needsSetup = !hasIncome || !hasDebts

  return (
    <section className="plan" aria-labelledby="plan-heading">
      <div className="plan-head">
        <div>
          <p className="step-label">Step 4</p>
          <h2 id="plan-heading">What to pay this month</h2>
          <p>
            Cove pays every minimum first so you stay current. Extra money goes
            to one debt to knock it down faster.
          </p>
        </div>

        <div className="strategy-toggle" role="group" aria-label="Where extra money goes">
          <button
            type="button"
            className={strategy === 'avalanche' ? 'active' : ''}
            onClick={() => onStrategyChange('avalanche')}
          >
            Highest interest first
            <span>Usually saves the most money</span>
          </button>
          <button
            type="button"
            className={strategy === 'snowball' ? 'active' : ''}
            onClick={() => onStrategyChange('snowball')}
          >
            Smallest debt first
            <span>Clears debts one by one sooner</span>
          </button>
        </div>
      </div>

      {needsSetup ? (
        <div className="alert alert-hint" role="status">
          {!hasIncome && !hasDebts
            ? 'Start with Step 1 (income), then add your bills and debts. Your plan will show up here.'
            : !hasIncome
              ? 'Add your monthly income in Step 1 so Cove can build a plan.'
              : 'Add at least one debt in Step 3 to see what you should pay.'}
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="stat-label">Money you keep</span>
              <strong
                className={`stat-value ${plan.canCoverMinimums ? 'positive' : 'danger'}`}
              >
                {plan.canCoverMinimums
                  ? formatMoney(plan.leftover)
                  : formatMoney(0)}
              </strong>
            </div>
            <div className="stat">
              <span className="stat-label">Pay toward debts</span>
              <strong className="stat-value">
                {formatMoney(plan.debtPaymentsTotal)}
              </strong>
            </div>
            <div className="stat">
              <span className="stat-label">Debt-free in</span>
              <strong className="stat-value">
                {formatMonths(plan.projectedMonths)}
              </strong>
            </div>
            <div className="stat">
              <span className="stat-label">Interest you’ll pay</span>
              <strong className="stat-value">
                {formatMoney(plan.projectedInterest)}
              </strong>
            </div>
          </div>

          {!plan.canCoverMinimums && (
            <div className="alert alert-danger" role="alert">
              You’re short {formatMoney(plan.shortfall)} after bills. You don’t
              have enough for all debt minimums yet. Raise income, cut a bill, or
              adjust a minimum.
            </div>
          )}

          {plan.canCoverMinimums && plan.leftover > 0 && (
            <div className="alert alert-ok" role="status">
              After bills and debt payments, you keep{' '}
              <strong>{formatMoney(plan.leftover)}</strong>.
            </div>
          )}

          {plan.canCoverMinimums && plan.leftover === 0 && plan.debtPaymentsTotal > 0 && (
            <div className="alert alert-hint" role="status">
              Your plan uses all leftover money on debt. Nothing is left as buffer
              this month.
            </div>
          )}
        </>
      )}

      <div className="table-wrap">
        <table className="grid-table plan-table">
          <thead>
            <tr>
              <th scope="col">Debt</th>
              <th scope="col">Must pay</th>
              <th scope="col">Extra</th>
              <th scope="col">Pay this much</th>
              <th scope="col">Until paid off</th>
            </tr>
          </thead>
          <tbody>
            {plan.allocations.filter((a) => a.balance > 0).length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No debts yet — nothing to pay here.
                </td>
              </tr>
            ) : (
              plan.allocations
                .filter((a) => a.balance > 0)
                .map((a) => (
                  <tr key={a.debtId} className={a.extra > 0 ? 'highlight-row' : ''}>
                    <td data-label="Debt">
                      <div className="debt-cell">
                        <strong>{a.name || 'Untitled debt'}</strong>
                        <span>
                          {formatMoney(a.balance)} owed · {a.apr}% interest
                        </span>
                      </div>
                    </td>
                    <td data-label="Must pay">{formatMoney(a.minimum)}</td>
                    <td data-label="Extra">
                      {a.extra > 0 ? (
                        <span className="extra-tag">+{formatMoney(a.extra)}</span>
                      ) : (
                        formatMoney(0)
                      )}
                    </td>
                    <td data-label="Pay this much">
                      <strong className="pay-total">{formatMoney(a.total)}</strong>
                    </td>
                    <td data-label="Until paid off">
                      {formatMonths(a.monthsToPayoff)}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {!needsSetup && (
        <ol className="flow">
          <li>
            <span>1</span>
            Income {formatMoney(plan.income)} − bills{' '}
            {formatMoney(plan.expensesTotal)} ={' '}
            {formatMoney(plan.availableForDebt)} left for debt
          </li>
          <li>
            <span>2</span>
            Pay every minimum ({formatMoney(plan.minimumsTotal)}) so nothing falls
            behind
          </li>
          <li>
            <span>3</span>
            Put extra ({formatMoney(plan.extrasTotal)}) toward the{' '}
            {strategy === 'avalanche' ? 'highest-interest' : 'smallest'} debt
          </li>
        </ol>
      )}
    </section>
  )
}
