import { describe, expect, it } from 'vitest'
import { analyticsRowsToPoints, channelFollowers, indexAnalyticsBy, parseRevenueCsv, videoToPost } from '../server/lib/map.mjs'

describe('analyticsRowsToPoints', () => {
  const response = {
    columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'likes' }],
    rows: [
      ['2026-09-03', 300, 9],
      ['2026-09-01', 100, 3],
      ['2026-09-02', 200, 6],
    ],
  }

  it('reads the column by name, not position', () => {
    expect(analyticsRowsToPoints(response, 'likes')).toEqual([
      { t: '2026-09-01', value: 3 },
      { t: '2026-09-02', value: 6 },
      { t: '2026-09-03', value: 9 },
    ])
  })

  it('returns points oldest-first regardless of row order', () => {
    const points = analyticsRowsToPoints(response, 'views')
    expect(points.map((p) => p.t)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('throws when the metric is not in the response', () => {
    expect(() => analyticsRowsToPoints(response, 'saves')).toThrow(/missing a column/)
  })

  it('treats an empty report as no points rather than an error', () => {
    expect(analyticsRowsToPoints({ columnHeaders: [{ name: 'day' }, { name: 'views' }] }, 'views')).toEqual([])
  })
})

describe('indexAnalyticsBy', () => {
  it('keys metrics by the dimension column', () => {
    const indexed = indexAnalyticsBy(
      {
        columnHeaders: [{ name: 'video' }, { name: 'views' }, { name: 'comments' }],
        rows: [['abc', 500, 12]],
      },
      'video',
    )
    expect(indexed.get('abc')).toEqual({ views: 500, comments: 12 })
  })

  it('throws when the dimension is absent', () => {
    expect(() => indexAnalyticsBy({ columnHeaders: [{ name: 'day' }], rows: [] }, 'video')).toThrow(/no "video"/)
  })
})

describe('videoToPost', () => {
  const video = {
    id: 'vid1',
    snippet: { title: 'dialling in a new bag', publishedAt: '2026-09-10T08:30:00Z' },
    statistics: { viewCount: '900', likeCount: '40', commentCount: '5' },
  }

  it('prefers analytics metrics over cached lifetime statistics', () => {
    const post = videoToPost(video, { views: 1200, likes: 50, comments: 7 }, { personaId: 'p1', disclosed: true })
    expect(post.views).toBe(1200)
    expect(post.likes).toBe(50)
  })

  it('falls back to statistics when there is no analytics row', () => {
    const post = videoToPost(video, undefined, { personaId: 'p1', disclosed: true })
    expect(post.views).toBe(900)
    expect(post.comments).toBe(5)
  })

  it('reports saves as zero because YouTube exposes no such metric', () => {
    expect(videoToPost(video, { views: 1 }, { personaId: 'p1', disclosed: true }).saves).toBe(0)
  })

  it('reduces the published timestamp to a date', () => {
    expect(videoToPost(video, undefined, { personaId: 'p1', disclosed: true }).publishedAt).toBe('2026-09-10')
  })
})

describe('parseRevenueCsv', () => {
  it('parses rows, skipping the header, blanks and comments', () => {
    const rows = parseRevenueCsv(
      ['date,source,amountUsd,note', '', '# a comment', '2026-09-01,affiliate,12.50,grinder link'].join('\n'),
    )
    expect(rows).toEqual([{ date: '2026-09-01', source: 'affiliate', amountUsd: 12.5, note: 'grinder link' }])
  })

  it('skips the header wherever it sits below the comment block', () => {
    const rows = parseRevenueCsv(
      ['# what this file is', '# source must be one of ...', 'date,source,amountUsd,note', '2026-09-01,affiliate,5'].join('\n'),
    )
    expect(rows).toEqual([{ date: '2026-09-01', source: 'affiliate', amountUsd: 5 }])
  })

  it('keeps commas inside the note', () => {
    const rows = parseRevenueCsv('2026-09-02,brand_deal,600,one Reel, one carousel')
    expect(rows[0].note).toBe('one Reel, one carousel')
  })

  it('omits the note when there is none', () => {
    expect(parseRevenueCsv('2026-09-02,own_product,19')[0]).toEqual({
      date: '2026-09-02',
      source: 'own_product',
      amountUsd: 19,
    })
  })

  it('throws on a bad date, naming the line', () => {
    expect(() => parseRevenueCsv('01/09/2026,affiliate,10')).toThrow(/line 1/)
  })

  it('throws on an unknown source rather than dropping the row', () => {
    expect(() => parseRevenueCsv('2026-09-01,tips,10')).toThrow(/must be one of/)
  })

  it('throws on a non-numeric amount', () => {
    expect(() => parseRevenueCsv('2026-09-01,affiliate,twelve')).toThrow(/not a number/)
  })
})

describe('channelFollowers', () => {
  it('reads the subscriber count', () => {
    expect(channelFollowers({ statistics: { subscriberCount: '12600' } })).toBe(12600)
  })

  it('reports zero for a hidden subscriber count', () => {
    expect(channelFollowers({ statistics: { subscriberCount: '12600', hiddenSubscriberCount: true } })).toBe(0)
  })

  it('survives a channel with no statistics', () => {
    expect(channelFollowers({})).toBe(0)
  })
})
