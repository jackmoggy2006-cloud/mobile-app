import { formatRate, formatResin } from '../lib/format'

interface Props {
  resin: number
  rate: number
  tapPower: number
  toast: string | null
  onReset: () => void
}

export function Hud({ resin, rate, tapPower, toast, onReset }: Props) {
  return (
    <header className="hud">
      <div className="brand-block">
        <p className="brand">Kindlewood</p>
        <p className="tagline">Tap the grove. Grow forever.</p>
      </div>
      <div className="meters">
        <div className="meter resin-meter">
          <span className="meter-label">Resin</span>
          <span className="meter-value">{formatResin(resin)}</span>
        </div>
        <div className="meter">
          <span className="meter-label">Income</span>
          <span className="meter-value">{formatRate(rate)}</span>
        </div>
        <div className="meter">
          <span className="meter-label">Tap</span>
          <span className="meter-value">+{formatResin(tapPower)}</span>
        </div>
      </div>
      {toast ? <p className="toast" role="status">{toast}</p> : null}
      <button type="button" className="reset-btn" onClick={onReset}>
        Reset save
      </button>
    </header>
  )
}
