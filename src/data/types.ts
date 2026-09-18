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
  /** Platform-side id the collector queries by (a YouTube channel id, etc.). */
  externalId?: string
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

/**
 * A generated file attached to a queue item. Derived from the filesystem by the
 * collector, never stored in queue.json — two answers to "what is attached?"
 * would be one too many.
 */
export interface QueueAsset {
  /** `<itemId>/<filename>`. */
  id: string
  filename: string
  /** Path the console loads it from, or a data URI in the mock. */
  url: string
  kind: 'image' | 'video'
  contentType?: string
  bytes?: number
  addedAt?: string
}

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
  /**
   * What a reviewer actually looks at. An item with none cannot be approved:
   * signing off with nothing attached is signing off on the brief.
   */
  assets?: QueueAsset[]
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
  /**
   * Per-platform collection state. A snapshot is usually part real: the
   * collector covers what its APIs expose and nothing more, and the console
   * says which is which rather than implying whole coverage.
   */
  coverage?: Coverage[]
}

export interface Coverage {
  platform: Platform
  /** 'live' — collected from the platform API. 'manual' — operator-maintained file. 'absent' — no data. */
  status: 'live' | 'manual' | 'absent'
  note?: string
}

/**
 * Anything that can fill the console. The mock source ships; a live source
 * implements the same shape on top of the platform APIs (see docs/data-sources.md).
 */
export interface DataSource {
  readonly name: string
  load(): Promise<Snapshot>
}
