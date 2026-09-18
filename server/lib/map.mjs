/**
 * Pure mappers: platform API payloads in, domain objects out.
 *
 * Everything in this file is a function of its arguments — no network, no clock,
 * no filesystem — because this is the layer where a wrong field name silently
 * becomes a wrong number on a dashboard. It is the part worth testing.
 */

/**
 * @typedef {{ t: string, value: number }} MetricPoint
 */

/**
 * Turn a YouTube Analytics `reports.query` response into points for one metric.
 *
 * The API returns `columnHeaders` plus positional `rows`, so the column is found
 * by name rather than by index — the order is not contractual.
 *
 * @param {{ columnHeaders?: Array<{name: string}>, rows?: Array<Array<string|number>> }} response
 * @param {string} metric e.g. 'views'
 * @param {string} [dayColumn='day']
 * @returns {MetricPoint[]} ordered oldest-first
 */
export function analyticsRowsToPoints(response, metric, dayColumn = 'day') {
  const headers = response?.columnHeaders ?? []
  const dayIndex = headers.findIndex((h) => h.name === dayColumn)
  const metricIndex = headers.findIndex((h) => h.name === metric)
  if (dayIndex === -1 || metricIndex === -1) {
    throw new Error(
      `analytics response is missing a column: wanted "${dayColumn}" and "${metric}", got [${headers
        .map((h) => h.name)
        .join(', ')}]`,
    )
  }
  return (response.rows ?? [])
    .map((row) => ({ t: String(row[dayIndex]), value: Number(row[metricIndex]) || 0 }))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
}

/**
 * Index an analytics response keyed by a dimension (e.g. 'video'), so per-item
 * metrics can be looked up when building posts.
 *
 * @param {{ columnHeaders?: Array<{name: string}>, rows?: Array<Array<string|number>> }} response
 * @param {string} keyColumn
 * @returns {Map<string, Record<string, number>>}
 */
export function indexAnalyticsBy(response, keyColumn) {
  const headers = response?.columnHeaders ?? []
  const keyIndex = headers.findIndex((h) => h.name === keyColumn)
  if (keyIndex === -1) {
    throw new Error(`analytics response has no "${keyColumn}" column`)
  }
  const out = new Map()
  for (const row of response.rows ?? []) {
    /** @type {Record<string, number>} */
    const metrics = {}
    headers.forEach((header, i) => {
      if (i !== keyIndex) metrics[header.name] = Number(row[i]) || 0
    })
    out.set(String(row[keyIndex]), metrics)
  }
  return out
}

/**
 * Build a Post from a Data API video plus its analytics row.
 *
 * Analytics wins on views where both are present: `videos.list` statistics are
 * lifetime and cached, the analytics row is the window being reported.
 *
 * @param {{ id: string, snippet?: { title?: string, publishedAt?: string }, statistics?: Record<string, string> }} video
 * @param {Record<string, number> | undefined} analytics
 * @param {{ personaId: string, disclosed: boolean }} context
 */
export function videoToPost(video, analytics, context) {
  const stats = video.statistics ?? {}
  return {
    id: `yt:${video.id}`,
    personaId: context.personaId,
    platform: /** @type {'youtube'} */ ('youtube'),
    publishedAt: (video.snippet?.publishedAt ?? '').slice(0, 10),
    caption: video.snippet?.title ?? '(untitled)',
    views: analytics?.views ?? (Number(stats.viewCount) || 0),
    likes: analytics?.likes ?? (Number(stats.likeCount) || 0),
    comments: analytics?.comments ?? (Number(stats.commentCount) || 0),
    // The APIs expose no save/bookmark metric for YouTube. Zero is the honest
    // value; inventing a proxy here would quietly corrupt the engagement rate.
    saves: 0,
    disclosed: context.disclosed,
  }
}

/**
 * Parse the operator-maintained revenue file.
 *
 * Revenue has no API across these paths, so it is a CSV a human keeps:
 * `date,source,amountUsd,note`. Blank lines and `#` comments are skipped; a
 * malformed row throws with its line number rather than being dropped, because
 * silently losing a brand deal is worse than failing the collect.
 *
 * @param {string} text
 * @returns {Array<{date: string, source: string, amountUsd: number, note?: string}>}
 */
export function parseRevenueCsv(text) {
  const valid = new Set(['brand_deal', 'affiliate', 'creator_fund', 'own_product'])
  const out = []
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw || raw.startsWith('#')) continue
    const [date, source, amount, note] = splitFirst(raw, ',', 3)
    // The header can sit anywhere below the comment block, so it is recognised
    // by its content rather than by its line number.
    if (date.toLowerCase() === 'date') continue
    try {
      assertDate(date)
    } catch (error) {
      throw new Error(`revenue.csv line ${i + 1}: ${/** @type {Error} */ (error).message}`)
    }
    if (!valid.has(source)) {
      throw new Error(
        `revenue.csv line ${i + 1}: source "${source}" must be one of ${[...valid].join(', ')}`,
      )
    }
    const amountUsd = Number(amount)
    if (!Number.isFinite(amountUsd)) {
      throw new Error(`revenue.csv line ${i + 1}: "${amount}" is not a number`)
    }
    out.push(note ? { date, source, amountUsd, note } : { date, source, amountUsd })
  }
  return out
}

export const REVENUE_SOURCES = ['brand_deal', 'affiliate', 'creator_fund', 'own_product']

/**
 * A YYYY-MM-DD date that is also a real calendar day.
 *
 * The shape check alone is not enough: Date.parse("2026-02-31") rolls over to
 * March rather than failing, so a typo would be accepted and then silently land
 * in the wrong window.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function assertDate(value) {
  const date = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`"${date}" is not a YYYY-MM-DD date`)
  }
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`"${date}" is not a real date`)
  }
  return date
}

/**
 * Check one revenue entry and render it as a CSV line.
 *
 * Serialising and parsing live next to each other on purpose: the note runs to
 * the end of the line, so a newline in it would split one entry into two and
 * silently invent a row. It is rejected rather than escaped — there is nowhere
 * useful for a line break to go in a one-line note.
 *
 * @param {{ date?: unknown, source?: unknown, amountUsd?: unknown, note?: unknown }} entry
 * @returns {string} a single line, no trailing newline
 */
export function serializeRevenueRow(entry) {
  const date = assertDate(entry.date)

  const source = String(entry.source ?? '')
  if (!REVENUE_SOURCES.includes(source)) {
    throw new Error(`source "${source}" must be one of ${REVENUE_SOURCES.join(', ')}`)
  }

  const amountUsd = Number(entry.amountUsd)
  if (!Number.isFinite(amountUsd)) throw new Error(`"${entry.amountUsd}" is not a number`)
  if (amountUsd < 0) throw new Error('amount may not be negative')

  const note = String(entry.note ?? '').trim()
  if (/[\r\n]/.test(note)) throw new Error('note may not contain a line break')
  if (note.length > 200) throw new Error('note is longer than 200 characters')

  const amount = amountUsd.toFixed(2)
  return note ? `${date},${source},${amount},${note}` : `${date},${source},${amount}`
}

/**
 * Follower count for an account from a `channels.list` item.
 * `hiddenSubscriberCount` channels report 0, which is the truth available.
 *
 * @param {{ statistics?: { subscriberCount?: string, hiddenSubscriberCount?: boolean } }} channel
 */
export function channelFollowers(channel) {
  if (channel?.statistics?.hiddenSubscriberCount) return 0
  return Number(channel?.statistics?.subscriberCount) || 0
}

/**
 * Split on `sep` at most `limit` times, so the final field keeps its own
 * separators verbatim. Leading fields are trimmed; the remainder is trimmed at
 * its ends only — a note like "one Reel, one carousel" has to survive intact.
 *
 * @param {string} text
 * @param {string} sep
 * @param {number} limit number of splits to perform
 * @returns {string[]} always `limit + 1` entries, padded with empty strings
 */
function splitFirst(text, sep, limit) {
  /** @type {string[]} */
  const out = []
  let rest = text
  for (let i = 0; i < limit; i++) {
    const at = rest.indexOf(sep)
    if (at === -1) {
      out.push(rest.trim())
      rest = ''
      continue
    }
    out.push(rest.slice(0, at).trim())
    rest = rest.slice(at + sep.length)
  }
  out.push(rest.trim())
  return out
}
