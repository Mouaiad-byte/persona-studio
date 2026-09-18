import { describe, expect, it } from 'vitest'
import { buildMockSnapshot } from '../src/data/mockSource'
import { PLATFORMS } from '../src/data/types'

describe('buildMockSnapshot', () => {
  const snapshot = buildMockSnapshot(7, new Date('2026-09-18T00:00:00Z'))

  it('is deterministic for a given seed', () => {
    const again = buildMockSnapshot(7, new Date('2026-09-18T00:00:00Z'))
    expect(again.viewsDaily).toEqual(snapshot.viewsDaily)
    expect(again.revenue).toEqual(snapshot.revenue)
  })

  it('declares itself synthetic', () => {
    expect(snapshot.isMock).toBe(true)
  })

  it('keeps the platform breakdown consistent with the daily total', () => {
    snapshot.viewsDaily.forEach((point, i) => {
      const parts = PLATFORMS.reduce((sum, p) => sum + snapshot.viewsByPlatform[p][i].value, 0)
      expect(point.value).toBe(parts)
      expect(snapshot.viewsByPlatform.instagram[i].t).toBe(point.t)
    })
  })

  it('ships one persona with incomplete disclosure so the gate is visible', () => {
    const incomplete = snapshot.personas.filter((p) => !p.disclosure.platformAiFlag)
    expect(incomplete).toHaveLength(1)
  })

  it('covers 30 days of view history', () => {
    expect(snapshot.viewsDaily).toHaveLength(30)
  })
})
