import type { Expense } from '../types'
import { formatMoney } from '../lib/calculator'

interface ExpenseSheetProps {
  expenses: Expense[]
  onChange: (id: string, field: keyof Expense, value: string | number) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

function numVal(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function ExpenseSheet({
  expenses,
  onChange,
  onAdd,
  onRemove,
}: ExpenseSheetProps) {
  return (
    <section className="sheet" aria-labelledby="expenses-heading">
      <div className="sheet-head">
        <div>
          <h2 id="expenses-heading">Monthly bills</h2>
          <p>Living costs that come out before debt payments.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onAdd}>
          + Add bill
        </button>
      </div>

      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Amount</th>
              <th scope="col" className="col-action">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty-row">
                  Add rent, groceries, and other must-pays.
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <tr key={expense.id}>
                  <td data-label="Name">
                    <input
                      className="cell-input"
                      value={expense.name}
                      placeholder="Bill name"
                      onChange={(e) => onChange(expense.id, 'name', e.target.value)}
                      aria-label="Expense name"
                    />
                  </td>
                  <td data-label="Amount">
                    <div className="input-prefix">
                      <span>$</span>
                      <input
                        className="cell-input"
                        inputMode="decimal"
                        value={expense.amount || ''}
                        placeholder="0"
                        onChange={(e) =>
                          onChange(expense.id, 'amount', numVal(e.target.value))
                        }
                        aria-label={`${expense.name || 'Expense'} amount`}
                      />
                    </div>
                  </td>
                  <td className="col-action">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onRemove(expense.id)}
                      aria-label={`Remove ${expense.name || 'expense'}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr>
                <td>Total bills</td>
                <td>
                  {formatMoney(expenses.reduce((s, e) => s + (e.amount || 0), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
