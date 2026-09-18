import { Disclosure, Persona } from './types'

/**
 * Persona disclosure edits.
 *
 * Only disclosure is editable from the console: it is the field that blocks
 * publishing, and having to hand-edit JSON to clear your own gate is how a gate
 * ends up disabled rather than satisfied.
 */
export async function updateDisclosure(
  personaId: string,
  patch: Partial<Disclosure>,
): Promise<{ persona: Persona }> {
  const response = await fetch(`/api/personas/${encodeURIComponent(personaId)}/disclosure`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
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
  return parsed as { persona: Persona }
}
