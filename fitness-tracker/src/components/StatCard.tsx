interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon: React.ReactNode
  accent?: boolean
}

export function StatCard({ label, value, subtext, icon, accent }: StatCardProps) {
  return (
    <div className="glass rounded-2xl p-5 transition-transform hover:scale-[1.02]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-[var(--color-muted)]">{label}</span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            accent ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent)]' : 'bg-[var(--color-surface-overlay)] text-[var(--color-muted)]'
          }`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${accent ? 'gradient-text' : 'text-white'}`}>
        {value}
      </p>
      {subtext && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">{subtext}</p>
      )}
    </div>
  )
}
