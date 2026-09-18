import { describe, expect, it } from 'vitest'
import { MetricPoint } from '../src/data/types'
import { indexAtX, linePath, makeScale, periodChange, sumLast } from '../src/lib/series'

const points: MetricPoint[] = [
  { t: '2026-09-01', value: 10 },
  { t: '2026-09-02', value: 20 },
  { t: '2026-09-03', value: 30 },
  { t: '2026-09-04', value: 40 },
]

describe('makeScale', () => {
  it('spreads x across the full width', () => {
    const scale = makeScale(points, 300, 100)
    expect(scale.x(0)).toBe(0)
    expect(scale.x(3)).toBe(300)
  })

  it('keeps headroom so the peak never touches the frame', () => {
    const scale = makeScale(points, 300, 100)
    expect(scale.y(40)).toBeGreaterThan(0)
    expect(scale.max).toBeGreaterThan(40)
  })

  it('never lets a count scale go below zero', () => {
    const scale = makeScale(points, 300, 100)
    expect(scale.min).toBeGreaterThanOrEqual(0)
  })

  it('survives a flat series', () => {
    const flat: MetricPoint[] = [
      { t: 'a', value: 5 },
      { t: 'b', value: 5 },
    ]
    const scale = makeScale(flat, 100, 50)
    expect(Number.isFinite(scale.y(5))).toBe(true)
  })

  it('survives a single point', () => {
    const scale = makeScale([{ t: 'a', value: 3 }], 100, 50)
    expect(scale.x(0)).toBe(0)
  })
})

describe('linePath', () => {
  it('starts with a move and continues with lines', () => {
    const d = linePath(points, makeScale(points, 300, 100))
    expect(d.startsWith('M')).toBe(true)
    expect(d.match(/L/g)?.length).toBe(3)
  })
})

describe('indexAtX', () => {
  it('clamps outside the plot', () => {
    expect(indexAtX(-50, 100, 4)).toBe(0)
    expect(indexAtX(500, 100, 4)).toBe(3)
  })

  it('snaps to the nearest point', () => {
    expect(indexAtX(50, 100, 3)).toBe(1)
  })
})

describe('sumLast / periodChange', () => {
  it('sums only the trailing window', () => {
    expect(sumLast(points, 2)).toBe(70)
  })

  it('returns null without a full prior period', () => {
    expect(periodChange(points, 3)).toBeNull()
  })

  it('compares the trailing window against the one before it', () => {
    // (30+40) vs (10+20) = +133.3%
    expect(periodChange(points, 2)).toBeCloseTo(4 / 3, 5)
  })
})
