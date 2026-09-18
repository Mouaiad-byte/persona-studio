import { QueueAsset, QueueItem } from './types'
// Pure module, no node imports — the allowlist lives once and both sides use it.
import { ALLOWED_EXTENSIONS, safeFilename } from '../../server/lib/assets.mjs'

export const ACCEPT_ATTRIBUTE: string = (ALLOWED_EXTENSIONS as string[]).join(',')

/**
 * Queue mutations against the local collector.
 *
 * The server re-runs the same gate on every call, so anything refused here is
 * refused there too. These helpers surface the server's own message rather than
 * a generic failure — "cannot approve: disclosure incomplete … missing platform
 * AI flag" is the whole point.
 */

export type QueueAction = 'submit' | 'approve' | 'reject' | 'publish' | 'reopen'

export interface TransitionRequest {
  id: string
  action: QueueAction
  actor?: string
  scheduledFor?: string
  reason?: string
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`collector returned ${response.status}: ${text.slice(0, 200)}`)
  }
  if (!response.ok) {
    const message = (parsed as { error?: string })?.error
    throw new Error(message ?? `collector returned ${response.status}`)
  }
  return parsed as T
}

export function addBrief(input: {
  personaId: string
  brief: string
  generator?: string
}): Promise<{ item: QueueItem }> {
  return post('/api/queue', input)
}

export function transition(request: TransitionRequest): Promise<{ item: QueueItem }> {
  return post('/api/queue/transition', request)
}

/**
 * Actions offered for a given state. Mirrors TRANSITIONS in
 * server/lib/queue.mjs; the server is still the authority.
 */
export function actionsFor(state: QueueItem['state']): QueueAction[] {
  switch (state) {
    case 'brief':
    case 'generating':
      return ['submit', 'reject']
    case 'review':
      return ['approve', 'reject']
    case 'scheduled':
      return ['publish', 'reject']
    case 'rejected':
      return ['reopen']
    case 'published':
      return []
  }
}

/**
 * Upload one generated file against a queue item.
 *
 * The filename travels in a header rather than a multipart body — a raw body
 * needs no parser on either side. That does mean the header has to be
 * ASCII-safe, so the name is checked here first: a browser throws on a
 * non-ASCII header value, which would surface as an unhelpful network error
 * instead of the real reason.
 */
export async function uploadAsset(itemId: string, file: File): Promise<{ asset: QueueAsset }> {
  try {
    safeFilename(file.name)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }

  const response = await fetch(`/api/queue/${encodeURIComponent(itemId)}/asset`, {
    method: 'POST',
    headers: {
      'x-filename': file.name,
      'content-type': file.type || 'application/octet-stream',
    },
    body: file,
  })
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`collector returned ${response.status}: ${text.slice(0, 200)}`)
  }
  if (!response.ok) {
    throw new Error((parsed as { error?: string })?.error ?? `collector returned ${response.status}`)
  }
  return parsed as { asset: QueueAsset }
}
