import { RevenueEntry, RevenueSource, REVENUE_LABEL } from '../data/types'
import { usd } from '../lib/format'

/**
 * Revenue by source. One hue, scaled by magnitude — these rows are amounts, not
 * identities, so they do not spend categorical slots.
 */
export function RevenuePanel({ entries }: { entries: RevenueEntry[] }) {
  const totals = new Map<RevenueSource, number>()
  for (const e of entries) totals.set(e.source, (totals.get(e.source) ?? 0) + e.amountUsd)

  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...rows.map(([, v]) => v), 1)
  const total = rows.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map(([source, amount]) => (
        <div key={source}>
          <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: 'var(--text-primary)' }}>{REVENUE_LABEL[source]}</span>
            <span className="mono muted">{usd(amount, { cents: true })}</span>
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 8 }}>
            <div
              style={{
                width: `${Math.max((amount / max) * 100, 1)}%`,
                height: 8,
                borderRadius: 4,
                background: 'var(--series-1)',
              }}
            />
          </div>
        </div>
      ))}
      <div className="row small" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>
        <span className="muted">Total · 30 days</span>
        <span className="mono" style={{ fontWeight: 600 }}>{usd(total, { cents: true })}</span>
      </div>
    </div>
  )
}
