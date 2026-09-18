import {
  Account,
  DataSource,
  QueueAsset,
  MetricPoint,
  Persona,
  Platform,
  PLATFORMS,
  Post,
  QueueItem,
  QueueState,
  RevenueEntry,
  RevenueSource,
  Snapshot,
} from './types'

/** Deterministic PRNG so the console looks the same on every reload. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const DAYS = 30

function isoDay(daysAgo: number, from: Date): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

const PERSONA_SEEDS: Array<{
  id: string
  name: string
  niche: string
  handles: Record<Platform, string>
  followers: Record<Platform, number>
  monetization: Record<Platform, Account['monetization']>
}> = [
  {
    id: 'p-vela',
    name: 'Vela',
    niche: 'Home espresso & cafe routines',
    handles: { instagram: '@vela.brews', tiktok: '@velabrews', youtube: '@velabrews' },
    followers: { instagram: 48200, tiktok: 91400, youtube: 12600 },
    monetization: { instagram: 'none', tiktok: 'rejected', youtube: 'active' },
  },
  {
    id: 'p-sola',
    name: 'Sola',
    niche: 'Small-space plant care',
    handles: { instagram: '@sola.grows', tiktok: '@solagrows', youtube: '@solagrows' },
    followers: { instagram: 22800, tiktok: 40100, youtube: 5400 },
    monetization: { instagram: 'none', tiktok: 'applied', youtube: 'applied' },
  },
  {
    id: 'p-nori',
    name: 'Nori',
    niche: 'Weeknight one-pan cooking',
    handles: { instagram: '@nori.onepan', tiktok: '@norionepan', youtube: '@norionepan' },
    followers: { instagram: 15300, tiktok: 18700, youtube: 2100 },
    monetization: { instagram: 'none', tiktok: 'none', youtube: 'none' },
  },
]

/** Briefs and captions are per-persona so the mock reads like one studio's feed
 *  rather than a shuffle — the niche has to match the post or the console lies. */
const CONTENT: Record<string, { briefs: string[]; captions: string[] }> = {
  'p-vela': {
    briefs: [
      '60s: dialling in a new bag — grind, dose, yield on screen, no voiceover',
      'Carousel: 5 espresso faults and the one dial change that fixes each',
      '45s: why your shot runs fast, filmed through the naked portafilter',
      '35s: puck prep, three steps, nothing bought',
      'Carousel: the four numbers to write on every bag',
    ],
    captions: [
      'dialled this bag in at 1:2.3 — 27s, tasted like blackcurrant',
      '5 faults, 5 fixes. save this for your next bag',
      'channelling, filmed from underneath. grind finer.',
      'puck prep in three steps. no gadgets.',
      'write these four numbers on the bag and stop guessing',
      'same bag, day 4 vs day 14. rest matters.',
    ],
  },
  'p-sola': {
    briefs: [
      '45s: repotting a root-bound pothos, hands-only, captions carry the steps',
      'Carousel: light map of a north-facing flat, plant per window',
      '30s: the three plants that actually survive a dark bathroom',
      '40s: how to tell thirst from rot before you lose the plant',
      'Carousel: five plants I stopped recommending, and why',
    ],
    captions: [
      'root-bound pothos, 4 minutes, no mess',
      'north-facing flat light map — where each plant actually goes',
      'dark bathroom, three plants that will not die',
      'thirsty or rotting? check here first',
      'five plants I stopped recommending',
      'propagation in water vs soil, 6 weeks apart',
    ],
  },
  'p-nori': {
    briefs: [
      '50s: one-pan gnocchi, three ingredients, timer on screen',
      'Carousel: five weeknight pans, each under 15 minutes',
      'Reel: answering the "is this AI" comment directly, on camera-style',
      '45s: the tin of beans dinner, upgraded twice',
      'Carousel: what to keep in the cupboard so there is always a dinner',
    ],
    captions: [
      'one-pan gnocchi, 12 minutes start to plate',
      'five pans, none over 15 minutes. save it.',
      'yes this account is AI-generated. here is how it is made',
      'a tin of beans, twice. second one wins.',
      'the cupboard list. dinner exists on any night.',
      '12 minutes, one pan, two ingredients you already have',
    ],
  },
}

function buildPersonas(): Persona[] {
  return PERSONA_SEEDS.map((seed, i) => ({
    id: seed.id,
    name: seed.name,
    niche: seed.niche,
    createdAt: isoDay(120 + i * 30, new Date()),
    disclosure: {
      bioLabel: 'AI-generated persona · studio-run · not a real person',
      perPostLabel: true,
      platformAiFlag: i !== 2, // Nori is deliberately incomplete: the console flags it
    },
    accounts: PLATFORMS.map((platform) => ({
      platform,
      handle: seed.handles[platform],
      followers: seed.followers[platform],
      monetization: seed.monetization[platform],
    })),
  }))
}

function buildSeries(rand: () => number, personas: Persona[], today: Date) {
  const viewsByPlatform = {} as Record<Platform, MetricPoint[]>
  const totalFollowers = personas.reduce(
    (sum, p) => sum + p.accounts.reduce((s, a) => s + a.followers, 0),
    0,
  )

  for (const platform of PLATFORMS) {
    const share = platform === 'tiktok' ? 0.52 : platform === 'instagram' ? 0.36 : 0.12
    const base = totalFollowers * share * 0.22
    const points: MetricPoint[] = []
    let level = base
    for (let i = DAYS - 1; i >= 0; i--) {
      // Slow drift plus the occasional post that travels further than the rest.
      level = level * (0.97 + rand() * 0.07)
      const spike = rand() > 0.9 ? 1 + rand() * 1.8 : 1
      points.push({ t: isoDay(i, today), value: Math.round(level * spike) })
    }
    viewsByPlatform[platform] = points
  }

  const viewsDaily: MetricPoint[] = viewsByPlatform.instagram.map((p, i) => ({
    t: p.t,
    value: PLATFORMS.reduce((sum, pl) => sum + viewsByPlatform[pl][i].value, 0),
  }))

  return { viewsDaily, viewsByPlatform }
}

function buildPosts(rand: () => number, personas: Persona[], today: Date): Post[] {
  const posts: Post[] = []
  const seen = new Map<string, number>()
  for (let i = 0; i < 24; i++) {
    const persona = personas[i % personas.length]
    const nth = seen.get(persona.id) ?? 0
    seen.set(persona.id, nth + 1)
    const platform = PLATFORMS[i % PLATFORMS.length]
    const views = Math.round(2000 + rand() * 58000)
    posts.push({
      id: `post-${i + 1}`,
      personaId: persona.id,
      platform,
      publishedAt: isoDay(Math.floor(i / 2), today),
      caption: CONTENT[persona.id].captions[nth % CONTENT[persona.id].captions.length],
      views,
      likes: Math.round(views * (0.03 + rand() * 0.05)),
      comments: Math.round(views * (0.001 + rand() * 0.004)),
      saves: Math.round(views * (0.004 + rand() * 0.012)),
      disclosed: true,
    })
  }
  return posts
}

/**
 * Placeholder thumbnails, so the mock demonstrates review-with-an-asset rather
 * than leaving every item blocked on a file that cannot exist offline. Tiny
 * gradients, deliberately not pretending to be generated content.
 */
const PLACEHOLDER_PNG = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAAICAIAAABVpBlvAAAAfElEQVR42gXBIQ4AIAgAQP5sMFgMBoubFjYDxY3CaNKwGv2Td/AwPAqPw9PwLDwPcDFeipfj1XgtXo9wMB1Kh9PRdCwdT7Axb8qb89a8LW/PIFiEinARLWJFvMDCuqgurkvrsrq8wsQ2qU1uU9u0Nr1Bx9FpdB5dR7fRfXym71i3d9OnKwAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAAICAIAAABVpBlvAAAAfUlEQVR42gXBIRYAEAwA0J1uYWFhYWHXkDRN8RRPmkTTRM3R/A8YCoXCoUgoGoqFAhgbxcaxSWwam8UGmJySc3JJrsktOWCelCfnKXlqnpYnYN1UN9ctdWvdVjdgP9QP9yP9aD/WD+C4NC6PK+PquDYu4Hq0Hq8n6+l6tt4HRstIHwcBitgAAAAASUVORK5CYII=',
]

function placeholderAssets(itemId: string, index: number): QueueAsset[] {
  return [
    {
      id: `${itemId}/frame-01.png`,
      filename: 'frame-01.png',
      url: PLACEHOLDER_PNG[index % PLACEHOLDER_PNG.length],
      kind: 'image',
      contentType: 'image/png',
      bytes: 183,
    },
  ]
}

function buildQueue(rand: () => number, personas: Persona[], today: Date): QueueItem[] {
  const states: QueueState[] = [
    'review', 'review', 'review', 'scheduled', 'scheduled',
    'generating', 'brief', 'brief', 'published', 'rejected',
  ]
  const seen = new Map<string, number>()
  return states.map((state, i) => {
    const persona = personas[i % personas.length]
    const nth = seen.get(persona.id) ?? 0
    seen.set(persona.id, nth + 1)
    const item: QueueItem = {
      id: `q-${i + 1}`,
      personaId: persona.id,
      brief: CONTENT[persona.id].briefs[nth % CONTENT[persona.id].briefs.length],
      state,
      generator: rand() > 0.5 ? 'openart-mcp:flux-1.1' : 'openart-mcp:kling-video',
      createdAt: isoDay(i % 5, today),
      scheduledFor: state === 'scheduled' ? isoDay(-1 - (i % 3), today) : undefined,
      approvedBy: state === 'scheduled' || state === 'published' ? 'you' : undefined,
      rejectionReason:
        state === 'rejected' ? 'Generated hands failed on the pour shot; not publishable' : undefined,
      // A brief has nothing generated yet; everything past it does.
      assets: state === 'brief' ? [] : placeholderAssets(`q-${i + 1}`, i),
    }
    return item
  })
}

function buildRevenue(rand: () => number, today: Date): RevenueEntry[] {
  const entries: RevenueEntry[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDay(i, today)
    // Affiliate trickles most days; the rest are lumpy, which is the honest shape.
    if (rand() > 0.35) {
      entries.push({ date, source: 'affiliate', amountUsd: Math.round(rand() * 46 * 100) / 100 })
    }
    if (rand() > 0.82) {
      entries.push({
        date,
        source: 'own_product',
        amountUsd: Math.round(rand() * 120 * 100) / 100,
        note: 'Dial-in guide (PDF)',
      })
    }
    if (rand() > 0.94) {
      entries.push({
        date,
        source: 'brand_deal',
        amountUsd: 400 + Math.round(rand() * 600),
        note: 'Grinder brand, one Reel + one carousel',
      })
    }
  }
  // Only the YouTube account is actually in a monetisation program.
  entries.push({
    date: isoDay(2, today),
    source: 'creator_fund',
    amountUsd: 61.4,
    note: 'YouTube Shorts (only monetised account of the three)',
  })
  return entries
}

export function buildMockSnapshot(seed = 7, now: Date = new Date('2026-09-18T00:00:00Z')): Snapshot {
  const rand = rng(seed)
  const personas = buildPersonas()
  const { viewsDaily, viewsByPlatform } = buildSeries(rand, personas, now)
  return {
    personas,
    posts: buildPosts(rand, personas, now),
    queue: buildQueue(rand, personas, now),
    revenue: buildRevenue(rand, now),
    viewsDaily,
    viewsByPlatform,
    generatedAt: now.toISOString(),
    isMock: true,
  }
}

export const mockSource: DataSource = {
  name: 'mock',
  async load() {
    return buildMockSnapshot()
  },
}

export const REVENUE_SOURCES: RevenueSource[] = ['brand_deal', 'affiliate', 'own_product', 'creator_fund']
