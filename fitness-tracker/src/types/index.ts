export type WorkoutType = 'strength' | 'cardio' | 'flexibility' | 'sports' | 'other'

export interface ExerciseSet {
  reps?: number
  weight?: number
  duration?: number
  distance?: number
}

export interface Exercise {
  id: string
  name: string
  sets: ExerciseSet[]
  notes?: string
}

export interface Workout {
  id: string
  name: string
  type: WorkoutType
  date: string
  duration: number
  exercises: Exercise[]
  notes?: string
  caloriesBurned?: number
}

export interface BodyMetric {
  id: string
  date: string
  weight?: number
  bodyFat?: number
  muscleMass?: number
  notes?: string
}

export type GoalType = 'workouts_per_week' | 'weight' | 'distance' | 'duration'

export interface Goal {
  id: string
  title: string
  type: GoalType
  target: number
  current: number
  unit: string
  deadline?: string
  completed: boolean
}

export interface AppState {
  workouts: Workout[]
  metrics: BodyMetric[]
  goals: Goal[]
}

export const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
]

export const PRESET_EXERCISES = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Pull-ups',
  'Running',
  'Cycling',
  'Swimming',
  'Yoga',
  'Plank',
  'Lunges',
  'Bicep Curls',
  'Tricep Dips',
  'Rowing',
]
