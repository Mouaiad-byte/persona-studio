import { useEffect, useState } from 'react'
import { Snapshot } from './data/types'
import { mockSource } from './data/mockSource'
import { Dashboard } from './features/Dashboard'
import { Studio } from './features/Studio'
import { Economics } from './features/Economics'

type Tab = 'dashboard' | 'studio' | 'economics'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'studio', label: 'Studio' },
  { id: 'economics', label: 'Economics' },
]

export function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    void mockSource.load().then(setSnapshot)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="wordmark">Hoard</h1>
        <span className="tagline">studio console — disclosed AI personas, one review gate, real numbers</span>
        <span className="spacer" />
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
      {snapshot && tab === 'dashboard' && <Dashboard snapshot={snapshot} />}
      {snapshot && tab === 'studio' && <Studio snapshot={snapshot} />}
      {tab === 'economics' && <Economics />}
    </div>
  )
}
