/**
 * Assemble the Snapshot the console reads, from collected history plus the
 * operator-maintained files. Pure: the caller supplies `now`.
 */

import { sumSeries, windowDays } from './history.mjs'

const PLATFORMS = ['instagram', 'tiktok', 'youtube']
const WINDOW = 30

/**
 * @param {object} args
 * @param {Array<any>} args.personas
 * @param {Array<any>} args.queue
 * @param {Array<any>} args.revenue
 * @param {Array<any>} args.posts
 * @param {Record<string, Array<{t: string, value: number}>>} args.viewsByPlatform history per platform
 * @param {string} args.today YYYY-MM-DD, inclusive end of the window
 * @param {string[]} args.livePlatforms platforms the collector actually reached
 * @returns {any} Snapshot
 */
export function buildSnapshot({ personas, queue, revenue, posts, viewsByPlatform, today, livePlatforms }) {
  /** @type {Record<string, Array<{t: string, value: number}>>} */
  const windowed = {}
  for (const platform of PLATFORMS) {
    windowed[platform] = windowDays(viewsByPlatform[platform] ?? [], WINDOW, today)
  }

  const viewsDaily = sumSeries(PLATFORMS.map((p) => windowed[p]))
  const windowStart = windowed.youtube[0]?.t ?? today

  return {
    personas,
    queue,
    posts: posts.filter((post) => post.publishedAt >= windowStart),
    revenue: revenue.filter((entry) => entry.date >= windowStart),
    viewsDaily,
    viewsByPlatform: windowed,
    generatedAt: new Date(`${today}T00:00:00Z`).toISOString(),
    // Real numbers, however partial. `coverage` is what carries the partiality.
    isMock: false,
    coverage: PLATFORMS.map((platform) => coverageFor(platform, livePlatforms, windowed[platform])),
  }
}

/**
 * Overlay collected follower counts onto the operator's persona config.
 *
 * `personas.json` is hand-authored — niches, handles, disclosure — and stays
 * that way; follower counts are collected and belong to the snapshot, not to
 * the config file. Keeping them separate means a collect never rewrites
 * something a human wrote.
 *
 * @param {Array<any>} personas
 * @param {Record<string, number>} followersByExternalId
 * @returns {Array<any>}
 */
export function applyFollowers(personas, followersByExternalId) {
  return personas.map((persona) => ({
    ...persona,
    accounts: (persona.accounts ?? []).map((account) => {
      const collected = account.externalId ? followersByExternalId[account.externalId] : undefined
      return collected === undefined ? account : { ...account, followers: collected }
    }),
  }))
}

/**
 * @param {string} platform
 * @param {string[]} livePlatforms
 * @param {Array<{value: number}>} series
 */
function coverageFor(platform, livePlatforms, series) {
  if (livePlatforms.includes(platform)) {
    return { platform, status: 'live', note: 'collected from the platform API' }
  }
  const hasData = series.some((p) => p.value > 0)
  if (hasData) {
    return { platform, status: 'manual', note: 'from the local history file, not collected this run' }
  }
  return {
    platform,
    status: 'absent',
    note: 'no collector configured — figures for this platform read zero, not unknown',
  }
}
