import { describe, expect, it } from 'vitest'
import { collect } from '../server/collect.mjs'

/**
 * These cover the orchestration, not the mapping: which channels get collected,
 * what happens when one of them fails, and what ends up written. The failure
 * paths are the point — they are the ones you cannot reach through the real API
 * on demand.
 */

const personas = [
  {
    id: 'p1',
    name: 'Vela',
    disclosure: { bioLabel: 'AI', perPostLabel: true, platformAiFlag: true },
    accounts: [
      { platform: 'youtube', handle: '@a', externalId: 'UC_A' },
      { platform: 'instagram', handle: '@a' },
    ],
  },
  {
    id: 'p2',
    name: 'Sola',
    disclosure: { bioLabel: 'AI', perPostLabel: false, platformAiFlag: false },
    accounts: [{ platform: 'youtube', handle: '@b', externalId: 'UC_B' }],
  },
]

function makeStore(overrides: Record<string, unknown> = {}) {
  const written: Record<string, unknown> = {}
  const files: Record<string, unknown> = {
    'personas.json': personas,
    'collected.json': { followers: {}, viewsByPlatform: {}, posts: [], payouts: [] },
    ...overrides,
  }
  return {
    written,
    readJson: (name: string, fallback: unknown) => files[name] ?? fallback,
    writeJson: (name: string, value: unknown) => {
      written[name] = value
    },
  }
}

function dailyReport(rows: Array<[string, number]>) {
  return {
    columnHeaders: [{ name: 'day' }, { name: 'views' }],
    rows,
  }
}

function makeApi(overrides: Record<string, unknown> = {}) {
  return {
    listChannels: async () => ({
      items: [
        { id: 'UC_A', statistics: { subscriberCount: '1200' } },
        { id: 'UC_B', statistics: { subscriberCount: '340' } },
      ],
    }),
    analyticsDaily: async () => dailyReport([['2026-09-18', 100]]),
    analyticsByVideo: async () => ({
      columnHeaders: [{ name: 'video' }, { name: 'views' }],
      rows: [['vid1', 90]],
    }),
    listVideos: async () => ({
      items: [{ id: 'vid1', snippet: { title: 'a post', publishedAt: '2026-09-17T00:00:00Z' }, statistics: {} }],
    }),
    analyticsRevenue: async () => ({
      columnHeaders: [{ name: 'day' }, { name: 'estimatedRevenue' }],
      rows: [['2026-09-18', 2.5]],
    }),
    ...overrides,
  }
}

const base = { endDate: '2026-09-18', windowDays: 30 }

describe('collect', () => {
  it('only targets accounts that carry an externalId', async () => {
    const store = makeStore()
    const { report } = await collect({ ...base, api: makeApi(), store })
    // Two YouTube channels with ids; the Instagram account has none.
    expect(report.channels).toBe(2)
    expect(report.collected).toEqual(['UC_A', 'UC_B'])
  })

  it('warns and does nothing when no account has an externalId', async () => {
    const store = makeStore({ 'personas.json': [{ id: 'p1', accounts: [{ platform: 'youtube', handle: '@a' }] }] })
    const { report, snapshotReady } = await collect({ ...base, api: makeApi(), store })
    expect(snapshotReady).toBe(false)
    expect(report.warnings[0]).toMatch(/externalId/)
    expect(store.written['collected.json']).toBeUndefined()
  })

  it('sums daily views across channels into one platform series', async () => {
    const store = makeStore()
    await collect({ ...base, api: makeApi(), store })
    const written = store.written['collected.json'] as any
    const day = written.viewsByPlatform.youtube.find((p: any) => p.t === '2026-09-18')
    // 100 from each of the two channels.
    expect(day.value).toBe(200)
  })

  it('records a failing channel without losing the others', async () => {
    let call = 0
    const api = makeApi({
      analyticsDaily: async () => {
        call += 1
        if (call === 1) throw new Error('403 insufficient scope')
        return dailyReport([['2026-09-18', 55]])
      },
    })
    const store = makeStore()
    const { report, snapshotReady } = await collect({ ...base, api, store })

    expect(report.failed).toHaveLength(1)
    expect(report.failed[0].error).toMatch(/insufficient scope/)
    expect(report.collected).toHaveLength(1)
    expect(snapshotReady).toBe(true)
    const written = store.written['collected.json'] as any
    expect(written.viewsByPlatform.youtube.find((p: any) => p.t === '2026-09-18').value).toBe(55)
  })

  it('reports a channel missing from channels.list rather than assuming it', async () => {
    const api = makeApi({ listChannels: async () => ({ items: [{ id: 'UC_A', statistics: {} }] }) })
    const { report } = await collect({ ...base, api, store: makeStore() })
    expect(report.failed[0].channelId).toBe('UC_B')
    expect(report.failed[0].error).toMatch(/not returned by channels.list/)
  })

  it('treats missing payout data as a note, not a failed run', async () => {
    const api = makeApi({
      analyticsRevenue: async () => {
        throw new Error('403 monetary scope required')
      },
    })
    const { report, snapshotReady } = await collect({ ...base, api, store: makeStore() })
    expect(report.failed).toHaveLength(0)
    expect(snapshotReady).toBe(true)
    expect(report.warnings.join(' ')).toMatch(/no payout data/)
    expect((makeStore().written['collected.json'] as any)?.payouts).toBeUndefined()
  })

  it('merges new days over stored history rather than replacing it', async () => {
    const store = makeStore({
      'collected.json': {
        followers: {},
        viewsByPlatform: { youtube: [{ t: '2026-09-10', value: 7 }, { t: '2026-09-18', value: 1 }] },
        posts: [],
        payouts: [],
      },
    })
    await collect({ ...base, api: makeApi(), store })
    const series = (store.written['collected.json'] as any).viewsByPlatform.youtube
    expect(series.find((p: any) => p.t === '2026-09-10').value).toBe(7)
    // The fresh collect revises the shared day.
    expect(series.find((p: any) => p.t === '2026-09-18').value).toBe(200)
  })

  it('keeps stored posts when a run returns none', async () => {
    const stale = [{ id: 'yt:old', personaId: 'p1', views: 5 }]
    const store = makeStore({
      'collected.json': { followers: {}, viewsByPlatform: {}, posts: stale, payouts: [] },
    })
    const api = makeApi({
      analyticsByVideo: async () => ({ columnHeaders: [{ name: 'video' }], rows: [] }),
    })
    await collect({ ...base, api, store })
    expect((store.written['collected.json'] as any).posts).toEqual(stale)
  })

  it('carries each persona disclosure state onto its posts', async () => {
    const store = makeStore()
    await collect({ ...base, api: makeApi(), store })
    const posts = (store.written['collected.json'] as any).posts
    // p1 labels its posts; p2 does not.
    expect(posts.find((p: any) => p.personaId === 'p1').disclosed).toBe(true)
    expect(posts.find((p: any) => p.personaId === 'p2').disclosed).toBe(false)
  })

  it('records follower counts per channel', async () => {
    const store = makeStore()
    await collect({ ...base, api: makeApi(), store })
    expect((store.written['collected.json'] as any).followers).toEqual({ UC_A: 1200, UC_B: 340 })
  })

  it('asks for the window it was given', async () => {
    const seen: Array<Record<string, string>> = []
    const api = makeApi({
      analyticsDaily: async (args: Record<string, string>) => {
        seen.push(args)
        return dailyReport([])
      },
    })
    await collect({ endDate: '2026-09-18', windowDays: 7, api, store: makeStore() })
    expect(seen[0].startDate).toBe('2026-09-12')
    expect(seen[0].endDate).toBe('2026-09-18')
  })
})
