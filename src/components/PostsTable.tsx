import { Persona, PLATFORM_COLOR_VAR, PLATFORM_LABEL, Post } from '../data/types'
import { compactNumber, percent, shortDate } from '../lib/format'

interface Props {
  posts: Post[]
  personas: Persona[]
  limit?: number
}

export function PostsTable({ posts, personas, limit = 8 }: Props) {
  const byId = new Map(personas.map((p) => [p.id, p]))
  const rows = [...posts].sort((a, b) => b.views - a.views).slice(0, limit)

  if (rows.length === 0) {
    return (
      <p className="muted small" style={{ margin: 0 }}>
        Nothing published in this window, or no collector has reported posts yet.
      </p>
    )
  }

  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Caption</th>
          <th scope="col">Persona</th>
          <th scope="col">Platform</th>
          <th scope="col">Published</th>
          <th scope="col" className="num">Views</th>
          <th scope="col" className="num">Engagement</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((post) => (
          <tr key={post.id}>
            <td style={{ maxWidth: 300 }}>
              {post.caption}
              {!post.disclosed && (
                <span className="pill" style={{ marginLeft: 6 }}>
                  <span className="dot" style={{ background: 'var(--critical)' }} />
                  unlabelled
                </span>
              )}
            </td>
            <td className="muted">{byId.get(post.personaId)?.name ?? '—'}</td>
            <td>
              <span className="row" style={{ gap: 6 }}>
                <span className="swatch" style={{ background: PLATFORM_COLOR_VAR[post.platform] }} />
                {PLATFORM_LABEL[post.platform]}
              </span>
            </td>
            <td className="muted mono">{shortDate(post.publishedAt)}</td>
            <td className="num">{compactNumber(post.views)}</td>
            <td className="num">
              {percent((post.likes + post.comments + post.saves) / Math.max(post.views, 1))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
