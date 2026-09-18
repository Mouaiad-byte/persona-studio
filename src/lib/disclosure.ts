import { Persona, QueueItem } from '../data/types'
import {
  blockedCount as blockedCountImpl,
  disclosureStatus as disclosureStatusImpl,
  publishGate as publishGateImpl,
} from '../../shared/gate.mjs'

/**
 * Typed surface over the shared gate in `shared/gate.mjs`.
 *
 * The rule itself is not implemented here: the collector enforces the same
 * function when it accepts a transition, and a second copy of it would drift
 * from this one. This file only puts the project's types on it.
 */

export interface DisclosureStatus {
  complete: boolean
  missing: string[]
}

export interface PublishGate {
  allowed: boolean
  reasons: string[]
}

export function disclosureStatus(persona: Persona): DisclosureStatus {
  return disclosureStatusImpl(persona) as DisclosureStatus
}

export function publishGate(item: QueueItem, persona: Persona | undefined): PublishGate {
  return publishGateImpl(item, persona) as PublishGate
}

export function blockedCount(queue: QueueItem[], personas: Persona[]): number {
  return blockedCountImpl(queue, personas) as number
}
