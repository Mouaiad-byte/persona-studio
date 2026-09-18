import { describe, expect, it } from 'vitest'
import { addDays, mergeDaily, pruneBefore, sumSeries, windowDays } from '../server/lib/history.mjs'
import { buildSnapshot } from '../server/lib/snapshot.mjs'

describe('mergeDaily', () => {
  it('lets a fresh collect revise a stored day', () => {
    const merged = mergeDaily(
      [{ t: '2026-09-01', value: 100 }],
      [{ t: '2026-09-01', value: 140 }],
    )
    expect(merged).toEqual([{ t: '2026-09-01', value: 140 }])
  })

  it('keeps both and orders oldest-first', () => {
    const merged = mergeDaily(
      [{ t: '2026-09-03', value: 3 }],
      [{ t: '2026-09-01', value: 1 }],
    )
    expect(merged.map((p: { t: string }) => p.t)).toEqual(['2026-09-01', '2026-09-03'])
  })
})

describe('addDays', () => {
  it('crosses a month boundary backwards', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('crosses a year boundary forwards', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('windowDays', () => {
  it('fills a day with no analytics row as a real zero', () => {
    const out = windowDays([{ t: '2026-09-03', value: 30 }], 3, '2026-09-03')
    expect(out).toEqual([
      { t: '2026-09-01', value: 0 },
      { t: '2026-09-02', value: 0 },
      { t: '2026-09-03', value: 30 },
    ])
  })

  it('ends on the requested date inclusive and has exactly `count` points', () => {
    const out = windowDays([], 30, '2026-09-18')
    expect(out).toHaveLength(30)
    expect(out[29].t).toBe('2026-09-18')
    expect(out[0].t).toBe('2026-08-20')
  })

  it('ignores history outside the window', () => {
    const out = windowDays([{ t: '2020-01-01', value: 999 }], 2, '2026-09-18')
    expect(out.every((p: { value: number }) => p.value === 0)).toBe(true)
  })
})

describe('sumSeries', () => {
  it('adds same-dated series', () => {
    const out = sumSeries([
      [{ t: 'a', value: 1 }, { t: 'b', value: 2 }],
      [{ t: 'a', value: 10 }, { t: 'b', value: 20 }],
    ])
    expect(out).toEqual([{ t: 'a', value: 11 }, { t: 'b', value: 22 }])
  })

  it('skips empty series rather than failing', () => {
    const out = sumSeries([[], [{ t: 'a', value: 5 }]])
    expect(out).toEqual([{ t: 'a', value: 5 }])
  })

  it('refuses to add misaligned series', () => {
    expect(() =>
      sumSeries([[{ t: 'a', value: 1 }], [{ t: 'b', value: 1 }]]),
    ).toThrow(/same dates/)
  })
})

describe('pruneBefore', () => {
  it('keeps the trailing window and drops the rest', () => {
    const kept = pruneBefore(
      [{ t: '2026-08-01', value: 1 }, { t: '2026-09-17', value: 2 }, { t: '2026-09-18', value: 3 }],
      2,
      '2026-09-18',
    )
    expect(kept.map((p: { t: string }) => p.t)).toEqual(['2026-09-17', '2026-09-18'])
  })
})

describe('buildSnapshot', () => {
  const base = {
    personas: [],
    queue: [],
    revenue: [
      { date: '2026-09-17', source: 'affiliate', amountUsd: 10 },
      { date: '2020-01-01', source: 'affiliate', amountUsd: 999 },
    ],
    posts: [
      { id: 'a', publishedAt: '2026-09-17', views: 1 },
      { id: 'old', publishedAt: '2019-01-01', views: 1 },
    ],
    viewsByPlatform: { youtube: [{ t: '2026-09-18', value: 500 }] },
    today: '2026-09-18',
    livePlatforms: ['youtube'],
  }

  it('is never marked mock', () => {
    expect(buildSnapshot(base).isMock).toBe(false)
  })

  it('windows every platform to the same 30 dates', () => {
    const snap = buildSnapshot(base)
    expect(snap.viewsDaily).toHaveLength(30)
    for (const platform of ['instagram', 'tiktok', 'youtube']) {
      expect(snap.viewsByPlatform[platform]).toHaveLength(30)
      expect(snap.viewsByPlatform[platform][0].t).toBe(snap.viewsDaily[0].t)
    }
  })

  it('totals the platform series into viewsDaily', () => {
    const snap = buildSnapshot(base)
    expect(snap.viewsDaily[29].value).toBe(500)
  })

  it('drops posts and revenue from before the window', () => {
    const snap = buildSnapshot(base)
    expect(snap.posts.map((p: { id: string }) => p.id)).toEqual(['a'])
    expect(snap.revenue).toHaveLength(1)
  })

  it('marks a collected platform live and an unconfigured one absent', () => {
    const snap = buildSnapshot(base)
    const statusFor = (platform: string) =>
      snap.coverage.find((c: { platform: string }) => c.platform === platform)?.status
    expect(statusFor('youtube')).toBe('live')
    expect(statusFor('tiktok')).toBe('absent')
  })

  it('marks a platform with stored history but no collector as manual', () => {
    const snap = buildSnapshot({
      ...base,
      viewsByPlatform: { ...base.viewsByPlatform, instagram: [{ t: '2026-09-18', value: 42 }] },
    })
    const instagram = snap.coverage.find((c: { platform: string }) => c.platform === 'instagram')
    expect(instagram.status).toBe('manual')
  })
})

import { applyFollowers } from '../server/lib/snapshot.mjs'

describe('applyFollowers', () => {
  const personas = [
    {
      id: 'p1',
      accounts: [
        { platform: 'youtube', handle: '@a', externalId: 'UC1', followers: 0 },
        { platform: 'tiktok', handle: '@a', followers: 500 },
      ],
    },
  ]

  it('overlays a collected count onto the matching account', () => {
    const out = applyFollowers(personas, { UC1: 12600 })
    expect(out[0].accounts[0].followers).toBe(12600)
  })

  it('leaves accounts with no collected figure untouched', () => {
    const out = applyFollowers(personas, { UC1: 12600 })
    expect(out[0].accounts[1].followers).toBe(500)
  })

  it('does not mutate the config it was given', () => {
    applyFollowers(personas, { UC1: 12600 })
    expect(personas[0].accounts[0].followers).toBe(0)
  })
})
