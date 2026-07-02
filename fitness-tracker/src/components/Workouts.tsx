import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Dumbbell, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useFitness } from '../context/FitnessContext'
import { WORKOUT_TYPES } from '../types'

export default function Workouts() {
  const { workouts, deleteWorkout } = useFitness()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const filtered = workouts.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || w.type === filterType
    return matchesSearch && matchesType
  })

  const inputClass =
    'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-4 py-2.5 text-white placeholder-[var(--color-muted)] outline-none transition-colors focus:border-[var(--color-accent)]'

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h2 className="text-2xl font-bold text-white">Workout History</h2>
        <p className="mt-1 text-[var(--color-muted)]">
          {workouts.length} workout{workouts.length !== 1 ? 's' : ''} logged
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            className={`${inputClass} w-full pl-10`}
            placeholder="Search workouts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={inputClass}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All types</option>
          {WORKOUT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Dumbbell className="mx-auto mb-4 h-12 w-12 text-[var(--color-muted)]" />
          <p className="text-[var(--color-muted)]">
            {workouts.length === 0
              ? 'No workouts yet. Log your first workout to see it here.'
              : 'No workouts match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((workout) => {
            const isOpen = expanded === workout.id
            return (
              <div key={workout.id} className="glass rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : workout.id)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-[var(--color-surface-overlay)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent-glow)]">
                      <Dumbbell className="h-5 w-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{workout.name}</p>
                      <p className="text-sm text-[var(--color-muted)]">
                        {format(parseISO(workout.date), 'EEEE, MMM d, yyyy')} · {workout.duration} min
                        {workout.caloriesBurned ? ` · ${workout.caloriesBurned} cal` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden rounded-full bg-[var(--color-surface-overlay)] px-3 py-1 text-xs capitalize text-[var(--color-muted)] sm:inline">
                      {workout.type}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-[var(--color-muted)]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-[var(--color-muted)]" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--color-border)] px-5 pb-5">
                    {workout.notes && (
                      <p className="mt-4 text-sm italic text-[var(--color-muted)]">
                        &ldquo;{workout.notes}&rdquo;
                      </p>
                    )}

                    {workout.exercises.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {workout.exercises.map((ex) => (
                          <div
                            key={ex.id}
                            className="rounded-xl bg-[var(--color-surface-overlay)] p-4"
                          >
                            <p className="mb-2 font-medium text-white">{ex.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {ex.sets.map((set, i) => (
                                <span
                                  key={i}
                                  className="rounded-lg bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]"
                                >
                                  Set {i + 1}: {set.reps ?? '—'} reps
                                  {set.weight ? ` @ ${set.weight}kg` : ''}
                                  {set.distance ? ` · ${set.distance}km` : ''}
                                  {set.duration ? ` · ${set.duration}min` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteWorkout(workout.id)}
                      className="mt-4 flex items-center gap-1.5 text-sm text-[var(--color-danger)] transition-colors hover:underline"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete workout
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
