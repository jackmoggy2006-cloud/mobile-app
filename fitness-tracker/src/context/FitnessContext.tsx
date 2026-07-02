import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Workout, BodyMetric, Goal } from '../types'
import { loadState, saveState, generateId } from '../lib/storage'
import { updateGoalProgress } from '../lib/stats'

interface FitnessContextValue {
  workouts: Workout[]
  metrics: BodyMetric[]
  goals: Goal[]
  addWorkout: (workout: Omit<Workout, 'id'>) => void
  deleteWorkout: (id: string) => void
  addMetric: (metric: Omit<BodyMetric, 'id'>) => void
  deleteMetric: (id: string) => void
  addGoal: (goal: Omit<Goal, 'id' | 'current' | 'completed'>) => void
  deleteGoal: (id: string) => void
  toggleGoalComplete: (id: string) => void
}

const FitnessContext = createContext<FitnessContextValue | null>(null)

export function FitnessProvider({ children }: { children: ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const state = loadState()
    setWorkouts(state.workouts)
    setMetrics(state.metrics)
    setGoals(updateGoalProgress(state.goals, state.workouts))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    setGoals((prev) => updateGoalProgress(prev, workouts))
  }, [workouts, loaded])

  useEffect(() => {
    if (!loaded) return
    saveState({ workouts, metrics, goals })
  }, [workouts, metrics, goals, loaded])

  const addWorkout = useCallback((workout: Omit<Workout, 'id'>) => {
    setWorkouts((prev) => [{ ...workout, id: generateId() }, ...prev])
  }, [])

  const deleteWorkout = useCallback((id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const addMetric = useCallback((metric: Omit<BodyMetric, 'id'>) => {
    setMetrics((prev) => [{ ...metric, id: generateId() }, ...prev])
  }, [])

  const deleteMetric = useCallback((id: string) => {
    setMetrics((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const addGoal = useCallback((goal: Omit<Goal, 'id' | 'current' | 'completed'>) => {
    setGoals((prev) => [
      ...prev,
      { ...goal, id: generateId(), current: 0, completed: false },
    ])
  }, [])

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const toggleGoalComplete = useCallback((id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g))
    )
  }, [])

  return (
    <FitnessContext.Provider
      value={{
        workouts,
        metrics,
        goals,
        addWorkout,
        deleteWorkout,
        addMetric,
        deleteMetric,
        addGoal,
        deleteGoal,
        toggleGoalComplete,
      }}
    >
      {children}
    </FitnessContext.Provider>
  )
}

export function useFitness() {
  const ctx = useContext(FitnessContext)
  if (!ctx) throw new Error('useFitness must be used within FitnessProvider')
  return ctx
}
