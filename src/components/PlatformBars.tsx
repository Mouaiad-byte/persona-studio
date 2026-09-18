import { useState } from 'react'
import { Platform, PLATFORM_COLOR_VAR, PLATFORM_LABEL } from '../data/types'
import { compactNumber, fullNumber, percent } from '../lib/format'

interface Row {
  platform: Platform
  views: number
}

/**
 * Magnitude by category: horizontal bars, direct-labelled, sorted by value.
 * Bars are plain elements rather than SVG so the 4px rounded data-end keeps its
 * radius at any width. Direct labels are also what keeps the light-mode steps
 * readable where they sit below 3:1 against the surface.
 */
export function PlatformBars({ rows }: { rows: Row[] }) {
  const [hover, setHover] = useState<Platform | null>(null)
  const total = rows.reduce((s, r) => s + r.views, 0) || 1
  const max = Math.max(...rows.map((r) => r.views), 1)
  const sorted = [...rows].sort((a, b) => b.views - a.views)

  return (
    <div className="stack" style={{ gap: 12 }}>
      {sorted.map((row) => (
        <div
          key={row.platform}
          onMouseEnter={() => setHover(row.platform)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
            <span className="row" style={{ gap: 6 }}>
              <span className="swatch" style={{ background: PLATFORM_COLOR_VAR[row.platform] }} />
              <span style={{ color: 'var(--text-primary)' }}>{PLATFORM_LABEL[row.platform]}</span>
            </span>
            <span className="mono muted">
              {hover === row.platform ? fullNumber(row.views) : compactNumber(row.views)} ·{' '}
              {percent(row.views / total, 0)}
            </span>
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 8 }}>
            <div
              style={{
                // A zero draws nothing. A minimum-width sliver would imply data.
                width: row.views === 0 ? '0%' : `${Math.max((row.views / max) * 100, 1)}%`,
                height: 8,
                borderRadius: 4,
                background: PLATFORM_COLOR_VAR[row.platform],
                opacity: hover && hover !== row.platform ? 0.55 : 1,
                transition: 'opacity 120ms ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
