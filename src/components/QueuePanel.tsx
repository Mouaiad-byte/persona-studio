import { Persona, QueueItem, QueueState } from '../data/types'
import { publishGate } from '../lib/disclosure'
import { shortDate } from '../lib/format'

const STATE_LABEL: Record<QueueState, string> = {
  brief: 'Brief',
  generating: 'Generating',
  review: 'Needs review',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
}

const STATE_COLOR: Record<QueueState, string> = {
  brief: 'var(--text-muted)',
  generating: 'var(--warning)',
  review: 'var(--serious)',
  scheduled: 'var(--good)',
  published: 'var(--good)',
  rejected: 'var(--critical)',
}

interface Props {
  queue: QueueItem[]
  personas: Persona[]
}

/**
 * The queue is the product. Nothing leaves it without a human sign-off and a
 * complete disclosure record, and the blocked reason is shown rather than hidden.
 */
export function QueuePanel({ queue, personas }: Props) {
  const byId = new Map(personas.map((p) => [p.id, p]))
  const open = queue.filter((q) => q.state !== 'published' && q.state !== 'rejected')

  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Brief</th>
          <th scope="col">Persona</th>
          <th scope="col">Generator</th>
          <th scope="col">State</th>
          <th scope="col">Publishable</th>
        </tr>
      </thead>
      <tbody>
        {open.map((item) => {
          const persona = byId.get(item.personaId)
          const gate = publishGate(item, persona)
          return (
            <tr key={item.id}>
              <td style={{ maxWidth: 320 }}>{item.brief}</td>
              <td className="muted">{persona?.name ?? '—'}</td>
              <td className="muted small mono">{item.generator}</td>
              <td>
                <span className="pill">
                  <span className="dot" style={{ background: STATE_COLOR[item.state] }} />
                  {STATE_LABEL[item.state]}
                  {item.scheduledFor ? ` · ${shortDate(item.scheduledFor)}` : ''}
                </span>
              </td>
              <td className={gate.allowed ? '' : 'muted small'}>
                {gate.allowed ? (
                  <span className="pill">
                    <span className="dot" style={{ background: 'var(--good)' }} />
                    cleared
                  </span>
                ) : (
                  gate.reasons.join(' · ')
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
