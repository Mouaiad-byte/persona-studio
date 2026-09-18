import { describe, expect, it } from 'vitest'
import { Persona, QueueItem } from '../src/data/types'
import { blockedCount, disclosureStatus, publishGate } from '../src/lib/disclosure'

function persona(overrides: Partial<Persona['disclosure']> = {}): Persona {
  return {
    id: 'p1',
    name: 'Test',
    niche: 'testing',
    createdAt: '2026-01-01',
    disclosure: {
      bioLabel: 'AI-generated persona',
      perPostLabel: true,
      platformAiFlag: true,
      ...overrides,
    },
    accounts: [],
  }
}

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'q1',
    personaId: 'p1',
    brief: 'a brief',
    state: 'review',
    generator: 'openart-mcp:flux-1.1',
    createdAt: '2026-01-01',
    assets: [{ id: 'q1/frame.png', filename: 'frame.png', url: '/api/assets/q1/frame.png', kind: 'image' }],
    ...overrides,
  }
}

describe('disclosureStatus', () => {
  it('passes when all three surfaces are labelled', () => {
    expect(disclosureStatus(persona()).complete).toBe(true)
  })

  it('names each missing surface', () => {
    const status = disclosureStatus(persona({ bioLabel: '  ', perPostLabel: false, platformAiFlag: false }))
    expect(status.complete).toBe(false)
    expect(status.missing).toEqual(['bio label', 'per-post label', 'platform AI flag'])
  })
})

describe('publishGate', () => {
  it('blocks an item with no human sign-off', () => {
    const gate = publishGate(item(), persona())
    expect(gate.allowed).toBe(false)
    expect(gate.reasons).toContain('no human sign-off')
  })

  it('blocks an approved item whose persona is not fully labelled', () => {
    const gate = publishGate(item({ approvedBy: 'you' }), persona({ platformAiFlag: false }))
    expect(gate.allowed).toBe(false)
    expect(gate.reasons[0]).toContain('platform AI flag')
  })

  it('blocks an item with nothing attached to look at', () => {
    const gate = publishGate(item({ approvedBy: 'you', assets: [] }), persona())
    expect(gate.allowed).toBe(false)
    expect(gate.reasons).toContain('no asset attached')
  })

  it('blocks a brief that has not been generated yet', () => {
    const gate = publishGate(item({ state: 'brief', approvedBy: 'you' }), persona())
    expect(gate.reasons).toContain('nothing generated yet')
  })

  it('clears an approved, generated item on a labelled persona', () => {
    const gate = publishGate(item({ state: 'scheduled', approvedBy: 'you' }), persona())
    expect(gate.allowed).toBe(true)
  })

  it('blocks when the persona is missing entirely', () => {
    expect(publishGate(item(), undefined).allowed).toBe(false)
  })
})

describe('blockedCount', () => {
  it('counts only open items that cannot publish', () => {
    const personas = [persona()]
    const queue = [
      item({ id: 'a', state: 'review' }),
      item({ id: 'b', state: 'scheduled', approvedBy: 'you' }),
      item({ id: 'c', state: 'published', approvedBy: 'you' }),
      item({ id: 'd', state: 'rejected' }),
    ]
    expect(blockedCount(queue, personas)).toBe(1)
  })
})
