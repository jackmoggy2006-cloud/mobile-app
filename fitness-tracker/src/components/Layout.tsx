import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Dumbbell,
  PlusCircle,
  Scale,
  Target,
  Activity,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/log', icon: PlusCircle, label: 'Log Workout' },
  { to: '/workouts', icon: Dumbbell, label: 'Workouts' },
  { to: '/metrics', icon: Scale, label: 'Metrics' },
  { to: '/goals', icon: Target, label: 'Goals' },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-raised)] md:flex">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-glow)]">
            <Activity className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">FitTrack</h1>
            <p className="text-xs text-[var(--color-muted)]">Fitness Tracker</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--color-border)] p-4">
          <p className="text-center text-xs text-[var(--color-muted)]">
            Stay consistent. Stay strong.
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col md:ml-64">
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] md:hidden">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="truncate px-1">{label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
