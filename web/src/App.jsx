import { useState } from 'react'
import Today from './pages/Today'
import Promises from './pages/Promises'
import Plans from './pages/Plans'
import Habits from './pages/Habits'
import History from './pages/History'
import Integrity from './pages/Integrity'

const NAV = [
  { id: 'today', label: 'Hôm nay', icon: '◎' },
  { id: 'promises', label: 'Lời hứa', icon: '◇' },
  { id: 'plans', label: 'Kế hoạch', icon: '🗓' },
  { id: 'habits', label: 'Thói quen', icon: '↻' },
  { id: 'history', label: 'Lịch sử', icon: '🕘' },
  { id: 'integrity', label: 'Integrity', icon: '◈' },
]

export default function App() {
  const [page, setPage] = useState('today')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const go = (id) => { setPage(id); setSidebarOpen(false) }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar page={page} go={go} open={sidebarOpen} />
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="titlebar" />
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Ẩn/hiện thanh điều hướng"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>
          {page === 'today' && <Today />}
          {page === 'promises' && <Promises />}
          {page === 'plans' && <Plans />}
          {page === 'habits' && <Habits />}
          {page === 'history' && <History />}
          {page === 'integrity' && <Integrity />}
        </div>
      </main>
    </div>
  )
}

function Sidebar({ page, go, open }) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`} style={{
      background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '0 0 16px',
    }}>
      <div className="titlebar" style={{ borderBottom: '1px solid var(--border)' }} />
      <div style={{ padding: '16px 14px 8px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          Promise
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>Keeper</div>
      </div>
      <nav style={{ flex: 1, padding: '6px 8px' }}>
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%',
              padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 2,
              background: page === n.id ? 'var(--surface)' : 'transparent',
              color: page === n.id ? 'var(--text)' : 'var(--text2)',
              fontWeight: page === n.id ? 500 : 400,
              boxShadow: page === n.id ? 'var(--shadow)' : 'none',
              fontSize: 13, transition: 'all 0.12s'
            }}
          >
            <span style={{ fontSize: 15, opacity: 0.7 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: '0 14px', fontSize: 11, color: 'var(--text3)' }}>
        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
      </div>
    </aside>
  )
}
