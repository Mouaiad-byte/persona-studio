import { useMemo, useState } from 'react'
import { MetricPoint } from '../data/types'
import { areaPath, indexAtX, linePath, makeScale } from '../lib/series'
import { compactNumber, fullNumber, shortDate } from '../lib/format'
import { useSize } from '../lib/useSize'

interface Props {
  points: MetricPoint[]
  /** Names the series, so a single-series chart needs no legend box. */
  seriesLabel: string
  height?: number
  accent?: string
}

/** Left gutter holds the tick labels so they never overlap the plot. */
const PAD = { top: 10, bottom: 22, left: 46 }

/**
 * One series over time: 2px line, low-opacity area, recessive grid, and a
 * crosshair + tooltip on hover (an on-screen chart is interactive by default).
 * A single series carries no legend — the card title names it.
 */
export function TimeSeriesChart({ points, seriesLabel, height = 160, accent = 'var(--accent)' }: Props) {
  const { ref, width } = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const plotWidth = Math.max(width - PAD.left, 1)
  const scale = useMemo(() => makeScale(points, plotWidth, height, PAD), [points, plotWidth, height])
  const baselineY = height - PAD.bottom
  const line = useMemo(() => linePath(points, scale), [points, scale])
  const area = useMemo(() => areaPath(points, scale, baselineY), [points, scale, baselineY])

  const last = points[points.length - 1]
  const active = hover === null ? null : points[hover]
  const gridValues = [scale.min, (scale.min + scale.max) / 2, scale.max]

  const ariaLabel =
    `${seriesLabel} over ${points.length} days. ` +
    `Low ${fullNumber(Math.min(...points.map((p) => p.value)))}, ` +
    `high ${fullNumber(Math.max(...points.map((p) => p.value)))}, ` +
    `latest ${fullNumber(last?.value ?? 0)}.`

  const tooltipLeft =
    hover === null ? 0 : Math.min(Math.max(PAD.left + scale.x(hover), 58), Math.max(width - 58, 58))

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        viewBox={`0 0 ${Math.max(width, 1)} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const scaleFactor = box.width / Math.max(width, 1)
          const xInPlot = (e.clientX - box.left) / scaleFactor - PAD.left
          setHover(indexAtX(xInPlot, plotWidth, points.length))
        }}
      >
        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={width}
              y1={scale.y(v)}
              y2={scale.y(v)}
              stroke="var(--gridline)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              x={PAD.left - 8}
              y={scale.y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={10}
            >
              {compactNumber(v)}
            </text>
          </g>
        ))}

        <g transform={`translate(${PAD.left},0)`}>
          <path d={area} fill={accent} fillOpacity={0.12} />
          <path d={line} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {last && (
            <circle
              cx={scale.x(points.length - 1)}
              cy={scale.y(last.value)}
              r={4.5}
              fill={accent}
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          )}

          {hover !== null && active && (
            <g>
              <line
                x1={scale.x(hover)}
                x2={scale.x(hover)}
                y1={PAD.top}
                y2={baselineY}
                stroke="var(--baseline)"
                strokeWidth={1}
              />
              <circle
                cx={scale.x(hover)}
                cy={scale.y(active.value)}
                r={4.5}
                fill={accent}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            </g>
          )}
        </g>

        <line x1={PAD.left} x2={width} y1={baselineY} y2={baselineY} stroke="var(--baseline)" strokeWidth={1} />

        {points.length > 2 && (
          <>
            <text x={PAD.left} y={height - 6} fill="var(--text-muted)" fontSize={10}>
              {shortDate(points[0].t)}
            </text>
            <text x={width} y={height - 6} textAnchor="end" fill="var(--text-muted)" fontSize={10}>
              {shortDate(points[points.length - 1].t)}
            </text>
          </>
        )}
      </svg>

      {hover !== null && active && (
        <div className="tooltip" style={{ left: tooltipLeft, top: 0, transform: 'translateX(-50%)' }}>
          <div className="tt-label">{shortDate(active.t)}</div>
          <div className="mono">
            {fullNumber(active.value)} <span className="tt-label">{seriesLabel.toLowerCase()}</span>
          </div>
        </div>
      )}
    </div>
  )
}
