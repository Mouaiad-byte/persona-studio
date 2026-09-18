import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INPUTS,
  factsFromSnapshot,
  inputsFromFacts,
  project,
  realityChecks,
  StudioInputs,
} from '../src/lib/economics'

const base: StudioInputs = DEFAULT_INPUTS

describe('project', () => {
  it('scales posts and views by personas and cadence', () => {
    const out = project({ ...base, personaCount: 2, postsPerPersonaPerDay: 1, medianViewsPerPost: 1000 })
    expect(out.postsPerMonth).toBeCloseTo(60.8, 5)
    expect(out.viewsPerMonth).toBeCloseTo(60_800, 5)
  })

  it('pays nothing from platform programs unless eligibility is asserted', () => {
    const ineligible = project({ ...base, platformPayoutsEligible: false })
    expect(ineligible.revenue.payouts).toBe(0)

    const eligible = project({ ...base, platformPayoutsEligible: true })
    expect(eligible.revenue.payouts).toBeGreaterThan(0)
    expect(eligible.revenue.total).toBeGreaterThan(ineligible.revenue.total)
  })

  it('computes affiliate revenue as views × click × conversion × commission', () => {
    const out = project({
      ...base,
      personaCount: 1,
      postsPerPersonaPerDay: 1,
      medianViewsPerPost: 100_000,
      rates: { ...base.rates, affiliateClickRate: 0.01, affiliateConversionRate: 0.1, affiliateCommissionUsd: 10 },
    })
    // 3,040,000 views × 0.01 × 0.1 × $10
    expect(out.revenue.affiliate).toBeCloseTo(30_400, 2)
  })

  it('prices the operator review hours into costs', () => {
    const out = project({
      ...base,
      personaCount: 1,
      postsPerPersonaPerDay: 1,
      costs: { ...base.costs, reviewMinutesPerPost: 6, hourlyRateUsd: 30 },
    })
    // 30.4 posts × 6 min = 182.4 min = 3.04 h, at $30/h
    expect(out.reviewHoursPerMonth).toBeCloseTo(3.04, 2)
    expect(out.costs.humanReview).toBeCloseTo(91.2, 1)
  })

  it('reports no breakeven when per-view margin is negative', () => {
    const out = project({
      ...base,
      medianViewsPerPost: 10,
      costs: { ...base.costs, videoGenPerPostUsd: 20 },
    })
    expect(out.breakevenViewsPerMonth).toBeNull()
  })

  it('finds a finite breakeven when per-view margin is positive', () => {
    const out = project({
      ...base,
      medianViewsPerPost: 200_000,
      rates: { ...base.rates, affiliateClickRate: 0.02, affiliateConversionRate: 0.05, brandDealsPerMonth: 0 },
    })
    expect(out.breakevenViewsPerMonth).not.toBeNull()
    expect(out.breakevenViewsPerMonth!).toBeGreaterThan(0)
  })

  it('handles zero output without dividing by zero', () => {
    const out = project({ ...base, personaCount: 0, medianViewsPerPost: 0 })
    expect(out.viewsPerMonth).toBe(0)
    expect(Number.isFinite(out.rpmUsd)).toBe(true)
    expect(out.rpmUsd).toBe(0)
  })
})

describe('realityChecks', () => {
  it('flags the ineligible-payouts assumption', () => {
    const input = { ...base, platformPayoutsEligible: false }
    const ids = realityChecks(input, project(input)).map((c) => c.id)
    expect(ids).toContain('payouts')
  })

  it('flags a loss-making configuration as critical', () => {
    const input: StudioInputs = {
      ...base,
      postsPerPersonaPerDay: 8,
      medianViewsPerPost: 200,
      rates: { ...base.rates, brandDealsPerMonth: 0 },
    }
    const checks = realityChecks(input, project(input))
    const negative = checks.find((c) => c.id === 'negative')
    expect(negative?.severity).toBe('critical')
  })

  it('flags deal concentration when deals dominate gross', () => {
    const input: StudioInputs = {
      ...base,
      medianViewsPerPost: 100,
      rates: { ...base.rates, brandDealsPerMonth: 4, brandDealFeeUsd: 1000 },
    }
    const ids = realityChecks(input, project(input)).map((c) => c.id)
    expect(ids).toContain('deal-concentration')
  })
})

describe('factsFromSnapshot', () => {
  const snapshot = {
    personas: [{ id: 'a' }, { id: 'b' }],
    posts: [{ views: 100 }, { views: 300 }, { views: 5000 }],
    revenue: [{ amountUsd: 40 }],
    viewsDaily: Array.from({ length: 10 }, () => ({ value: 400 })),
  }

  it('uses the median rather than the mean, so one outlier does not set the plan', () => {
    // mean is 1,800; median is 300
    expect(factsFromSnapshot(snapshot)!.medianViewsPerPost).toBe(300)
  })

  it('averages the median across an even number of posts', () => {
    const facts = factsFromSnapshot({ ...snapshot, posts: [{ views: 100 }, { views: 200 }] })
    expect(facts!.medianViewsPerPost).toBe(150)
  })

  it('derives cadence per persona per day', () => {
    // 3 posts / 2 personas / 10 days
    expect(factsFromSnapshot(snapshot)!.postsPerPersonaPerDay).toBeCloseTo(0.15, 5)
  })

  it('computes observed RPM over the window', () => {
    // $40 over 4,000 views
    expect(factsFromSnapshot(snapshot)!.observedRpmUsd).toBeCloseTo(10, 5)
  })

  it('reports null RPM rather than zero when there were no views', () => {
    const facts = factsFromSnapshot({
      ...snapshot,
      viewsDaily: Array.from({ length: 10 }, () => ({ value: 0 })),
    })
    expect(facts!.observedRpmUsd).toBeNull()
  })

  it('declines to derive anything from an empty window', () => {
    expect(factsFromSnapshot({ ...snapshot, posts: [] })).toBeNull()
    expect(factsFromSnapshot({ ...snapshot, personas: [] })).toBeNull()
    expect(factsFromSnapshot({ ...snapshot, viewsDaily: [] })).toBeNull()
  })
})

describe('inputsFromFacts', () => {
  it('overwrites the observable inputs and keeps the operator rates and costs', () => {
    const facts = factsFromSnapshot({
      personas: [{ id: 'a' }],
      posts: [{ views: 2500 }],
      revenue: [],
      viewsDaily: Array.from({ length: 30 }, () => ({ value: 10 })),
    })!
    const seeded = inputsFromFacts(facts, DEFAULT_INPUTS)
    expect(seeded.medianViewsPerPost).toBe(2500)
    expect(seeded.personaCount).toBe(1)
    expect(seeded.rates).toEqual(DEFAULT_INPUTS.rates)
    expect(seeded.costs).toEqual(DEFAULT_INPUTS.costs)
  })
})
