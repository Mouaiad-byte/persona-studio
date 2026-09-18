import { QueueItem } from './types'

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
