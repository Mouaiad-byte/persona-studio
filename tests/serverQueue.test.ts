import { describe, expect, it } from 'vitest'
import { ACTIONS, addItem, applyTransition, nextId } from '../server/lib/queue.mjs'

const labelled = {
  id: 'p1',
  name: 'Vela',
  disclosure: { bioLabel: 'AI-generated persona', perPostLabel: true, platformAiFlag: true },
}
const unlabelled = {
  id: 'p2',
  name: 'Nori',
  disclosure: { bioLabel: 'AI-generated persona', perPostLabel: true, platformAiFlag: false },
}
const personas = [labelled, unlabelled]

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    personaId: 'p1',
    brief: 'a brief',
    state: 'review',
    generator: 'openart-mcp:flux-1.1',
    createdAt: '2026-09-17',
    ...overrides,
  }
}

describe('applyTransition', () => {
  it('rejects an unknown action', () => {
    expect(() => applyTransition([item()], personas, { id: 'q-1', action: 'yeet' })).toThrow(/unknown action/)
  })

  it('rejects an unknown id', () => {
    expect(() => applyTransition([item()], personas, { id: 'q-9', action: 'submit' })).toThrow(/no queue item/)
  })

  it('refuses an action from the wrong state', () => {
    expect(() =>
      applyTransition([item({ state: 'published' })], personas, { id: 'q-1', action: 'approve', actor: 'you' }),
    ).toThrow(/only from review/)
  })

  it('does not mutate the queue it was given', () => {
    const queue = [item()]
    applyTransition(queue, personas, { id: 'q-1', action: 'approve', actor: 'you' })
    expect(queue[0].state).toBe('review')
    expect(queue[0]).not.toHaveProperty('approvedBy')
  })

  describe('approve', () => {
    it('records the actor and schedules the item', () => {
      const { item: next } = applyTransition([item()], personas, {
        id: 'q-1',
        action: 'approve',
        actor: 'you',
        scheduledFor: '2026-09-20',
      })
      expect(next.state).toBe('scheduled')
      expect(next.approvedBy).toBe('you')
      expect(next.scheduledFor).toBe('2026-09-20')
    })

    it('requires an actor', () => {
      expect(() => applyTransition([item()], personas, { id: 'q-1', action: 'approve', actor: '  ' })).toThrow(
        /requires an actor/,
      )
    })

    it('refuses to approve an item whose persona is not fully labelled', () => {
      const queue = [item({ personaId: 'p2' })]
      expect(() => applyTransition(queue, personas, { id: 'q-1', action: 'approve', actor: 'you' })).toThrow(
        /disclosure incomplete.*platform AI flag/,
      )
    })

    it('clears a previous rejection reason', () => {
      const { item: next } = applyTransition(
        [item({ rejectionReason: 'hands were wrong' })],
        personas,
        { id: 'q-1', action: 'approve', actor: 'you' },
      )
      expect(next).not.toHaveProperty('rejectionReason')
    })
  })

  describe('reject', () => {
    it('requires a reason', () => {
      expect(() => applyTransition([item()], personas, { id: 'q-1', action: 'reject' })).toThrow(/requires a reason/)
    })

    it('records the reason and withdraws any sign-off', () => {
      const { item: next } = applyTransition(
        [item({ state: 'scheduled', approvedBy: 'you', scheduledFor: '2026-09-20' })],
        personas,
        { id: 'q-1', action: 'reject', reason: 'generated hands failed on the pour shot' },
      )
      expect(next.state).toBe('rejected')
      expect(next.rejectionReason).toMatch(/pour shot/)
      expect(next).not.toHaveProperty('approvedBy')
      expect(next).not.toHaveProperty('scheduledFor')
    })
  })

  describe('publish', () => {
    it('publishes an approved, labelled item', () => {
      const { item: next } = applyTransition(
        [item({ state: 'scheduled', approvedBy: 'you' })],
        personas,
        { id: 'q-1', action: 'publish' },
      )
      expect(next.state).toBe('published')
    })

    it('refuses to publish without a sign-off, even from scheduled', () => {
      expect(() =>
        applyTransition([item({ state: 'scheduled' })], personas, { id: 'q-1', action: 'publish' }),
      ).toThrow(/no human sign-off/)
    })

    it('refuses to publish an unlabelled persona', () => {
      expect(() =>
        applyTransition(
          [item({ personaId: 'p2', state: 'scheduled', approvedBy: 'you' })],
          personas,
          { id: 'q-1', action: 'publish' },
        ),
      ).toThrow(/disclosure incomplete/)
    })
  })

  describe('reopen', () => {
    it('returns a rejected item to brief with its history cleared', () => {
      const { item: next } = applyTransition(
        [item({ state: 'rejected', rejectionReason: 'nope' })],
        personas,
        { id: 'q-1', action: 'reopen' },
      )
      expect(next.state).toBe('brief')
      expect(next).not.toHaveProperty('rejectionReason')
    })
  })

  it('covers every declared action', () => {
    expect(ACTIONS.sort()).toEqual(['approve', 'publish', 'reject', 'reopen', 'submit'])
  })
})

describe('addItem', () => {
  it('appends a brief in the brief state', () => {
    const { queue, item: added } = addItem([], personas, { personaId: 'p1', brief: '50s: one-pan gnocchi' })
    expect(queue).toHaveLength(1)
    expect(added.state).toBe('brief')
    expect(added.id).toBe('q-1')
  })

  it('never accepts a pre-approved item', () => {
    const { item: added } = addItem([], personas, {
      personaId: 'p1',
      brief: 'x',
      // @ts-expect-error — deliberately passing something the caller should not control
      state: 'scheduled',
      approvedBy: 'someone',
    })
    expect(added.state).toBe('brief')
    expect(added).not.toHaveProperty('approvedBy')
  })

  it('requires a non-empty brief', () => {
    expect(() => addItem([], personas, { personaId: 'p1', brief: '   ' })).toThrow(/needs a brief/)
  })

  it('requires a known persona', () => {
    expect(() => addItem([], personas, { personaId: 'nope', brief: 'x' })).toThrow(/unknown persona/)
  })
})

describe('nextId', () => {
  it('continues from the highest existing number, not the length', () => {
    expect(nextId([{ id: 'q-1' }, { id: 'q-7' }])).toBe('q-8')
  })

  it('ignores ids that do not match the pattern', () => {
    expect(nextId([{ id: 'yt:abc' }, { id: 'q-2' }])).toBe('q-3')
  })

  it('starts at one for an empty queue', () => {
    expect(nextId([])).toBe('q-1')
  })
})
