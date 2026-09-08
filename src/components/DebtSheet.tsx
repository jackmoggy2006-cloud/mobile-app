import type { Debt } from '../types'
import { formatMoney } from '../lib/calculator'

interface DebtSheetProps {
  debts: Debt[]
  onChange: (id: string, field: keyof Debt, value: string | number) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

function numVal(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function DebtSheet({ debts, onChange, onAdd, onRemove }: DebtSheetProps) {
  return (
    <section className="sheet" aria-labelledby="debts-heading">
      <div className="sheet-head">
        <div>
          <h2 id="debts-heading">Debts</h2>
          <p>Balances, rates, and the minimum you must pay to stay current.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onAdd}>
          + Add debt
        </button>
      </div>

      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Balance</th>
              <th scope="col">APR %</th>
              <th scope="col">Min. payment</th>
              <th scope="col">Due day</th>
              <th scope="col" className="col-action">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {debts.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-row">
                  No debts yet — add one to start your plan.
                </td>
              </tr>
            ) : (
              debts.map((debt) => (
                <tr key={debt.id}>
                  <td data-label="Name">
                    <input
                      className="cell-input"
                      value={debt.name}
                      placeholder="Debt name"
                      onChange={(e) => onChange(debt.id, 'name', e.target.value)}
                      aria-label="Debt name"
                    />
                  </td>
                  <td data-label="Balance">
                    <div className="input-prefix">
                      <span>$</span>
                      <input
                        className="cell-input"
                        inputMode="decimal"
                        value={debt.balance || ''}
                        placeholder="0"
                        onChange={(e) =>
                          onChange(debt.id, 'balance', numVal(e.target.value))
                        }
                        aria-label={`${debt.name || 'Debt'} balance`}
                      />
                    </div>
                  </td>
                  <td data-label="APR %">
                    <input
                      className="cell-input"
                      inputMode="decimal"
                      value={debt.apr || ''}
                      placeholder="0"
                      onChange={(e) =>
                        onChange(debt.id, 'apr', numVal(e.target.value))
                      }
                      aria-label={`${debt.name || 'Debt'} APR`}
                    />
                  </td>
                  <td data-label="Min. payment">
                    <div className="input-prefix">
                      <span>$</span>
                      <input
                        className="cell-input"
                        inputMode="decimal"
                        value={debt.minimum || ''}
                        placeholder="0"
                        onChange={(e) =>
                          onChange(debt.id, 'minimum', numVal(e.target.value))
                        }
                        aria-label={`${debt.name || 'Debt'} minimum payment`}
                      />
                    </div>
                  </td>
                  <td data-label="Due day">
                    <input
                      className="cell-input"
                      inputMode="numeric"
                      value={debt.dueDay || ''}
                      placeholder="1"
                      onChange={(e) => {
                        const day = Math.min(31, Math.max(1, Math.round(numVal(e.target.value)) || 1))
                        onChange(debt.id, 'dueDay', day)
                      }}
                      aria-label={`${debt.name || 'Debt'} due day`}
                    />
                  </td>
                  <td className="col-action">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onRemove(debt.id)}
                      aria-label={`Remove ${debt.name || 'debt'}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {debts.length > 0 && (
            <tfoot>
              <tr>
                <td>Totals</td>
                <td>{formatMoney(debts.reduce((s, d) => s + (d.balance || 0), 0))}</td>
                <td />
                <td>{formatMoney(debts.reduce((s, d) => s + (d.minimum || 0), 0))}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
