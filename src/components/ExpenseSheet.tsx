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
          <p className="step-label">Step 2</p>
          <h2 id="expenses-heading">Monthly bills</h2>
          <p>Things you pay every month before debt — rent, groceries, phone, etc.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onAdd}>
          + Add bill
        </button>
      </div>

      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th scope="col">What is it?</th>
              <th scope="col">How much?</th>
              <th scope="col" className="col-action">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty-row">
                  Tap <strong>+ Add bill</strong> and list your living costs.
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <tr key={expense.id}>
                  <td data-label="What is it?">
                    <input
                      className="cell-input"
                      value={expense.name}
                      placeholder="e.g. Rent"
                      onChange={(e) => onChange(expense.id, 'name', e.target.value)}
                      aria-label="Bill name"
                    />
                  </td>
                  <td data-label="How much?">
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
                        aria-label={`${expense.name || 'Bill'} amount`}
                      />
                    </div>
                  </td>
                  <td className="col-action">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onRemove(expense.id)}
                      aria-label={`Remove ${expense.name || 'bill'}`}
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
