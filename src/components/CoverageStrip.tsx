import { Coverage, PLATFORM_LABEL } from '../data/types'

const STATUS_COLOR: Record<Coverage['status'], string> = {
  live: 'var(--good)',
  manual: 'var(--warning)',
  absent: 'var(--text-muted)',
}

const STATUS_LABEL: Record<Coverage['status'], string> = {
  live: 'live',
  manual: 'stored',
  absent: 'no collector',
}

/**
 * Which platforms these numbers actually cover. A snapshot is usually part
 * real — one collector running, two platforms reading zero — and a zero that
 * means "not collected" has to be distinguishable from a zero that means zero.
 */
export function CoverageStrip({ coverage }: { coverage: Coverage[] }) {
  return (
    <div className="row small" style={{ gap: 14, flexWrap: 'wrap' }}>
      {coverage.map((entry) => (
        <span key={entry.platform} className="pill" title={entry.note}>
          <span className="dot" style={{ background: STATUS_COLOR[entry.status] }} />
          {PLATFORM_LABEL[entry.platform]} · {STATUS_LABEL[entry.status]}
        </span>
      ))}
    </div>
  )
}
