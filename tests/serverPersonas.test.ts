import { describe, expect, it } from 'vitest'
import { updateDisclosure } from '../server/lib/personas.mjs'

const personas = [
  {
    id: 'p1',
    name: 'Vela',
    niche: 'espresso',
    disclosure: { bioLabel: 'AI-generated persona', perPostLabel: true, platformAiFlag: false },
    accounts: [{ platform: 'youtube', handle: '@a' }],
  },
]

describe('updateDisclosure', () => {
  it('sets a flag without touching the others', () => {
    const { persona } = updateDisclosure(personas, 'p1', { platformAiFlag: true })
    expect(persona.disclosure).toEqual({
      bioLabel: 'AI-generated persona',
      perPostLabel: true,
      platformAiFlag: true,
    })
  })

  it('leaves everything outside disclosure alone', () => {
    const { persona } = updateDisclosure(personas, 'p1', { platformAiFlag: true })
    expect(persona.niche).toBe('espresso')
    expect(persona.accounts).toEqual(personas[0].accounts)
  })

  it('does not mutate the personas it was given', () => {
    updateDisclosure(personas, 'p1', { platformAiFlag: true })
    expect(personas[0].disclosure.platformAiFlag).toBe(false)
  })

  it('trims the bio label', () => {
    const { persona } = updateDisclosure(personas, 'p1', { bioLabel: '  AI-generated · studio-run  ' })
    expect(persona.disclosure.bioLabel).toBe('AI-generated · studio-run')
  })

  it('rejects a non-boolean flag rather than coercing it', () => {
    // 'false' and 0 are the values that would silently disable a gate.
    expect(() => updateDisclosure(personas, 'p1', { perPostLabel: 'false' })).toThrow(/true or false/)
    expect(() => updateDisclosure(personas, 'p1', { platformAiFlag: 0 })).toThrow(/true or false/)
  })

  it('rejects a non-string bio label', () => {
    expect(() => updateDisclosure(personas, 'p1', { bioLabel: 42 })).toThrow(/must be text/)
  })

  it('rejects an over-long bio label', () => {
    expect(() => updateDisclosure(personas, 'p1', { bioLabel: 'a'.repeat(400) })).toThrow(/longer than/)
  })

  it('rejects an unknown persona', () => {
    expect(() => updateDisclosure(personas, 'nope', { perPostLabel: true })).toThrow(/unknown persona/)
  })

  it('accepts an empty bio label, which the gate then blocks on', () => {
    const { persona } = updateDisclosure(personas, 'p1', { bioLabel: '   ' })
    expect(persona.disclosure.bioLabel).toBe('')
  })
})
