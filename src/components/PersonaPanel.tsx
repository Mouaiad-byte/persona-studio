import { Persona, Post } from '../data/types'
import { disclosureStatus } from '../lib/disclosure'
import { compactNumber, percent } from '../lib/format'

interface Props {
  personas: Persona[]
  posts: Post[]
}

function engagementRate(posts: Post[]): number {
  const views = posts.reduce((s, p) => s + p.views, 0)
  if (views === 0) return 0
  const actions = posts.reduce((s, p) => s + p.likes + p.comments + p.saves, 0)
  return actions / views
}

export function PersonaPanel({ personas, posts }: Props) {
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
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
