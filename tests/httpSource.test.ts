import { describe, expect, it } from 'vitest'
import { validateSnapshot } from '../src/data/httpSource'

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`

function payload(overrides: Record<string, unknown> = {}) {
  const dates = [day(1), day(2)]
  const points = (values: number[]) => dates.map((t, i) => ({ t, value: values[i] }))
  return {
    personas: [],
    posts: [],
    queue: [],
    revenue: [],
    viewsDaily: points([30, 40]),
    viewsByPlatform: {
      instagram: points([10, 10]),
      tiktok: points([20, 30]),
      youtube: points([0, 0]),
    },
    generatedAt: '2026-09-02T00:00:00Z',
    isMock: false,
    ...overrides,
  }
}

describe('validateSnapshot', () => {
  it('accepts a well-formed payload', () => {
    const snapshot = validateSnapshot(payload())
    expect(snapshot.viewsDaily).toHaveLength(2)
    expect(snapshot.isMock).toBe(false)
  })

  it('defaults a missing platform series to an empty one only when lengths agree', () => {
    const snapshot = validateSnapshot(
      payload({ viewsDaily: [], viewsByPlatform: {} }),
    )
    expect(snapshot.viewsByPlatform.youtube).toEqual([])
  })

  it('rejects a platform series that does not share the daily dates', () => {
    expect(() =>
      validateSnapshot(
        payload({
          viewsByPlatform: {
            instagram: [{ t: day(3), value: 1 }, { t: day(4), value: 1 }],
            tiktok: [],
            youtube: [],
          },
        }),
      ),
    ).toThrow(/must share dates|is 2026-09-03/)
  })

  it('rejects a platform series of the wrong length', () => {
    expect(() =>
      validateSnapshot(payload({ viewsByPlatform: { instagram: [{ t: day(1), value: 1 }] } })),
    ).toThrow(/must share dates/)
  })

  it('rejects a non-date point', () => {
    expect(() =>
      validateSnapshot(payload({ viewsDaily: [{ t: '02/09/2026', value: 1 }] })),
    ).toThrow(/YYYY-MM-DD/)
  })

  it('rejects a non-finite value', () => {
    expect(() =>
      validateSnapshot(payload({ viewsDaily: [{ t: day(1), value: Number.NaN }] })),
    ).toThrow(/finite number/)
  })

  it('insists the payload says whether it is mock', () => {
    const { isMock, ...rest } = payload()
    void isMock
    expect(() => validateSnapshot(rest)).toThrow(/whether these numbers are real/)
  })

  it('rejects a non-object', () => {
    expect(() => validateSnapshot(null)).toThrow(/must be an object/)
    expect(() => validateSnapshot('snapshot')).toThrow(/must be an object/)
  })

  it('rejects a missing collection', () => {
    const { personas, ...rest } = payload()
    void personas
    expect(() => validateSnapshot(rest)).toThrow(/personas must be an array/)
  })
})
