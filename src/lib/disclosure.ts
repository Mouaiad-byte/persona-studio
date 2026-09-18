import { Persona, QueueItem } from '../data/types'

export interface DisclosureStatus {
  complete: boolean
  missing: string[]
}

/**
 * A persona is publishable when a viewer can tell it is AI without doing any
 * work: a label in the bio, a label on the post, and the platform's own AI flag
 * set. All three, because each one covers a different surface where someone
 * meets the account.
 */
export function disclosureStatus(persona: Persona): DisclosureStatus {
  const missing: string[] = []
  if (!persona.disclosure.bioLabel.trim()) missing.push('bio label')
  if (!persona.disclosure.perPostLabel) missing.push('per-post label')
  if (!persona.disclosure.platformAiFlag) missing.push("platform AI flag")
  return { complete: missing.length === 0, missing }
}

export interface PublishGate {
  allowed: boolean
  reasons: string[]
}

/**
 * The gate every queue item passes before it can be scheduled. Held in one
 * function so there is exactly one place that decides what may publish.
 */
export function publishGate(item: QueueItem, persona: Persona | undefined): PublishGate {
  const reasons: string[] = []
  if (!persona) {
    return { allowed: false, reasons: ['persona not found'] }
  }
  const disclosure = disclosureStatus(persona)
  if (!disclosure.complete) {
    reasons.push(`disclosure incomplete: ${disclosure.missing.join(', ')}`)
  }
  if (item.state === 'brief' || item.state === 'generating') {
    reasons.push('nothing generated yet')
  }
  if (!item.approvedBy && item.state !== 'published') {
    reasons.push('no human sign-off')
  }
  return { allowed: reasons.length === 0, reasons }
}

export function blockedCount(queue: QueueItem[], personas: Persona[]): number {
  const byId = new Map(personas.map((p) => [p.id, p]))
  return queue.filter(
    (item) =>
      item.state !== 'published' &&
      item.state !== 'rejected' &&
      !publishGate(item, byId.get(item.personaId)).allowed,
  ).length
}
