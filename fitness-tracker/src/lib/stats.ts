import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  differenceInCalendarDays,
  format,
} from 'date-fns'
import type { Workout, Goal } from '../types'

export function getWorkoutsThisWeek(workouts: Workout[]): Workout[] {
  const now = new Date()
  const interval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  return workouts.filter((w) => isWithinInterval(parseISO(w.date), interval))
}

export function getWorkoutsThisMonth(workouts: Workout[]): Workout[] {
  const now = new Date()
  const interval = { start: startOfMonth(now), end: endOfMonth(now) }
  return workouts.filter((w) => isWithinInterval(parseISO(w.date), interval))
}

export function getTotalDuration(workouts: Workout[]): number {
  return workouts.reduce((sum, w) => sum + w.duration, 0)
}

export function getTotalCalories(workouts: Workout[]): number {
  return workouts.reduce((sum, w) => sum + (w.caloriesBurned ?? 0), 0)
}

export function getTotalDistance(workouts: Workout[]): number {
  return workouts.reduce((sum, w) => {
    const exerciseDistance = w.exercises.reduce((es, ex) => {
      return es + ex.sets.reduce((ss, s) => ss + (s.distance ?? 0), 0)
    }, 0)
    return sum + exerciseDistance
  }, 0)
}

export function getStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0

  const uniqueDays = [
    ...new Set(
      workouts.map((w) => format(parseISO(w.date), 'yyyy-MM-dd'))
    ),
  ].sort().reverse()

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(
    new Date(Date.now() - 86400000),
    'yyyy-MM-dd'
  )

  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = differenceInCalendarDays(
      parseISO(uniqueDays[i - 1]),
      parseISO(uniqueDays[i])
    )
    if (diff === 1) streak++
    else break
  }
  return streak
}

export function getWeeklyActivity(workouts: Workout[]): { day: string; minutes: number; workouts: number }[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  return days.map((day, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayWorkouts = workouts.filter(
      (w) => format(parseISO(w.date), 'yyyy-MM-dd') === dateStr
    )
    return {
      day,
      minutes: dayWorkouts.reduce((s, w) => s + w.duration, 0),
      workouts: dayWorkouts.length,
    }
  })
}

export function updateGoalProgress(goals: Goal[], workouts: Workout[]): Goal[] {
  const weekWorkouts = getWorkoutsThisWeek(workouts)
  const monthWorkouts = getWorkoutsThisMonth(workouts)

  return goals.map((goal) => {
    let current = goal.current
    switch (goal.type) {
      case 'workouts_per_week':
        current = weekWorkouts.length
        break
      case 'distance':
        current = getTotalDistance(monthWorkouts)
        break
      case 'duration':
        current = getTotalDuration(monthWorkouts)
        break
      case 'weight':
        break
    }
    return {
      ...goal,
      current,
      completed: current >= goal.target,
    }
  })
}
