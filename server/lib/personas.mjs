/**
 * Persona edits.
 *
 * Only disclosure is editable here, and deliberately so: it is the field that
 * blocks publishing, and having to hand-edit JSON to clear your own gate is how
 * a gate ends up disabled instead of satisfied. Niches, handles and channel ids
 * stay in the file, where they are set once and rarely change.
 */

/**
 * @param {Array<any>} personas
 * @param {string} id
 * @param {{ bioLabel?: unknown, perPostLabel?: unknown, platformAiFlag?: unknown }} patch
 * @returns {{ personas: Array<any>, persona: any }}
 */
export function updateDisclosure(personas, id, patch) {
  const index = personas.findIndex((persona) => persona.id === id)
  if (index === -1) throw new Error(`unknown persona "${id}"`)

  const current = personas[index]
  const next = { ...current.disclosure }

  if ('bioLabel' in patch) {
    if (typeof patch.bioLabel !== 'string') {
      throw new Error('bioLabel must be text')
    }
    const trimmed = patch.bioLabel.trim()
    if (trimmed.length > 300) throw new Error('bioLabel is longer than 300 characters')
    next.bioLabel = trimmed
  }

  for (const flag of ['perPostLabel', 'platformAiFlag']) {
    if (flag in patch) {
      if (typeof patch[flag] !== 'boolean') {
        throw new Error(`${flag} must be true or false`)
      }
      next[flag] = patch[flag]
    }
  }

  const persona = { ...current, disclosure: next }
  const updated = [...personas]
  updated[index] = persona
  return { personas: updated, persona }
}
