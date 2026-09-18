/**
 * Queue state machine.
 *
 * Pure and total: every call either returns a new queue or throws with the
 * reason. The server enforces this on write, so a transition refused in the UI
 * is refused again here — the console is a convenience, not the guard.
 */

import { disclosureStatus, publishGate } from '../../shared/gate.mjs'

/** Which states each action may be applied from, and what it moves to. */
export const TRANSITIONS = {
  // The generated asset exists and is ready for a person to look at.
  submit: { from: ['brief', 'generating'], to: 'review' },
  // A human signs off. This is the only action that sets approvedBy.
  approve: { from: ['review'], to: 'scheduled' },
  reject: { from: ['brief', 'generating', 'review', 'scheduled'], to: 'rejected' },
  publish: { from: ['scheduled'], to: 'published' },
  // A rejection is not a dead end — the brief can be worked again.
  reopen: { from: ['rejected'], to: 'brief' },
}

export const ACTIONS = Object.keys(TRANSITIONS)

/**
 * @param {Array<any>} queue
 * @param {Array<any>} personas
 * @param {{ id: string, action: string, actor?: string, scheduledFor?: string, reason?: string }} request
 * @returns {{ queue: Array<any>, item: any }}
 */
export function applyTransition(queue, personas, request) {
  const { id, action } = request
  const transition = TRANSITIONS[action]
  if (!transition) {
    throw new Error(`unknown action "${action}" — expected one of ${ACTIONS.join(', ')}`)
  }

  const index = queue.findIndex((entry) => entry.id === id)
  if (index === -1) throw new Error(`no queue item with id "${id}"`)

  const current = queue[index]
  if (!transition.from.includes(current.state)) {
    throw new Error(
      `cannot ${action} an item in state "${current.state}" — only from ${transition.from.join(' or ')}`,
    )
  }

  const persona = personas.find((p) => p.id === current.personaId)
  if (!persona) throw new Error(`item "${id}" references unknown persona "${current.personaId}"`)

  /** @type {any} */
  const next = { ...current, state: transition.to }

  if (action === 'approve') {
    const actor = String(request.actor ?? '').trim()
    if (!actor) throw new Error('approve requires an actor — someone has to own the sign-off')

    // Disclosure is checked before the sign-off, not after: approving an
    // unlabelled persona is the exact thing this queue exists to prevent.
    const disclosure = disclosureStatus(persona)
    if (!disclosure.complete) {
      throw new Error(
        `cannot approve: disclosure incomplete for "${persona.name ?? persona.id}" — missing ${disclosure.missing.join(', ')}`,
      )
    }
    next.approvedBy = actor
    if (request.scheduledFor) next.scheduledFor = request.scheduledFor
    delete next.rejectionReason
  }

  if (action === 'reject') {
    const reason = String(request.reason ?? '').trim()
    if (!reason) throw new Error('reject requires a reason — "no" without one is not reviewable later')
    next.rejectionReason = reason
    // A rejected item is no longer signed off.
    delete next.approvedBy
    delete next.scheduledFor
  }

  if (action === 'publish') {
    // Gated on the state it is coming FROM. The gate exempts already-published
    // items from needing a sign-off — checking `next`, which is already
    // 'published', would exempt the very transition being authorised.
    const gate = publishGate(current, persona)
    if (!gate.allowed) {
      throw new Error(`cannot publish: ${gate.reasons.join('; ')}`)
    }
  }

  if (action === 'reopen') {
    delete next.rejectionReason
    delete next.approvedBy
    delete next.scheduledFor
  }

  const updated = [...queue]
  updated[index] = next
  return { queue: updated, item: next }
}

/**
 * Append a new brief.
 *
 * New items always start at `brief` with no sign-off, whatever the caller asks
 * for — there is no way to inject something pre-approved.
 *
 * @param {Array<any>} queue
 * @param {Array<any>} personas
 * @param {{ personaId: string, brief: string, generator?: string, createdAt?: string }} input
 */
export function addItem(queue, personas, input) {
  const brief = String(input.brief ?? '').trim()
  if (!brief) throw new Error('a queue item needs a brief')
  if (!personas.some((p) => p.id === input.personaId)) {
    throw new Error(`unknown persona "${input.personaId}"`)
  }

  const item = {
    id: nextId(queue),
    personaId: input.personaId,
    brief,
    state: 'brief',
    generator: String(input.generator ?? 'unassigned'),
    createdAt: input.createdAt ?? new Date().toISOString().slice(0, 10),
  }
  return { queue: [...queue, item], item }
}

/**
 * Next free `q-N` id. Derived from the highest existing number rather than the
 * queue length, so deleting an item cannot make the next id collide.
 *
 * @param {Array<{id?: string}>} queue
 */
export function nextId(queue) {
  const highest = queue.reduce((max, entry) => {
    const match = /^q-(\d+)$/.exec(String(entry.id ?? ''))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `q-${highest + 1}`
}
