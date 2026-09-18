import { Coverage, DataSource, MetricPoint, PLATFORMS, Platform, Snapshot } from './types'

/**
 * Reads the snapshot the local collector serves.
 *
 * Everything crossing this boundary is validated before the console draws it.
 * A dashboard's whole job is to be trusted, so a malformed payload has to fail
 * loudly here rather than render as a plausible-looking zero.
 */

function fail(path: string, message: string): never {
  throw new Error(`snapshot.${path} ${message}`)
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  return value
}

function asPoints(value: unknown, path: string): MetricPoint[] {
  return asArray(value, path).map((raw, i) => {
    const point = raw as Partial<MetricPoint>
    if (typeof point?.t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(point.t)) {
      fail(`${path}[${i}].t`, 'must be a YYYY-MM-DD date')
    }
    if (typeof point.value !== 'number' || !Number.isFinite(point.value)) {
      fail(`${path}[${i}].value`, 'must be a finite number')
    }
    return { t: point.t, value: point.value }
  })
}

/**
 * Validate a payload into a Snapshot, or throw explaining exactly what is wrong.
 * Exported because this is the contract a custom source has to satisfy, and it
 * is worth asserting against in tests rather than discovering in the UI.
 */
export function validateSnapshot(value: unknown): Snapshot {
  if (typeof value !== 'object' || value === null) fail('', 'must be an object')
  const raw = value as Record<string, unknown>

  const viewsDaily = asPoints(raw.viewsDaily, 'viewsDaily')

  const viewsByPlatform = {} as Record<Platform, MetricPoint[]>
  const byPlatform = (raw.viewsByPlatform ?? {}) as Record<string, unknown>
  for (const platform of PLATFORMS) {
    const points = asPoints(byPlatform[platform] ?? [], `viewsByPlatform.${platform}`)
    if (points.length !== viewsDaily.length) {
      fail(
        `viewsByPlatform.${platform}`,
        `has ${points.length} points but viewsDaily has ${viewsDaily.length} — series must share dates`,
      )
    }
    points.forEach((point, i) => {
      if (point.t !== viewsDaily[i].t) {
        fail(`viewsByPlatform.${platform}[${i}].t`, `is ${point.t} but viewsDaily[${i}].t is ${viewsDaily[i].t}`)
      }
    })
    viewsByPlatform[platform] = points
  }

  if (typeof raw.isMock !== 'boolean') fail('isMock', 'must be a boolean — say whether these numbers are real')

  return {
    personas: asArray(raw.personas, 'personas') as Snapshot['personas'],
    posts: asArray(raw.posts, 'posts') as Snapshot['posts'],
    queue: asArray(raw.queue, 'queue') as Snapshot['queue'],
    revenue: asArray(raw.revenue, 'revenue') as Snapshot['revenue'],
    viewsDaily,
    viewsByPlatform,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    isMock: raw.isMock,
    coverage: raw.coverage === undefined ? undefined : (asArray(raw.coverage, 'coverage') as Coverage[]),
  }
}

/**
 * @param baseUrl where the collector lives. Empty string uses the Vite dev
 *        proxy, which is the normal case.
 */
export function createHttpSource(baseUrl = ''): DataSource {
  return {
    name: 'collector',
    async load() {
      const response = await fetch(`${baseUrl}/api/snapshot`)
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`collector returned ${response.status}: ${body.slice(0, 200)}`)
      }
      return validateSnapshot(await response.json())
    },
  }
}

export const httpSource = createHttpSource()
