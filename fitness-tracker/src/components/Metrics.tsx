import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Scale, Plus, Trash2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useFitness } from '../context/FitnessContext'

export default function Metrics() {
  const { metrics, addMetric, deleteMetric } = useFitness()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [weight, setWeight] = useState<number | ''>('')
  const [bodyFat, setBodyFat] = useState<number | ''>('')
  const [muscleMass, setMuscleMass] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  const chartData = [...metrics]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: format(parseISO(m.date), 'MMM d'),
      weight: m.weight,
      bodyFat: m.bodyFat,
    }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (weight === '' && bodyFat === '' && muscleMass === '') return

    addMetric({
      date: new Date(date).toISOString(),
      weight: weight !== '' ? weight : undefined,
      bodyFat: bodyFat !== '' ? bodyFat : undefined,
      muscleMass: muscleMass !== '' ? muscleMass : undefined,
      notes: notes.trim() || undefined,
    })

    setWeight('')
    setBodyFat('')
    setMuscleMass('')
    setNotes('')
    setShowForm(false)
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-4 py-2.5 text-white placeholder-[var(--color-muted)] outline-none transition-colors focus:border-[var(--color-accent)]'

  const latest = metrics[0]

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Body Metrics</h2>
          <p className="mt-1 text-[var(--color-muted)]">Track your physical progress</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          <Plus className="h-4 w-4" />
          Log Entry
        </button>
      </div>

      {latest && (
        <div className="grid gap-4 sm:grid-cols-3">
          {latest.weight != null && (
            <div className="glass rounded-2xl p-5 text-center">
              <Scale className="mx-auto mb-2 h-5 w-5 text-[var(--color-accent)]" />
              <p className="text-2xl font-bold text-white">{latest.weight} kg</p>
              <p className="text-xs text-[var(--color-muted)]">Current Weight</p>
            </div>
          )}
          {latest.bodyFat != null && (
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-white">{latest.bodyFat}%</p>
              <p className="text-xs text-[var(--color-muted)]">Body Fat</p>
            </div>
          )}
          {latest.muscleMass != null && (
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-white">{latest.muscleMass} kg</p>
              <p className="text-xs text-[var(--color-muted)]">Muscle Mass</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">New Entry</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Date</label>
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Weight (kg)</label>
              <input
                type="number"
                className={inputClass}
                value={weight}
                onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                step={0.1}
                min={0}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Body Fat (%)</label>
              <input
                type="number"
                className={inputClass}
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value === '' ? '' : Number(e.target.value))}
                step={0.1}
                min={0}
                max={100}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Muscle Mass (kg)</label>
              <input
                type="number"
                className={inputClass}
                value={muscleMass}
                onChange={(e) => setMuscleMass(e.target.value === '' ? '' : Number(e.target.value))}
                step={0.1}
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Notes</label>
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-dim)]"
            >
              Save Entry
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-[var(--color-border)] px-6 py-2.5 text-sm text-[var(--color-muted)] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {chartData.length >= 2 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Weight Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#1a2332',
                  border: '1px solid #2d3a4f',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">History</h3>
        {metrics.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No metrics logged yet.</p>
        ) : (
          <div className="space-y-2">
            {metrics.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-[var(--color-surface-overlay)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {format(parseISO(m.date), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {[
                      m.weight != null && `${m.weight} kg`,
                      m.bodyFat != null && `${m.bodyFat}% body fat`,
                      m.muscleMass != null && `${m.muscleMass} kg muscle`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMetric(m.id)}
                  className="rounded-lg p-2 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
