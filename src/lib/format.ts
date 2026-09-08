const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']

export function formatResin(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const sign = value < 0 ? '-' : ''
  let n = Math.abs(value)
  if (n < 1000) {
    return sign + (n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString())
  }
  let idx = 0
  while (n >= 1000 && idx < SUFFIXES.length - 1) {
    n /= 1000
    idx += 1
  }
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2
  return `${sign}${n.toFixed(digits)}${SUFFIXES[idx]}`
}

export function formatRate(value: number): string {
  return `${formatResin(value)}/s`
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
