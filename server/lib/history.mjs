/**
 * Daily metric history.
 *
 * Platform APIs are thin on history and rate-limited, so the collector writes
 * each day's figures into a local store and the console reads from that. These
 * functions are the merge and window rules, kept pure and tested: an off-by-one
 * here shows up as a wrong "vs prior 7d" and nobody notices.
 */

/**
 * @typedef {{ t: string, value: number }} MetricPoint
 */

/**
 * Merge freshly collected points over stored ones.
 *
 * Incoming points win on a shared date — the platform revises recent days for a
 * while after the fact, so a later collect is the better number. Result is
 * de-duplicated and ordered oldest-first.
 *
 * @param {MetricPoint[]} stored
 * @param {MetricPoint[]} incoming
 * @returns {MetricPoint[]}
 */
export function mergeDaily(stored, incoming) {
  const byDate = new Map()
  for (const point of stored) byDate.set(point.t, point.value)
  for (const point of incoming) byDate.set(point.t, point.value)
  return [...byDate.entries()]
    .map(([t, value]) => ({ t, value }))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
}

/**
 * Add `days` to an ISO date string (negative to subtract), in UTC.
 * @param {string} iso YYYY-MM-DD
 * @param {number} days
 */
export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * A continuous `count`-day window ending on `endDate`, with missing days filled
 * at zero.
 *
 * The fill is the point: analytics returns no row for a day with no views, and
 * a chart that silently skips those days compresses time and flatters the
 * trend. A zero-view day is a real zero.
 *
 * @param {MetricPoint[]} points
 * @param {number} count
 * @param {string} endDate YYYY-MM-DD, inclusive
 * @returns {MetricPoint[]}
 */
export function windowDays(points, count, endDate) {
  const byDate = new Map(points.map((p) => [p.t, p.value]))
  /** @type {MetricPoint[]} */
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const t = addDays(endDate, -i)
    out.push({ t, value: byDate.get(t) ?? 0 })
  }
  return out
}

/**
 * Sum several same-dated series into one. Inputs must already be windowed to
 * the same dates; mismatched dates throw rather than producing a total that
 * quietly means nothing.
 *
 * @param {MetricPoint[][]} series
 * @returns {MetricPoint[]}
 */
export function sumSeries(series) {
  const present = series.filter((s) => s.length > 0)
  if (present.length === 0) return []
  const [first, ...rest] = present
  for (const other of rest) {
    if (other.length !== first.length || other.some((p, i) => p.t !== first[i].t)) {
      throw new Error('sumSeries: series are not windowed to the same dates')
    }
  }
  return first.map((point, i) => ({
    t: point.t,
    value: present.reduce((sum, s) => sum + s[i].value, 0),
  }))
}

/**
 * Drop history older than `keepDays` before `endDate`, so the store does not
 * grow without bound.
 *
 * @param {MetricPoint[]} points
 * @param {number} keepDays
 * @param {string} endDate
 */
export function pruneBefore(points, keepDays, endDate) {
  const cutoff = addDays(endDate, -(keepDays - 1))
  return points.filter((p) => p.t >= cutoff)
}
