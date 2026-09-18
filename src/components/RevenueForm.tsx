import { useState } from 'react'
import { REVENUE_LABEL, RevenueSource } from '../data/types'

const SOURCES: RevenueSource[] = ['brand_deal', 'affiliate', 'own_product', 'creator_fund']

interface Props {
  onSubmit: (entry: { date: string; source: RevenueSource; amountUsd: number; note?: string }) => Promise<void>
}

/**
 * Add a revenue entry.
 *
 * Append-only by design: this writes a line to the ledger and never edits one.
 * The rows that matter most here — a brand deal, a product sale — are the ones
 * no API will ever report, so the alternative is remembering to open a CSV.
 */
export function RevenueForm({ onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [source, setSource] = useState<RevenueSource>('brand_deal')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
        Add entry
      </button>
    )
  }

  const amountValue = Number(amount)
  const valid = amount.trim() !== '' && Number.isFinite(amountValue) && amountValue >= 0

  return (
    <div className="stack" style={{ gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
      <div className="grid cols-2" style={{ gap: 8 }}>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
        </label>
        <label className="field">
          <span>Source</span>
          <select
            value={source}
            disabled={busy}
            onChange={(e) => setSource(e.target.value as RevenueSource)}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {REVENUE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Amount (USD)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          placeholder="600"
          disabled={busy}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Note</span>
        <input
          value={note}
          placeholder="grinder brand — one Reel, one carousel"
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && (
        <p className="small" role="alert" style={{ margin: 0, color: 'var(--critical)' }}>
          {error}
        </p>
      )}

      <div className="row" style={{ gap: 6 }}>
        <button
          className="ghost-btn"
          disabled={busy || !valid}
          onClick={async () => {
            setError(null)
            setBusy(true)
            try {
              await onSubmit({ date, source, amountUsd: amountValue, note: note.trim() || undefined })
              setAmount('')
              setNote('')
              setOpen(false)
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="ghost-btn" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
