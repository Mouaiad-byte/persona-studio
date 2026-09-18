import { useMemo, useState } from 'react'
import { PLATFORMS, Snapshot } from '../data/types'
import { StatTile } from '../components/StatTile'
import { TimeSeriesChart } from '../components/TimeSeriesChart'
import { PlatformBars } from '../components/PlatformBars'
import { RevenuePanel } from '../components/RevenuePanel'
import { PersonaPanel } from '../components/PersonaPanel'
import { QueuePanel } from '../components/QueuePanel'
import { PostsTable } from '../components/PostsTable'
import { periodChange, sumLast } from '../lib/series'
import { compactNumber, fullNumber, shortDate, usd } from '../lib/format'
import { blockedCount } from '../lib/disclosure'
import { CoverageStrip } from '../components/CoverageStrip'

interface Props {
  snapshot: Snapshot
  /** Set when the live collector could not be reached and the mock stood in. */
  fallbackReason?: string
}

export function Dashboard({ snapshot, fallbackReason }: Props) {
  const [showTable, setShowTable] = useState(false)

  const views7 = sumLast(snapshot.viewsDaily, 7)
  const views7Change = periodChange(snapshot.viewsDaily, 7)
  const followers = snapshot.personas.reduce(
    (sum, p) => sum + p.accounts.reduce((s, a) => s + a.followers, 0),
    0,
  )
  const revenue30 = snapshot.revenue.reduce((s, r) => s + r.amountUsd, 0)
  const views30 = sumLast(snapshot.viewsDaily, 30)
  const rpm = views30 > 0 ? (revenue30 / views30) * 1000 : 0
  const blocked = blockedCount(snapshot.queue, snapshot.personas)

  const platformRows = useMemo(
    () =>
      PLATFORMS.map((platform) => ({
        platform,
        views: sumLast(snapshot.viewsByPlatform[platform], 30),
      })),
    [snapshot],
  )

  return (
    <div className="stack" style={{ gap: 16 }}>
      {snapshot.isMock && (
        <div className="warn-banner">
          <strong>Synthetic data.</strong> Every figure below comes from the bundled mock source, so the
          console can be read before any account is connected. Start the collector and run{' '}
          <code>npm run collect</code> per <code>docs/data-sources.md</code> — a dashboard that cannot tell
          you where its numbers came from is the thing the reel was selling.
          {fallbackReason && (
            <div className="small" style={{ marginTop: 8 }}>
              Collector not reachable: <code>{fallbackReason}</code>
            </div>
          )}
        </div>
      )}

      {!snapshot.isMock && snapshot.coverage && (
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Coverage</h2>
            <span className="spacer" />
            <span className="card-note">
              a platform with no collector reads zero — that is not the same as zero views
            </span>
          </div>
          <CoverageStrip coverage={snapshot.coverage} />
        </div>
      )}

      <div className="grid cols-4">
        <StatTile
          label="Views · 7d"
          value={compactNumber(views7)}
          change={views7Change}
          sub="vs prior 7d"
        />
        <StatTile label="Followers" value={compactNumber(followers)} sub={`${snapshot.personas.length} personas`} />
        <StatTile label="Revenue · 30d" value={usd(revenue30)} sub="all sources" />
        <StatTile
          label="Blended RPM"
          value={usd(rpm, { cents: true })}
          sub="revenue per 1,000 views"
        />
      </div>

      <div className="grid split">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Daily views · 30 days</h2>
            <span className="spacer" />
            <button className="ghost-btn" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
              {showTable ? 'Chart' : 'Table'}
            </button>
          </div>
          {showTable ? (
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" className="num">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshot.viewsDaily].reverse().map((p) => (
                    <tr key={p.t}>
                      <td className="mono">{shortDate(p.t)}</td>
                      <td className="num">{fullNumber(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <TimeSeriesChart points={snapshot.viewsDaily} seriesLabel="Views" height={190} />
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Views by platform · 30 days</h2>
          </div>
          <PlatformBars rows={platformRows} />
        </div>
      </div>

      <div className="grid split">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Personas</h2>
            <span className="spacer" />
            <span className="card-note">disclosure is checked before anything publishes</span>
          </div>
          <PersonaPanel personas={snapshot.personas} posts={snapshot.posts} />
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Revenue by source · 30 days</h2>
          </div>
          <RevenuePanel entries={snapshot.revenue} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Open queue</h2>
          <span className="spacer" />
          <span className="card-note">
            {blocked > 0 ? `${blocked} blocked from publishing` : 'nothing blocked'}
          </span>
        </div>
        <QueuePanel queue={snapshot.queue} personas={snapshot.personas} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Top posts · 30 days</h2>
        </div>
        <PostsTable posts={snapshot.posts} personas={snapshot.personas} />
      </div>
    </div>
  )
}
