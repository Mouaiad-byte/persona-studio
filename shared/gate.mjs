/**
 * The publish gate — the one place that decides what may go out.
 *
 * Shared verbatim between the console and the collector: the frontend uses it to
 * show why an item is blocked, the server uses it to refuse the transition. Two
 * copies of this rule would drift, and the drift would end with something
 * publishing that should not have.
 */

/**
 * A persona is publishable when a viewer can tell it is AI without doing any
 * work: a label in the bio, a label on the post, and the platform's own AI flag
 * set. All three, because each covers a different surface where someone meets
 * the account.
 *
 * @param {{ disclosure?: { bioLabel?: string, perPostLabel?: boolean, platformAiFlag?: boolean } }} persona
 * @returns {{ complete: boolean, missing: string[] }}
 */
export function disclosureStatus(persona) {
  const disclosure = persona?.disclosure ?? {}
  const missing = []
  if (!String(disclosure.bioLabel ?? '').trim()) missing.push('bio label')
  if (!disclosure.perPostLabel) missing.push('per-post label')
  if (!disclosure.platformAiFlag) missing.push('platform AI flag')
  return { complete: missing.length === 0, missing }
}

/**
 * Whether one queue item may publish, and every reason it may not.
 *
 * @param {{ state: string, approvedBy?: string }} item
 * @param {object | undefined} persona
 * @returns {{ allowed: boolean, reasons: string[] }}
 */
export function publishGate(item, persona) {
  if (!persona) return { allowed: false, reasons: ['persona not found'] }

  const reasons = []
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

/**
 * Open items that cannot publish as they stand.
 *
 * @param {Array<{state: string, personaId: string, approvedBy?: string}>} queue
 * @param {Array<{id: string}>} personas
 */
export function blockedCount(queue, personas) {
  const byId = new Map(personas.map((p) => [p.id, p]))
  return queue.filter(
    (item) =>
      item.state !== 'published' &&
      item.state !== 'rejected' &&
      !publishGate(item, byId.get(item.personaId)).allowed,
  ).length
}
