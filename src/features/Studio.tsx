import { useMemo, useState } from 'react'
import { Persona, Snapshot } from '../data/types'
import { disclosureStatus } from '../lib/disclosure'

type Format = 'reel' | 'carousel' | 'still'

const FORMAT_SPEC: Record<Format, string> = {
  reel: '9:16 vertical video, 30–60s, on-screen captions, no synthetic voiceover',
  carousel: '4:5 portrait stills, 5 frames, one idea per frame, text burned in',
  still: '4:5 portrait still, single frame, caption carries the detail',
}

function buildBrief(persona: Persona, format: Format, beat: string): string {
  const status = disclosureStatus(persona)
  return [
    `Persona: ${persona.name} — ${persona.niche}`,
    `Format: ${FORMAT_SPEC[format]}`,
    `Beat: ${beat || '(describe the single thing this post shows)'}`,
    '',
    'Constraints:',
    '- One idea. If it needs two, it is two posts.',
    '- Show the thing being done; do not narrate it over stock footage.',
    '- No claim the persona cannot back: no prices, no medical or financial advice, no fake testimonials.',
    `- The persona is AI-generated and is labelled as such${
      status.complete ? '' : ` (MISSING: ${status.missing.join(', ')})`
    }.`,
    '- Return the generated asset plus a caption and 3 alt-text lines.',
    '',
    'After generating: leave it in review. A human approves before anything publishes.',
  ].join('\n')
}

export function Studio({ snapshot }: { snapshot: Snapshot }) {
  const [personaId, setPersonaId] = useState(snapshot.personas[0]?.id ?? '')
  const [format, setFormat] = useState<Format>('reel')
  const [beat, setBeat] = useState('')
  const [copied, setCopied] = useState(false)

  const persona = snapshot.personas.find((p) => p.id === personaId)
  const brief = useMemo(
    () => (persona ? buildBrief(persona, format, beat) : ''),
    [persona, format, beat],
  )
  const status = persona ? disclosureStatus(persona) : null

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="warn-banner">
        <strong>The connector is the easy part.</strong> Adding an image/video MCP server to Claude takes
        two minutes (<code>docs/openart-mcp.md</code>). What takes the work is a brief worth generating
        from and a person who looks at the result — which is what this screen is.
      </div>

      <div className="grid split">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Generation brief</h2>
            <span className="spacer" />
            <button
              className="ghost-btn"
              onClick={() => {
                void navigator.clipboard?.writeText(brief)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            {brief}
          </pre>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Inputs</h2>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <label className="field">
                <span>Persona</span>
                <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                  {snapshot.personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.niche}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                  <option value="reel">Reel</option>
                  <option value="carousel">Carousel</option>
                  <option value="still">Still</option>
                </select>
              </label>
              <label className="field">
                <span>Beat — the one thing this post shows</span>
                <input
                  value={beat}
                  placeholder="dialling in a new bag: grind, dose, yield"
                  onChange={(e) => setBeat(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Publish checklist</h2>
            </div>
            <div className="stack small">
              {status && (
                <>
                  <ChecklistRow ok={!!persona?.disclosure.bioLabel.trim()} label="AI label in profile bio" />
                  <ChecklistRow ok={!!persona?.disclosure.perPostLabel} label="Per-post AI label applied" />
                  <ChecklistRow ok={!!persona?.disclosure.platformAiFlag} label="Platform AI-content flag set" />
                  <ChecklistRow ok={false} label="Human sign-off on the generated asset" pending />
                  {!status.complete && (
                    <p className="muted" style={{ marginTop: 6 }}>
                      Publishing is blocked for this persona until the missing labels are in place.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChecklistRow({ ok, label, pending }: { ok: boolean; label: string; pending?: boolean }) {
  const color = ok ? 'var(--good)' : pending ? 'var(--text-muted)' : 'var(--critical)'
  return (
    <div className="row" style={{ gap: 8 }}>
      <span aria-hidden style={{ color, width: 14, textAlign: 'center', fontWeight: 700 }}>
        {ok ? '✓' : pending ? '○' : '✕'}
      </span>
      <span className={ok ? '' : 'muted'}>{label}</span>
      {pending && <span className="muted small">per item, at review time</span>}
    </div>
  )
}
