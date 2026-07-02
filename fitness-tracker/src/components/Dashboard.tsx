import { format, parseISO } from 'date-fns'
import { Flame, Clock, Dumbbell, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useFitness } from '../context/FitnessContext'
import { StatCard } from './StatCard'
import {
  getWorkoutsThisWeek,
  getTotalDuration,
  getTotalCalories,
  getStreak,
  getWeeklyActivity,
} from '../lib/stats'

export default function Dashboard() {
  const { workouts, goals } = useFitness()
  const weekWorkouts = getWorkoutsThisWeek(workouts)
  const weeklyData = getWeeklyActivity(workouts)
  const streak = getStreak(workouts)
  const activeGoals = goals.filter((g) => !g.completed)

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="mt-1 text-[var(--color-muted)]">
          Your fitness overview for this week
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Workouts This Week"
          value={weekWorkouts.length}
          subtext="Keep the momentum going"
          icon={<Dumbbell className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Total Minutes"
          value={getTotalDuration(weekWorkouts)}
          subtext="Active time this week"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Calories Burned"
          value={getTotalCalories(weekWorkouts)}
          subtext="Estimated this week"
          icon={<Flame className="h-4 w-4" />}
        />
        <StatCard
          label="Current Streak"
          value={`${streak} day${streak !== 1 ? 's' : ''}`}
          subtext={streak > 0 ? 'On fire!' : 'Start today!'}
          icon={<TrendingUp className="h-4 w-4" />}
          accent
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-white">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a2332',
                  border: '1px solid #2d3a4f',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                }}
                formatter={(value) => [`${value} min`, 'Duration']}
              />
              <Bar dataKey="minutes" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Active Goals</h3>
          {activeGoals.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              All goals completed! Set new ones to keep pushing.
            </p>
          ) : (
            <div className="space-y-4">
              {activeGoals.slice(0, 3).map((goal) => {
                const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))
                return (
                  <div key={goal.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-white">{goal.title}</span>
                      <span className="text-[var(--color-muted)]">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Recent Workouts</h3>
        {workouts.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No workouts logged yet. Head to Log Workout to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {workouts.slice(0, 5).map((workout) => (
              <div
                key={workout.id}
                className="flex items-center justify-between rounded-xl bg-[var(--color-surface-overlay)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent-glow)]">
                    <Dumbbell className="h-4 w-4 text-[var(--color-accent)]" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">{workout.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {format(parseISO(workout.date), 'MMM d, yyyy')} · {workout.duration} min
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs capitalize text-[var(--color-muted)]">
                  {workout.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
