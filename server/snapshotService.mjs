import { parseRevenueCsv } from './lib/map.mjs'
import { applyFollowers, buildSnapshot } from './lib/snapshot.mjs'
import { readJson, readText } from './store.mjs'
import { today } from './collect.mjs'
import { decorateQueue } from './assetStore.mjs'

/**
 * Assemble the current Snapshot from whatever is on disk. Reads only — the
 * collector writes, this serves. That split means a browser refresh never
 * spends API quota.
 */
export function currentSnapshot() {
  const personas = readJson('personas.json', [])
  const queue = decorateQueue(readJson('queue.json', []))
  const collected = readJson('collected.json', {
    followers: {},
    viewsByPlatform: {},
    posts: [],
    payouts: [],
    updatedAt: null,
  })

  const manualRevenue = parseRevenueCsv(readText('revenue.csv', ''))
  const payoutRevenue = (collected.payouts ?? []).map((payout) => ({
    date: payout.date,
    source: 'creator_fund',
    amountUsd: payout.amountUsd,
    note: 'YouTube estimated revenue (collected)',
  }))

  const livePlatforms = Object.entries(collected.viewsByPlatform ?? {})
    .filter(([, series]) => Array.isArray(series) && series.length > 0)
    .map(([platform]) => platform)

  return buildSnapshot({
    personas: applyFollowers(personas, collected.followers ?? {}),
    queue,
    revenue: [...manualRevenue, ...payoutRevenue],
    posts: collected.posts ?? [],
    viewsByPlatform: collected.viewsByPlatform ?? {},
    today: today(),
    livePlatforms,
  })
}
