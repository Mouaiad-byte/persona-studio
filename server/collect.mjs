import { analyticsByVideo, analyticsDaily, analyticsRevenue, listChannels, listVideos } from './google/youtube.mjs'
import { analyticsRowsToPoints, channelFollowers, indexAnalyticsBy, videoToPost } from './lib/map.mjs'
import { addDays, mergeDaily, pruneBefore } from './lib/history.mjs'
import { readJson, writeJson } from './store.mjs'

const KEEP_DAYS = 120
const COLLECTED = 'collected.json'

/** @returns {string} today in UTC, YYYY-MM-DD */
export function today() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * One collection run: read the persona config, ask YouTube for the window, and
 * merge the result into the local store.
 *
 * Failures are per-channel and reported rather than thrown, so one revoked
 * channel does not cost you the other two. The run's report is what the
 * `/api/collect` response and the CLI print.
 *
 * @param {{ windowDays?: number, endDate?: string }} [options]
 */
export async function collect(options = {}) {
  const endDate = options.endDate ?? today()
  const days = options.windowDays ?? 30
  const startDate = addDays(endDate, -(days - 1))

  const personas = readJson('personas.json', [])
  const stored = readJson(COLLECTED, { followers: {}, viewsByPlatform: {}, posts: [], payouts: [] })

  /** @type {Array<{personaId: string, channelId: string}>} */
  const targets = []
  for (const persona of personas) {
    for (const account of persona.accounts ?? []) {
      if (account.platform === 'youtube' && account.externalId) {
        targets.push({ personaId: persona.id, channelId: account.externalId })
      }
    }
  }

  const report = {
    endDate,
    startDate,
    channels: targets.length,
    collected: /** @type {string[]} */ ([]),
    failed: /** @type {Array<{channelId: string, error: string}>} */ ([]),
    warnings: /** @type {string[]} */ ([]),
  }

  if (targets.length === 0) {
    report.warnings.push(
      'No YouTube accounts with an externalId in personas.json — nothing to collect. Add the channel id (UC…) as `externalId`.',
    )
    return { report, snapshotReady: false }
  }

  const channelResponse = await listChannels(targets.map((t) => t.channelId))
  const channelById = new Map((channelResponse.items ?? []).map((item) => [item.id, item]))

  /** @type {Record<string, number>} */
  const followers = { ...stored.followers }
  /** @type {Array<{t: string, value: number}>} */
  let youtubeViews = []
  /** @type {Array<any>} */
  const posts = []
  /** @type {Array<{date: string, amountUsd: number}>} */
  const payouts = []

  for (const target of targets) {
    const persona = personas.find((p) => p.id === target.personaId)
    const disclosed = Boolean(persona?.disclosure?.perPostLabel)

    try {
      const channel = channelById.get(target.channelId)
      if (!channel) {
        throw new Error('channel not returned by channels.list — wrong id, or not visible to this account')
      }
      followers[target.channelId] = channelFollowers(channel)

      const daily = await analyticsDaily({ channelId: target.channelId, startDate, endDate })
      youtubeViews = mergeSum(youtubeViews, analyticsRowsToPoints(daily, 'views'))

      const perVideo = await analyticsByVideo({ channelId: target.channelId, startDate, endDate })
      const metricsByVideo = indexAnalyticsBy(perVideo, 'video')
      const videoIds = [...metricsByVideo.keys()]
      if (videoIds.length > 0) {
        const videos = await listVideos(videoIds)
        for (const video of videos.items ?? []) {
          posts.push(videoToPost(video, metricsByVideo.get(video.id), { personaId: target.personaId, disclosed }))
        }
      }

      report.collected.push(target.channelId)
    } catch (error) {
      report.failed.push({ channelId: target.channelId, error: String(/** @type {Error} */ (error).message) })
      continue
    }

    // Payout data is optional and commonly unavailable; its absence is a note,
    // not a failure. The revenue CSV is the source of record either way.
    try {
      const revenue = await analyticsRevenue({ channelId: target.channelId, startDate, endDate })
      for (const point of analyticsRowsToPoints(revenue, 'estimatedRevenue')) {
        if (point.value > 0) payouts.push({ date: point.t, amountUsd: point.value })
      }
    } catch (error) {
      report.warnings.push(
        `no payout data for ${target.channelId} (${String(/** @type {Error} */ (error).message).slice(0, 120)})`,
      )
    }
  }

  const mergedViews = pruneBefore(
    mergeDaily(stored.viewsByPlatform?.youtube ?? [], youtubeViews),
    KEEP_DAYS,
    endDate,
  )

  writeJson(COLLECTED, {
    updatedAt: new Date().toISOString(),
    followers,
    viewsByPlatform: { ...stored.viewsByPlatform, youtube: mergedViews },
    // Posts and payouts describe the window, so the fresh set replaces the old
    // one rather than accumulating duplicates of the same video.
    posts: posts.length > 0 ? posts : stored.posts,
    payouts,
  })

  return { report, snapshotReady: report.collected.length > 0 }
}

/**
 * Add a channel's daily views into a running platform total.
 * @param {Array<{t: string, value: number}>} into
 * @param {Array<{t: string, value: number}>} points
 */
function mergeSum(into, points) {
  const byDate = new Map(into.map((p) => [p.t, p.value]))
  for (const point of points) {
    byDate.set(point.t, (byDate.get(point.t) ?? 0) + point.value)
  }
  return [...byDate.entries()]
    .map(([t, value]) => ({ t, value }))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
}
