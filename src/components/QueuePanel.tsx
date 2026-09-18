import { Persona, QueueItem, QueueState } from '../data/types'
import { publishGate } from '../lib/disclosure'
import { shortDate } from '../lib/format'
import { ACCEPT_ATTRIBUTE, QueueAction, actionsFor } from '../data/queueApi'
import { AssetStrip } from './AssetStrip'

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

const ACTION_LABEL: Record<QueueAction, string> = {
  submit: 'Ready for review',
  approve: 'Approve',
  reject: 'Reject',
  publish: 'Mark published',
  reopen: 'Reopen',
}

interface Props {
  queue: QueueItem[]
  personas: Persona[]
  /** False when running on the mock, which has no server to write to. */
  canWrite: boolean
  busyId?: string | null
  onAction?: (item: QueueItem, action: QueueAction) => void
  onAttach?: (item: QueueItem, file: File) => void
}

/**
 * The queue is the product. Nothing leaves it without a human sign-off and a
 * complete disclosure record, and the blocked reason is shown rather than
 * hidden. Published items drop out; rejected ones stay, because a rejection
 * should be reworkable rather than lost.
 */
export function QueuePanel({ queue, personas, canWrite, busyId, onAction, onAttach }: Props) {
  const byId = new Map(personas.map((p) => [p.id, p]))
  const open = queue.filter((q) => q.state !== 'published')

  if (open.length === 0) {
    return (
      <p className="muted small" style={{ margin: 0 }}>
        Queue is empty. Write a brief on the Studio screen, or add items to <code>data/queue.json</code>.
      </p>
    )
  }

  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Asset</th>
          <th scope="col">Brief</th>
          <th scope="col">Persona</th>
          <th scope="col">State</th>
          <th scope="col">Publishable</th>
          {canWrite && <th scope="col">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {open.map((item) => {
          const persona = byId.get(item.personaId)
          const gate = publishGate(item, persona)
          const busy = busyId === item.id
          return (
            <tr key={item.id} style={{ opacity: busy ? 0.55 : 1 }}>
              <td>
                <AssetStrip assets={item.assets ?? []} />
              </td>
              <td style={{ maxWidth: 280 }}>
                {item.brief}
                <div className="muted small mono" style={{ marginTop: 2 }}>{item.generator}</div>
                {item.rejectionReason && (
                  <div className="small" style={{ color: 'var(--critical)', marginTop: 2 }}>
                    {item.rejectionReason}
                  </div>
                )}
              </td>
              <td className="muted">{persona?.name ?? '—'}</td>
              <td>
                <span className="pill">
                  <span className="dot" style={{ background: STATE_COLOR[item.state] }} />
                  {STATE_LABEL[item.state]}
                  {item.scheduledFor ? ` · ${shortDate(item.scheduledFor)}` : ''}
                </span>
                {item.approvedBy && (
                  <div className="muted small" style={{ marginTop: 2 }}>by {item.approvedBy}</div>
                )}
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
              {canWrite && (
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {actionsFor(item.state).map((action) => (
                      <button
                        key={action}
                        className="ghost-btn"
                        disabled={busy}
                        onClick={() => onAction?.(item, action)}
                      >
                        {ACTION_LABEL[action]}
                      </button>
                    ))}
                    {item.state !== 'published' && onAttach && (
                      <label className="attach-label">
                        Attach
                        <input
                          type="file"
                          accept={ACCEPT_ATTRIBUTE}
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            // Reset so re-picking the same file fires onChange again.
                            e.target.value = ''
                            if (file) onAttach(item, file)
                          }}
                        />
                      </label>
                    )}
                  </div>
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
