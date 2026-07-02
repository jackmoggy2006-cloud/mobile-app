import { useState } from 'react'
import { Target, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { useFitness } from '../context/FitnessContext'
import type { GoalType } from '../types'

const goalTypeOptions: { value: GoalType; label: string; unit: string }[] = [
  { value: 'workouts_per_week', label: 'Workouts per week', unit: 'workouts' },
  { value: 'distance', label: 'Monthly distance', unit: 'km' },
  { value: 'duration', label: 'Monthly duration', unit: 'min' },
  { value: 'weight', label: 'Target weight', unit: 'kg' },
]

export default function Goals() {
  const { goals, addGoal, deleteGoal, toggleGoalComplete } = useFitness()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<GoalType>('workouts_per_week')
  const [target, setTarget] = useState(4)
  const [deadline, setDeadline] = useState('')

  const selectedType = goalTypeOptions.find((g) => g.value === type)!

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    addGoal({
      title: title.trim(),
      type,
      target,
      unit: selectedType.unit,
      deadline: deadline || undefined,
    })

    setTitle('')
    setTarget(4)
    setDeadline('')
    setShowForm(false)
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-4 py-2.5 text-white placeholder-[var(--color-muted)] outline-none transition-colors focus:border-[var(--color-accent)]'

  const active = goals.filter((g) => !g.completed)
  const completed = goals.filter((g) => g.completed)

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Goals</h2>
          <p className="mt-1 text-[var(--color-muted)]">Set targets and track your progress</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Create Goal</h3>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Title</label>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Run a 5K"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Type</label>
              <select
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value as GoalType)}
              >
                {goalTypeOptions.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">
                Target ({selectedType.unit})
              </label>
              <input
                type="number"
                className={inputClass}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                min={1}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Deadline (optional)</label>
              <input
                type="date"
                className={inputClass}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-dim)]"
            >
              Create Goal
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

      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            In Progress
          </h3>
          {active.map((goal) => {
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))
            return (
              <div key={goal.id} className="glass rounded-2xl p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleGoalComplete(goal.id)}
                      className="mt-0.5 text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                    >
                      <Circle className="h-5 w-5" />
                    </button>
                    <div>
                      <p className="font-semibold text-white">{goal.title}</p>
                      <p className="text-sm text-[var(--color-muted)]">
                        {goal.current} / {goal.target} {goal.unit}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteGoal(goal.id)}
                    className="rounded-lg p-1.5 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-dim)] to-[var(--color-accent)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 text-right text-xs text-[var(--color-muted)]">{pct}% complete</p>
              </div>
            )
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Completed
          </h3>
          {completed.map((goal) => (
            <div
              key={goal.id}
              className="glass rounded-2xl p-5 opacity-70"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleGoalComplete(goal.id)}
                    className="text-[var(--color-accent)]"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                  <p className="font-semibold text-white line-through">{goal.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteGoal(goal.id)}
                  className="rounded-lg p-1.5 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {goals.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <Target className="mx-auto mb-4 h-12 w-12 text-[var(--color-muted)]" />
          <p className="text-[var(--color-muted)]">
            No goals set yet. Create your first goal to stay motivated!
          </p>
        </div>
      )}
    </div>
  )
}
