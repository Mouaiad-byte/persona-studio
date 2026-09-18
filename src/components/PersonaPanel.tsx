import { useState } from 'react'
import { Disclosure, Persona, Post } from '../data/types'
import { disclosureStatus } from '../lib/disclosure'
import { compactNumber, percent } from '../lib/format'

interface Props {
  personas: Persona[]
  posts: Post[]
  canWrite?: boolean
  busyId?: string | null
  onDisclosureChange?: (persona: Persona, patch: Partial<Disclosure>) => void
}

function engagementRate(posts: Post[]): number {
  const views = posts.reduce((s, p) => s + p.views, 0)
  if (views === 0) return 0
  const actions = posts.reduce((s, p) => s + p.likes + p.comments + p.saves, 0)
  return actions / views
}

export function PersonaPanel({ personas, posts, canWrite, busyId, onDisclosureChange }: Props) {
  if (personas.length === 0) {
    return (
      <p className="muted small" style={{ margin: 0 }}>
        No personas configured. Copy <code>data/personas.example.json</code> to{' '}
        <code>data/personas.json</code> and put your channel id in <code>externalId</code>.
      </p>
    )
  }

  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Persona</th>
          <th scope="col">Niche</th>
          <th scope="col" className="num">Followers</th>
          <th scope="col" className="num">30d views</th>
          <th scope="col" className="num">Engagement</th>
          <th scope="col">Disclosure</th>
        </tr>
      </thead>
      <tbody>
        {personas.map((persona) => {
          const own = posts.filter((p) => p.personaId === persona.id)
          const followers = persona.accounts.reduce((s, a) => s + a.followers, 0)
          const status = disclosureStatus(persona)
          return (
            <tr key={persona.id}>
              <th scope="row" style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'none', fontSize: 13, letterSpacing: 0 }}>
                {persona.name}
              </th>
              <td className="muted">{persona.niche}</td>
              <td className="num">{compactNumber(followers)}</td>
              <td className="num">{compactNumber(own.reduce((s, p) => s + p.views, 0))}</td>
              <td className="num">{percent(engagementRate(own))}</td>
              <td>
                {status.complete ? (
                  <span className="pill">
                    <span className="dot" style={{ background: 'var(--good)' }} />
                    labelled
                  </span>
                ) : (
                  <span className="pill" title={status.missing.join(', ')}>
                    <span className="dot" style={{ background: 'var(--critical)' }} />
                    missing {status.missing.join(', ')}
                  </span>
                )}
                {canWrite && onDisclosureChange && (
                  <DisclosureEditor
                    persona={persona}
                    busy={busyId === persona.id}
                    onChange={(patch) => onDisclosureChange(persona, patch)}
                  />
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * Fixing disclosure where it is reported. The alternative — telling someone
 * their persona is blocked and then making them edit JSON — is how a gate ends
 * up switched off instead of satisfied.
 */
function DisclosureEditor({
  persona,
  busy,
  onChange,
}: {
  persona: Persona
  busy: boolean
  onChange: (patch: Partial<Disclosure>) => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(persona.disclosure.bioLabel)

  if (!open) {
    return (
      <button
        className="ghost-btn"
        style={{ marginTop: 6, display: 'block' }}
        onClick={() => setOpen(true)}
      >
        Edit labels
      </button>
    )
  }

  return (
    <div className="stack" style={{ gap: 6, marginTop: 8, opacity: busy ? 0.55 : 1 }}>
      <label className="row small" style={{ gap: 6 }}>
        <input
          type="checkbox"
          checked={persona.disclosure.perPostLabel}
          disabled={busy}
          onChange={(e) => onChange({ perPostLabel: e.target.checked })}
        />
        per-post AI label
      </label>
      <label className="row small" style={{ gap: 6 }}>
        <input
          type="checkbox"
          checked={persona.disclosure.platformAiFlag}
          disabled={busy}
          onChange={(e) => onChange({ platformAiFlag: e.target.checked })}
        />
        platform AI flag
      </label>
      <input
        value={label}
        disabled={busy}
        placeholder="AI label shown in the profile bio"
        style={{ fontSize: 12 }}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (label !== persona.disclosure.bioLabel) onChange({ bioLabel: label })
        }}
      />
      <button className="ghost-btn" onClick={() => setOpen(false)}>
        Done
      </button>
    </div>
  )
}
