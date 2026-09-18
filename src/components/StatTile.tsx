import { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  sub?: ReactNode
  /** Signed change as a fraction; null when there is not enough history to say. */
  change?: number | null
  /** Set false where a rise is not good news (cost, review hours). */
  riseIsGood?: boolean
}

export function StatTile({ label, value, sub, change, riseIsGood = true }: Props) {
  const showChange = typeof change === 'number' && Number.isFinite(change)
  const good = showChange && (change! >= 0) === riseIsGood
  return (
    <div className="card">
      <div className="tile-label">{label}</div>
      <div className="tile-value mono">{value}</div>
      <div className="tile-sub">
        {/* Either a comparison or the reason there isn't one — never both. */}
        {change === null ? (
          <span className="muted">no prior period</span>
        ) : (
          <>
            {showChange && (
              <span className={good ? 'delta-up' : 'delta-down'}>
                {change! >= 0 ? '▲' : '▼'} {Math.abs(change! * 100).toFixed(1)}%
              </span>
            )}
            {sub && <span className="muted">{sub}</span>}
          </>
        )}
      </div>
    </div>
  )
}
