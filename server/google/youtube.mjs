import { accessToken } from './oauth.mjs'

/**
 * Thin wrappers over the two YouTube APIs. Deliberately thin: everything that
 * interprets a response lives in ../lib/map.mjs where it can be tested.
 *
 * - Data API v3 — channel statistics, uploads, video titles.
 * - Analytics API v2 — per-day and per-video metrics for the window.
 */

const DATA_API = 'https://www.googleapis.com/youtube/v3'
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2'

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function get(url) {
  const token = await accessToken()
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  const text = await response.text()
  if (!response.ok) {
    // Google's error bodies name the actual problem (scope, quota, bad id).
    // Passing them through beats a generic failure message.
    throw new Error(`${new URL(url).pathname} returned ${response.status}: ${text.slice(0, 500)}`)
  }
  return JSON.parse(text)
}

/**
 * Channel statistics and the uploads playlist id.
 * @param {string[]} channelIds
 */
export async function listChannels(channelIds) {
  if (channelIds.length === 0) return { items: [] }
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: channelIds.join(','),
    maxResults: '50',
  })
  return get(`${DATA_API}/channels?${params}`)
}

/**
 * Recent uploads for a channel, newest first.
 * @param {string} uploadsPlaylistId
 * @param {number} [limit=50]
 */
export async function listUploads(uploadsPlaylistId, limit = 50) {
  const params = new URLSearchParams({
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(Math.min(limit, 50)),
  })
  return get(`${DATA_API}/playlistItems?${params}`)
}

/** @param {string[]} videoIds */
export async function listVideos(videoIds) {
  if (videoIds.length === 0) return { items: [] }
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: videoIds.slice(0, 50).join(','),
  })
  return get(`${DATA_API}/videos?${params}`)
}

/**
 * Per-day metrics for one channel.
 *
 * `ids=channel==<id>` requires the authorised account to own the channel;
 * `channel==MINE` works when it is the only one. Both are the owner's view —
 * there is no public analytics API.
 *
 * @param {object} args
 * @param {string} args.channelId
 * @param {string} args.startDate YYYY-MM-DD
 * @param {string} args.endDate YYYY-MM-DD
 * @param {string[]} [args.metrics]
 */
export async function analyticsDaily({ channelId, startDate, endDate, metrics = ['views', 'likes', 'comments'] }) {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: metrics.join(','),
    dimensions: 'day',
    sort: 'day',
  })
  return get(`${ANALYTICS_API}/reports?${params}`)
}

/**
 * Per-video metrics for the window, highest views first.
 * @param {object} args
 * @param {string} args.channelId
 * @param {string} args.startDate
 * @param {string} args.endDate
 * @param {number} [args.limit=25]
 */
export async function analyticsByVideo({ channelId, startDate, endDate, limit = 25 }) {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: 'views,likes,comments',
    dimensions: 'video',
    sort: '-views',
    maxResults: String(limit),
  })
  return get(`${ANALYTICS_API}/reports?${params}`)
}

/**
 * Estimated revenue per day. Needs the monetary scope and a monetised channel;
 * anything else throws, which the collector treats as "no payout data" rather
 * than as a failed run.
 *
 * @param {object} args
 * @param {string} args.channelId
 * @param {string} args.startDate
 * @param {string} args.endDate
 */
export async function analyticsRevenue({ channelId, startDate, endDate }) {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: 'estimatedRevenue',
    dimensions: 'day',
    sort: 'day',
  })
  return get(`${ANALYTICS_API}/reports?${params}`)
}
