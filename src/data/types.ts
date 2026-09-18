export type Platform = 'instagram' | 'tiktok' | 'youtube'

export const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube']

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

/** Categorical slot per platform. Colour follows the entity, never its rank, so
 *  these bindings are fixed and survive any filter that changes the series count. */
export const PLATFORM_COLOR_VAR: Record<Platform, string> = {
  instagram: 'var(--series-1)',
  tiktok: 'var(--series-2)',
  youtube: 'var(--series-3)',
}

/**
 * How a persona is labelled as AI-generated. Not optional: a synthetic persona
 * that reads as a real person is the line between a studio and a deception, and
 * every platform's own rules put it there too. `isComplete` gates publishing.
 */
export interface Disclosure {
  /** Plain-language "AI-generated" note in the profile bio. */
  bioLabel: string
  /** Per-post "AI-generated" label applied on publish. */
  perPostLabel: boolean
  /** The platform's own AI-content flag switched on for the account. */
  platformAiFlag: boolean
}

export interface Account {
  platform: Platform
  handle: string
  followers: number
  /** Platform monetisation program state — most programs exclude mass-produced content. */
  monetization: 'none' | 'applied' | 'rejected' | 'active'
}

export interface Persona {
  id: string
  name: string
  niche: string
  createdAt: string
  disclosure: Disclosure
  accounts: Account[]
}

export type QueueState =
  | 'brief'        // written, nothing generated yet
  | 'generating'   // handed to the image/video generator
  | 'review'       // waiting on a human to look at it
  | 'scheduled'    // approved and queued to publish
  | 'published'
  | 'rejected'

export interface QueueItem {
  id: string
  personaId: string
  brief: string
  state: QueueState
  /** Generator that produced (or will produce) the asset, e.g. `openart-mcp:flux-1.1`. */
  generator: string
  createdAt: string
  scheduledFor?: string
  /** Who signed off. Absent until a human actually reviews it. */
  approvedBy?: string
  rejectionReason?: string
}

export interface Post {
  id: string
  personaId: string
  platform: Platform
  publishedAt: string
  caption: string
  views: number
  likes: number
  comments: number
  saves: number
  /** Whether the published post carried its AI label. */
  disclosed: boolean
}

export interface MetricPoint {
  /** ISO date (day granularity). */
  t: string
  value: number
}

export type RevenueSource = 'brand_deal' | 'affiliate' | 'creator_fund' | 'own_product'

export const REVENUE_LABEL: Record<RevenueSource, string> = {
  brand_deal: 'Brand deals',
  affiliate: 'Affiliate',
  creator_fund: 'Platform payouts',
  own_product: 'Own product',
}

export interface RevenueEntry {
  date: string
  source: RevenueSource
  amountUsd: number
  note?: string
}

export interface Snapshot {
  personas: Persona[]
  posts: Post[]
  queue: QueueItem[]
  revenue: RevenueEntry[]
  /** Daily total views, oldest first. */
  viewsDaily: MetricPoint[]
  /** Daily views per platform, oldest first, same dates as `viewsDaily`. */
  viewsByPlatform: Record<Platform, MetricPoint[]>
  generatedAt: string
  /** True when the numbers are synthetic. The UI says so out loud when they are. */
  isMock: boolean
}

/**
 * Anything that can fill the console. The mock source ships; a live source
 * implements the same shape on top of the platform APIs (see docs/data-sources.md).
 */
export interface DataSource {
  readonly name: string
  load(): Promise<Snapshot>
}
