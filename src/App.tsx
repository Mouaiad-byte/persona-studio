import { useEffect, useState } from 'react'
import { DataSource, Snapshot } from './data/types'
import { mockSource } from './data/mockSource'
import { httpSource } from './data/httpSource'
import { Dashboard } from './features/Dashboard'
import { Studio } from './features/Studio'
import { Economics } from './features/Economics'

type Tab = 'dashboard' | 'studio' | 'economics'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'studio', label: 'Studio' },
  { id: 'economics', label: 'Economics' },
]

interface SourceState {
  name: string
  /** Why the live collector was not used, when it was not. */
  fallbackReason?: string
}

/**
 * Prefer the local collector; fall back to the mock so the console is never
 * blank. The fallback is always stated — silently showing synthetic numbers
 * where real ones were expected is the failure mode worth designing out.
 */
async function loadSnapshot(): Promise<{ snapshot: Snapshot; source: SourceState }> {
  const live: DataSource = httpSource
  try {
    return { snapshot: await live.load(), source: { name: live.name } }
  } catch (error) {
    return {
      snapshot: await mockSource.load(),
      source: {
        name: mockSource.name,
        fallbackReason: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [source, setSource] = useState<SourceState | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    void loadSnapshot().then((result) => {
      setSnapshot(result.snapshot)
      setSource(result.source)
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="wordmark">Persona Studio</h1>
        <span className="tagline">studio console — disclosed AI personas, one review gate, real numbers</span>
        <span className="spacer" />
        {source && (
          <span className="pill" title={source.fallbackReason ?? 'served by the local collector'}>
            <span
              className="dot"
              style={{ background: source.fallbackReason ? 'var(--warning)' : 'var(--good)' }}
            />
            source: {source.name}
          </span>
        )}
        <button className="ghost-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!snapshot && <p className="muted">Loading snapshot…</p>}
      {snapshot && tab === 'dashboard' && (
        <Dashboard snapshot={snapshot} fallbackReason={source?.fallbackReason} />
      )}
      {snapshot && tab === 'studio' && <Studio snapshot={snapshot} />}
      {tab === 'economics' && <Economics />}
    </div>
  )
}
