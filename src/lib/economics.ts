/**
 * Unit economics for an AI-persona content studio.
 *
 * The point of this module is that the numbers have to close. A dashboard can
 * show any revenue figure you like; this works out what the revenue would have
 * to come from, what it costs to produce, and what the operator's own hours are
 * worth once the review gate is priced in.
 */

export interface RateCard {
  /** Net revenue per 1,000 views from platform payout programs. */
  payoutRpmUsd: number
  /** Fraction of views that click a link in bio / on-screen. */
  affiliateClickRate: number
  /** Fraction of clicks that convert. */
  affiliateConversionRate: number
  /** Net commission per conversion. */
  affiliateCommissionUsd: number
  /** Fraction of views that buy your own product. */
  ownProductConversionRate: number
  ownProductPriceUsd: number
  brandDealsPerMonth: number
  brandDealFeeUsd: number
}

export interface CostCard {
  /** Image generation spend per published post (including rejected attempts). */
  imageGenPerPostUsd: number
  /** Video generation spend per published post. Video is the expensive one. */
  videoGenPerPostUsd: number
  /** Captioning / ideation model spend per post. */
  llmPerPostUsd: number
  /** Schedulers, proxies, storage, domains — anything billed monthly. */
  toolingMonthlyUsd: number
  /** Minutes a human spends reviewing each post before it can publish. */
  reviewMinutesPerPost: number
  /** What that human's hour is worth. */
  hourlyRateUsd: number
}

export interface StudioInputs {
  personaCount: number
  postsPerPersonaPerDay: number
  medianViewsPerPost: number
  /**
   * Whether the accounts actually qualify for platform payout programs.
   * Default false, because the major programs require original, non-mass-produced
   * content and a bulk-generated feed is the case they were written to exclude.
   */
  platformPayoutsEligible: boolean
  rates: RateCard
  costs: CostCard
}

export interface RevenueBreakdown {
  payouts: number
  affiliate: number
  ownProduct: number
  brandDeals: number
  total: number
}

export interface CostBreakdown {
  generation: number
  llm: number
  tooling: number
  humanReview: number
  total: number
}

export interface StudioProjection {
  postsPerMonth: number
  viewsPerMonth: number
  revenue: RevenueBreakdown
  costs: CostBreakdown
  netUsd: number
  /** Total revenue per 1,000 views — the single number worth comparing across setups. */
  rpmUsd: number
  reviewHoursPerMonth: number
  /** Net divided by the operator's own review hours. Negative means it costs you to run. */
  effectiveHourlyUsd: number
  /** Views per month needed to cover costs at the current per-view revenue. null if per-view revenue is zero. */
  breakevenViewsPerMonth: number | null
}

const DAYS_PER_MONTH = 30.4

export function project(input: StudioInputs): StudioProjection {
  const { rates, costs } = input
  const postsPerMonth = input.personaCount * input.postsPerPersonaPerDay * DAYS_PER_MONTH
  const viewsPerMonth = postsPerMonth * input.medianViewsPerPost

  const payouts = input.platformPayoutsEligible ? (viewsPerMonth / 1000) * rates.payoutRpmUsd : 0
  const clicks = viewsPerMonth * rates.affiliateClickRate
  const affiliate = clicks * rates.affiliateConversionRate * rates.affiliateCommissionUsd
  const ownProduct = viewsPerMonth * rates.ownProductConversionRate * rates.ownProductPriceUsd
  const brandDeals = rates.brandDealsPerMonth * rates.brandDealFeeUsd
  const revenueTotal = payouts + affiliate + ownProduct + brandDeals

  const generation = postsPerMonth * (costs.imageGenPerPostUsd + costs.videoGenPerPostUsd)
  const llm = postsPerMonth * costs.llmPerPostUsd
  const reviewHoursPerMonth = (postsPerMonth * costs.reviewMinutesPerPost) / 60
  const humanReview = reviewHoursPerMonth * costs.hourlyRateUsd
  const costTotal = generation + llm + costs.toolingMonthlyUsd + humanReview

  const perViewRevenue = viewsPerMonth > 0 ? (payouts + affiliate + ownProduct) / viewsPerMonth : 0
  const fixedish = costs.toolingMonthlyUsd
  const variablePerView =
    input.medianViewsPerPost > 0
      ? (costs.imageGenPerPostUsd +
          costs.videoGenPerPostUsd +
          costs.llmPerPostUsd +
          (costs.reviewMinutesPerPost / 60) * costs.hourlyRateUsd) /
        input.medianViewsPerPost
      : 0
  const marginPerView = perViewRevenue - variablePerView
  const breakevenViewsPerMonth =
    marginPerView > 0 ? Math.max(0, (fixedish - brandDeals) / marginPerView) : null

  return {
    postsPerMonth,
    viewsPerMonth,
    revenue: { payouts, affiliate, ownProduct, brandDeals, total: revenueTotal },
    costs: { generation, llm, tooling: costs.toolingMonthlyUsd, humanReview, total: costTotal },
    netUsd: revenueTotal - costTotal,
    rpmUsd: viewsPerMonth > 0 ? (revenueTotal / viewsPerMonth) * 1000 : 0,
    reviewHoursPerMonth,
    effectiveHourlyUsd:
      reviewHoursPerMonth > 0 ? (revenueTotal - costTotal + humanReview) / reviewHoursPerMonth : 0,
    breakevenViewsPerMonth,
  }
}

/**
 * Starting values. These are deliberately conservative and they are inputs, not
 * facts: platform payout rates and program terms change, so verify each against
 * your own dashboard before you plan around it. What does not change much is the
 * shape — per-view money is small, deals and your own product are where the
 * margin is, and human review is the cost people forget.
 */
export const DEFAULT_INPUTS: StudioInputs = {
  personaCount: 3,
  postsPerPersonaPerDay: 2,
  medianViewsPerPost: 4000,
  platformPayoutsEligible: false,
  rates: {
    payoutRpmUsd: 0.25,
    affiliateClickRate: 0.004,
    affiliateConversionRate: 0.02,
    affiliateCommissionUsd: 12,
    // Derived from the same funnel as affiliate: ~0.4% of views click through,
    // ~1% of those buy. Guessing a bigger number here is how projections lie.
    ownProductConversionRate: 0.00004,
    ownProductPriceUsd: 19,
    brandDealsPerMonth: 1,
    brandDealFeeUsd: 600,
  },
  costs: {
    imageGenPerPostUsd: 0.35,
    videoGenPerPostUsd: 1.6,
    llmPerPostUsd: 0.05,
    toolingMonthlyUsd: 90,
    reviewMinutesPerPost: 6,
    hourlyRateUsd: 25,
  },
}

export interface RealityCheck {
  id: string
  severity: 'critical' | 'serious' | 'warning' | 'good'
  title: string
  detail: string
}

/** Structural problems the projection implies, stated once, with the arithmetic behind them. */
export function realityChecks(input: StudioInputs, out: StudioProjection): RealityCheck[] {
  const checks: RealityCheck[] = []

  if (!input.platformPayoutsEligible) {
    checks.push({
      id: 'payouts',
      severity: 'warning',
      title: 'No platform payout revenue in this model',
      detail:
        'Payouts are switched off because the major programs require original, non-mass-produced content ' +
        'and audit against it. If your accounts are genuinely admitted to a program, switch it on — but ' +
        'plan the business as if they are not.',
    })
  }

  const perViewSources = out.revenue.payouts + out.revenue.affiliate + out.revenue.ownProduct
  if (out.revenue.total > 0 && out.revenue.brandDeals / out.revenue.total > 0.5) {
    checks.push({
      id: 'deal-concentration',
      severity: 'serious',
      title: 'Most of the revenue is brand deals, not views',
      detail:
        `Deals are ${Math.round((out.revenue.brandDeals / out.revenue.total) * 100)}% of gross. ` +
        'That is a sales business with a content top-of-funnel, not a content farm — and brands ask who ' +
        'the creator is, which is the conversation the disclosure gate exists to make survivable.',
    })
  }

  if (out.netUsd < 0) {
    checks.push({
      id: 'negative',
      severity: 'critical',
      title: 'Loss-making at these inputs',
      detail:
        `Costs of ${out.costs.total.toFixed(0)} exceed gross of ${out.revenue.total.toFixed(0)} per month. ` +
        'Generation spend and review hours scale linearly with posts; per-view revenue does not.',
    })
  }

  if (out.reviewHoursPerMonth > 40) {
    checks.push({
      id: 'review-load',
      severity: 'serious',
      title: `Review load is ${out.reviewHoursPerMonth.toFixed(0)} h/month`,
      detail:
        'Every post needs a human to look at it before it publishes. At this volume that is a part-time ' +
        'job, and dropping the gate is what turns a studio into the thing that gets accounts banned.',
    })
  }

  if (out.effectiveHourlyUsd < 15 && out.reviewHoursPerMonth > 0) {
    checks.push({
      id: 'hourly',
      severity: 'warning',
      title: `Your own hour earns ${out.effectiveHourlyUsd.toFixed(2)}`,
      detail:
        'Net plus the review cost, divided by review hours. Compare it against what an hour of your time ' +
        'earns elsewhere before scaling post volume.',
    })
  }

  if (perViewSources > 0 && out.rpmUsd < 1) {
    checks.push({
      id: 'rpm',
      severity: 'warning',
      title: `Blended RPM is ${out.rpmUsd.toFixed(2)} per 1,000 views`,
      detail:
        'Reach is cheap and attention is not the same as money. Raising conversion on one product beats ' +
        'doubling output almost every time at this RPM.',
    })
  }

  if (out.netUsd > 0 && out.revenue.ownProduct > out.revenue.affiliate) {
    checks.push({
      id: 'own-product',
      severity: 'good',
      title: 'Own product is out-earning affiliate',
      detail: 'This is the durable direction: you keep the margin and the customer relationship.',
    })
  }

  return checks
}
