import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Save } from 'lucide-react'
import { useFitness } from '../context/FitnessContext'
import { generateId } from '../lib/storage'
import { WORKOUT_TYPES, PRESET_EXERCISES, type Exercise, type ExerciseSet, type WorkoutType } from '../types'

function emptySet(): ExerciseSet {
  return { reps: 10, weight: 0 }
}

function emptyExercise(): Exercise {
  return { id: generateId(), name: '', sets: [emptySet()] }
}

export default function LogWorkout() {
  const navigate = useNavigate()
  const { addWorkout } = useFitness()

  const [name, setName] = useState('')
  const [type, setType] = useState<WorkoutType>('strength')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState(45)
  const [calories, setCalories] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([emptyExercise()])

  const updateExercise = (idx: number, field: keyof Exercise, value: string) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex))
    )
  }

  const updateSet = (exIdx: number, setIdx: number, field: keyof ExerciseSet, value: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)),
            }
          : ex
      )
    )
  }

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, emptySet()] } : ex
      )
    )
  }

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
      )
    )
  }

  const addExercise = () => setExercises((prev) => [...prev, emptyExercise()])

  const removeExercise = (idx: number) => {
    if (exercises.length > 1) {
      setExercises((prev) => prev.filter((_, i) => i !== idx))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    addWorkout({
      name: name.trim(),
      type,
      date: new Date(date).toISOString(),
      duration,
      exercises: exercises.filter((ex) => ex.name.trim()),
      notes: notes.trim() || undefined,
      caloriesBurned: calories !== '' ? calories : undefined,
    })

    navigate('/workouts')
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-4 py-2.5 text-white placeholder-[var(--color-muted)] outline-none transition-colors focus:border-[var(--color-accent)]'

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20 md:pb-0">
      <div>
        <h2 className="text-2xl font-bold text-white">Log Workout</h2>
        <p className="mt-1 text-[var(--color-muted)]">Record your training session</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Workout Details</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Name</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Upper Body Day"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Type</label>
              <select
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
              >
                {WORKOUT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Date</label>
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Duration (min)</label>
              <input
                type="number"
                className={inputClass}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={1}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Calories (optional)</label>
              <input
                type="number"
                className={inputClass}
                value={calories}
                onChange={(e) => setCalories(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Estimated calories"
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Notes</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Exercises</h3>
            <button
              type="button"
              onClick={addExercise}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent-glow)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add Exercise
            </button>
          </div>

          {exercises.map((exercise, exIdx) => (
            <div key={exercise.id} className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm text-[var(--color-muted)]">Exercise</label>
                  <input
                    className={inputClass}
                    list="exercise-presets"
                    value={exercise.name}
                    onChange={(e) => updateExercise(exIdx, 'name', e.target.value)}
                    placeholder="Exercise name"
                  />
                  <datalist id="exercise-presets">
                    {PRESET_EXERCISES.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExercise(exIdx)}
                    className="mt-7 rounded-lg p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 text-xs text-[var(--color-muted)]">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Weight (kg)</span>
                  <span />
                </div>
                {exercise.sets.map((set, setIdx) => (
                  <div key={setIdx} className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 items-center">
                    <span className="text-sm text-white">{setIdx + 1}</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={set.reps ?? ''}
                      onChange={(e) => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))}
                      min={0}
                    />
                    <input
                      type="number"
                      className={inputClass}
                      value={set.weight ?? ''}
                      onChange={(e) => updateSet(exIdx, setIdx, 'weight', Number(e.target.value))}
                      min={0}
                      step={0.5}
                    />
                    <button
                      type="button"
                      onClick={() => removeSet(exIdx, setIdx)}
                      className="rounded-lg p-1.5 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                      disabled={exercise.sets.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSet(exIdx)}
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  + Add set
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] py-3.5 text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          <Save className="h-5 w-5" />
          Save Workout
        </button>
      </form>
    </div>
  )
}
