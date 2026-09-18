import { useMemo, useState } from 'react'
import {
  DEFAULT_INPUTS,
  RealityCheck,
  StudioInputs,
  factsFromSnapshot,
  inputsFromFacts,
  project,
  realityChecks,
} from '../lib/economics'
import { compactNumber, usd } from '../lib/format'
import { Snapshot } from '../data/types'

const SEVERITY_COLOR: Record<RealityCheck['severity'], string> = {
  critical: 'var(--critical)',
  serious: 'var(--serious)',
  warning: 'var(--warning)',
  good: 'var(--good)',
}

const SEVERITY_ICON: Record<RealityCheck['severity'], string> = {
  critical: '✕',
  serious: '!',
  warning: '!',
  good: '✓',
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  suffix?: string
}) {
  return (
    <label className="field">
      <span>
        {label}
        {suffix ? <span className="muted"> ({suffix})</span> : null}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
    </label>
  )
}

export function Economics({ snapshot }: { snapshot?: Snapshot }) {
  // Only real snapshots seed the model. Seeding off the mock would put invented
  // numbers behind a projection that is supposed to argue with reality.
  const facts = useMemo(
    () => (snapshot && !snapshot.isMock ? factsFromSnapshot(snapshot) : null),
    [snapshot],
  )
  const [seeded, setSeeded] = useState(Boolean(facts))
  const [input, setInput] = useState<StudioInputs>(() =>
    facts ? inputsFromFacts(facts, DEFAULT_INPUTS) : DEFAULT_INPUTS,
  )
  const out = useMemo(() => project(input), [input])
  const checks = useMemo(() => realityChecks(input, out), [input, out])

  const setRate = <K extends keyof StudioInputs['rates']>(key: K, v: number) =>
    setInput((s) => ({ ...s, rates: { ...s.rates, [key]: v } }))
  const setCost = <K extends keyof StudioInputs['costs']>(key: K, v: number) =>
    setInput((s) => ({ ...s, costs: { ...s.costs, [key]: v } }))

  return (
    <div className="stack" style={{ gap: 16 }}>
      {facts && seeded ? (
        <div className="warn-banner" style={{ borderLeftColor: 'var(--good)' }}>
          <strong>Seeded from your last {facts.windowDays} days.</strong> Personas, cadence and median views
          per post come from {facts.postCount} real post{facts.postCount === 1 ? '' : 's'}
          {facts.observedRpmUsd !== null && (
            <> — your observed RPM over that window was {usd(facts.observedRpmUsd, { cents: true })}</>
          )}
          . Rates and costs below are still assumptions: a snapshot cannot observe what a brand paid you or
          what a generation run cost.
          <div style={{ marginTop: 8 }}>
            <button
              className="ghost-btn"
              onClick={() => {
                setInput(DEFAULT_INPUTS)
                setSeeded(false)
              }}
            >
              Use starting values instead
            </button>
          </div>
        </div>
      ) : (
        <div className="warn-banner">
          <strong>Work the numbers before the build.</strong> Rates below are starting values, not facts —
          payout programs and commission terms change, and they differ by market. Replace each one with what
          your own dashboard actually pays before planning around it.
          {facts && (
            <div style={{ marginTop: 8 }}>
              <button
                className="ghost-btn"
                onClick={() => {
                  setInput(inputsFromFacts(facts, input))
                  setSeeded(true)
                }}
              >
                Use my last {facts.windowDays} days
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid split">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Monthly projection</h2>
          </div>

          <div className="grid cols-2" style={{ gap: 12, marginBottom: 16 }}>
            <div>
              <div className="tile-label">Gross</div>
              <div className="tile-value mono">{usd(out.revenue.total)}</div>
            </div>
            <div>
              <div className="tile-label">Net</div>
              <div className="tile-value mono" style={{ color: out.netUsd < 0 ? 'var(--critical)' : undefined }}>
                {usd(out.netUsd)}
              </div>
            </div>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Posts published</td>
                <td className="num mono">{Math.round(out.postsPerMonth).toLocaleString('en-US')}</td>
              </tr>
              <tr>
                <td>Views</td>
                <td className="num mono">{compactNumber(out.viewsPerMonth)}</td>
              </tr>
              <tr>
                <td>Platform payouts</td>
                <td className="num mono">{usd(out.revenue.payouts)}</td>
              </tr>
              <tr>
                <td>Affiliate</td>
                <td className="num mono">{usd(out.revenue.affiliate)}</td>
              </tr>
              <tr>
                <td>Own product</td>
                <td className="num mono">{usd(out.revenue.ownProduct)}</td>
              </tr>
              <tr>
                <td>Brand deals</td>
                <td className="num mono">{usd(out.revenue.brandDeals)}</td>
              </tr>
              <tr>
                <td>Generation spend</td>
                <td className="num mono">−{usd(out.costs.generation)}</td>
              </tr>
              <tr>
                <td>Model spend</td>
                <td className="num mono">−{usd(out.costs.llm)}</td>
              </tr>
              <tr>
                <td>Tooling</td>
                <td className="num mono">−{usd(out.costs.tooling)}</td>
              </tr>
              <tr>
                <td>Human review ({out.reviewHoursPerMonth.toFixed(0)} h)</td>
                <td className="num mono">−{usd(out.costs.humanReview)}</td>
              </tr>
              <tr>
                <td>Blended RPM</td>
                <td className="num mono">{usd(out.rpmUsd, { cents: true })}</td>
              </tr>
              <tr>
                <td>Your hour, effectively</td>
                <td className="num mono">{usd(out.effectiveHourlyUsd, { cents: true })}</td>
              </tr>
              <tr>
                <td>Breakeven views / month</td>
                <td className="num mono">
                  {out.breakevenViewsPerMonth === null
                    ? 'never at these rates'
                    : out.breakevenViewsPerMonth === 0
                      ? 'covered by deals'
                      : compactNumber(out.breakevenViewsPerMonth)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Output</h2>
            </div>
            <div className="grid cols-2" style={{ gap: 10 }}>
              <NumberField
                label="Personas"
                value={input.personaCount}
                onChange={(v) => setInput((s) => ({ ...s, personaCount: v }))}
              />
              <NumberField
                label="Posts / persona / day"
                value={input.postsPerPersonaPerDay}
                step={0.5}
                onChange={(v) => setInput((s) => ({ ...s, postsPerPersonaPerDay: v }))}
              />
              <NumberField
                label="Median views / post"
                value={input.medianViewsPerPost}
                step={500}
                onChange={(v) => setInput((s) => ({ ...s, medianViewsPerPost: v }))}
              />
              <label className="field">
                <span>Payout programs</span>
                <select
                  value={input.platformPayoutsEligible ? 'yes' : 'no'}
                  onChange={(e) =>
                    setInput((s) => ({ ...s, platformPayoutsEligible: e.target.value === 'yes' }))
                  }
                >
                  <option value="no">Not eligible</option>
                  <option value="yes">Admitted &amp; paying</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Rates</h2>
            </div>
            <div className="grid cols-2" style={{ gap: 10 }}>
              <NumberField label="Payout RPM" value={input.rates.payoutRpmUsd} step={0.05} suffix="$/1k views" onChange={(v) => setRate('payoutRpmUsd', v)} />
              <NumberField label="Link click rate" value={input.rates.affiliateClickRate} step={0.001} suffix="of views" onChange={(v) => setRate('affiliateClickRate', v)} />
              <NumberField label="Affiliate conversion" value={input.rates.affiliateConversionRate} step={0.005} suffix="of clicks" onChange={(v) => setRate('affiliateConversionRate', v)} />
              <NumberField label="Commission" value={input.rates.affiliateCommissionUsd} step={1} suffix="$/sale" onChange={(v) => setRate('affiliateCommissionUsd', v)} />
              <NumberField label="Product conversion" value={input.rates.ownProductConversionRate} step={0.00005} suffix="of views" onChange={(v) => setRate('ownProductConversionRate', v)} />
              <NumberField label="Product price" value={input.rates.ownProductPriceUsd} step={1} suffix="$" onChange={(v) => setRate('ownProductPriceUsd', v)} />
              <NumberField label="Brand deals / month" value={input.rates.brandDealsPerMonth} step={1} onChange={(v) => setRate('brandDealsPerMonth', v)} />
              <NumberField label="Fee per deal" value={input.rates.brandDealFeeUsd} step={50} suffix="$" onChange={(v) => setRate('brandDealFeeUsd', v)} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Costs</h2>
            </div>
            <div className="grid cols-2" style={{ gap: 10 }}>
              <NumberField label="Image gen / post" value={input.costs.imageGenPerPostUsd} step={0.05} suffix="$" onChange={(v) => setCost('imageGenPerPostUsd', v)} />
              <NumberField label="Video gen / post" value={input.costs.videoGenPerPostUsd} step={0.1} suffix="$" onChange={(v) => setCost('videoGenPerPostUsd', v)} />
              <NumberField label="Model spend / post" value={input.costs.llmPerPostUsd} step={0.01} suffix="$" onChange={(v) => setCost('llmPerPostUsd', v)} />
              <NumberField label="Tooling / month" value={input.costs.toolingMonthlyUsd} step={10} suffix="$" onChange={(v) => setCost('toolingMonthlyUsd', v)} />
              <NumberField label="Review / post" value={input.costs.reviewMinutesPerPost} step={1} suffix="minutes" onChange={(v) => setCost('reviewMinutesPerPost', v)} />
              <NumberField label="Your hourly rate" value={input.costs.hourlyRateUsd} step={5} suffix="$" onChange={(v) => setCost('hourlyRateUsd', v)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">What this implies</h2>
        </div>
        <div className="stack">
          {checks.length === 0 && <p className="muted small">Nothing structural to flag at these inputs.</p>}
          {checks.map((check) => (
            <div key={check.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span
                aria-hidden
                style={{
                  color: SEVERITY_COLOR[check.severity],
                  fontWeight: 700,
                  width: 14,
                  textAlign: 'center',
                  flex: 'none',
                }}
              >
                {SEVERITY_ICON[check.severity]}
              </span>
              <span>
                <strong style={{ display: 'block' }}>
                  <span className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 6 }}>
                    {check.severity}
                  </span>
                  {check.title}
                </strong>
                <span className="muted small">{check.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
