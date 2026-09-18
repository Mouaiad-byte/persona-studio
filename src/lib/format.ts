export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (abs >= 1_000) return `${trim(n / 1_000)}K`
  return String(Math.round(n))
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

export function fullNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function usd(n: number, opts: { cents?: boolean } = {}): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  })
}

export function percent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
