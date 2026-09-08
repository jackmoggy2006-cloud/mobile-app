import { formatRate, formatResin } from '../lib/format'

interface Props {
  resin: number
  rate: number
  tapPower: number
  workers: number
  sparks: number
  rebirths: number
  zones: number
  toast: string | null
  onReset: () => void
}

export function Hud({
  resin,
  rate,
  tapPower,
  workers,
  sparks,
  rebirths,
  zones,
  toast,
  onReset,
}: Props) {
  return (
    <header className="hud">
      <div className="brand-block">
        <p className="brand">Kindlewood</p>
        <p className="tagline">
          Expand areas. Hire workers. Rebirth for Amber Sparks.
        </p>
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
        <div className="meter">
          <span className="meter-label">Workers</span>
          <span className="meter-value">{workers}</span>
        </div>
        <div className="meter spark-meter">
          <span className="meter-label">Sparks</span>
          <span className="meter-value">{sparks}</span>
        </div>
        <div className="meter">
          <span className="meter-label">Rebirths</span>
          <span className="meter-value">{rebirths}</span>
        </div>
        <div className="meter">
          <span className="meter-label">Areas</span>
          <span className="meter-value">{zones}/6</span>
        </div>
      </div>
      {toast ? <p className="toast" role="status">{toast}</p> : null}
      <button type="button" className="reset-btn" onClick={onReset}>
        Reset save
      </button>
    </header>
  )
}
