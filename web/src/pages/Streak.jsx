import { useState, useEffect, useCallback } from 'react'
import { fmt } from '../utils'
import Modal from '../components/Modal'

const rateColor = (r) => r >= 80 ? '#7C3AED' : r >= 60 ? '#A855F7' : r >= 40 ? '#3B82F6' : 'var(--border2)'

export default function Streak() {
  const [data, setData] = useState(null)
  const [hover, setHover] = useState(null)

  const load = useCallback(async () => {
    const d = await window.api.streak.stats()
    setData(d)
  }, [])

  useEffect(() => { load() }, [load])

  if (!data) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>

  const { current, record, consistency, activeDays, totalDays, rescuesLeft, atRisk, trend, calendar } = data
  const maxRate = 100

  // Rescue is only offered through the at-risk popup (no manual rescue buttons).
  const declinedKey = atRisk ? `streak-declined-${atRisk}` : null
  const showRescue = !!atRisk && declinedKey && localStorage.getItem(declinedKey) !== '1'

  const doRescue = async () => {
    const r = await window.api.streak.rescue(atRisk)
    if (r?.error) { alert(r.error); return }
    load()
  }
  const dismissRescue = () => {
    if (declinedKey) localStorage.setItem(declinedKey, '1')
    setData({ ...data, atRisk: null })
  }

  return (
    <div className="fade-in">
      <div style={{ padding: '20px 0 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px' }}>Streak</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Chuỗi ngày hoàn thành công việc</div>
      </div>

      {/* At-risk rescue popup */}
      <Modal open={showRescue} onClose={dismissRescue} title="⚠️ Streak đang gặp nguy hiểm">
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
          Bạn đã lỡ ngày <b style={{ color: 'var(--text)' }}>{atRisk ? fmt(atRisk) : ''}</b> — chưa hoàn thành việc nào.
          Nếu không cứu, chuỗi streak của bạn sẽ mất.
          <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 12 }}>Còn {rescuesLeft} lượt cứu trong tháng này.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={doRescue} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg, #FB923C, #F43F5E)', color: 'white', fontWeight: 600 }}>🛟 Cứu streak</button>
          <button onClick={dismissRescue} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'var(--bg3)', color: 'var(--text2)', fontWeight: 500 }}>Bỏ qua</button>
        </div>
      </Modal>

      {/* Top row: streak + trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14, marginBottom: 14 }}>
        {/* Current streak card */}
        <div style={{ background: 'linear-gradient(135deg, #FB923C, #F43F5E)', borderRadius: 'var(--radius-lg)', padding: '20px', color: 'white', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>Chuỗi hiện tại</div>
              <div style={{ fontSize: 48, fontWeight: 600, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
                {current}<span style={{ fontSize: 18, fontWeight: 400, marginLeft: 6 }}>ngày</span>
              </div>
            </div>
            <div style={{ fontSize: 40 }}>🔥</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>🏆 Kỷ lục</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{record}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>🎯 Kiên định</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{consistency}%</div>
            </div>
          </div>
        </div>

        {/* 30-day trend */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Xu hướng 30 ngày</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>↗ Tỷ lệ hoàn thành</div>
          </div>
          <div style={{ position: 'relative', paddingTop: 22 }}>
            {/* tooltip */}
            {hover !== null && (() => {
              const t = trend[hover]
              const leftPct = ((hover + 0.5) / trend.length) * 100
              const flip = leftPct > 78
              const flipL = leftPct < 22
              return (
                <div style={{
                  position: 'absolute', top: 0, left: `${leftPct}%`, zIndex: 5, pointerEvents: 'none',
                  transform: `translate(${flip ? '-100%' : flipL ? '0' : '-50%'}, -100%)`,
                  paddingBottom: 6
                }}>
                  <div style={{ background: '#374151', color: 'white', borderRadius: 10, padding: '7px 12px', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.22)', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.05 }}>{t.total > 0 ? `${t.rate}%` : '—'}</div>
                    <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>{fmt(t.date)}{t.total > 0 ? ` · ${t.done}/${t.total}` : ''}</div>
                  </div>
                  <div style={{
                    width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #374151',
                    position: 'absolute', bottom: 0, left: flip ? 'calc(100% - 18px)' : flipL ? 18 : '50%', transform: 'translateX(-50%)'
                  }} />
                </div>
              )
            })()}
            {/* 100% reference line */}
            <div style={{ position: 'absolute', top: 22, left: 0, right: 0, borderTop: '1px dashed var(--border2)' }}>
              <span style={{ position: 'absolute', right: 0, top: -16, fontSize: 11, color: 'var(--text3)' }}>100%</span>
            </div>
            {/* bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
              {trend.map((t, i) => (
                <div key={t.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', cursor: 'pointer' }}>
                  <div style={{
                    height: `${t.total > 0 ? Math.max(4, (t.rate / maxRate) * 100) : 3}%`,
                    background: t.total > 0 ? 'linear-gradient(180deg, #7C3AED 0%, #A855F7 45%, #60A5FA 100%)' : 'var(--bg2)',
                    borderRadius: '6px 6px 0 0',
                    opacity: hover === null || hover === i ? 1 : 0.5,
                    transition: 'height 0.3s, opacity 0.15s'
                  }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
            <span>📅 30 ngày trước</span>
            <span style={{ display: 'flex', gap: 10 }}>
              <Legend color="#7C3AED" label="80-100%" />
              <Legend color="#A855F7" label="60-79%" />
              <Legend color="#3B82F6" label="40-59%" />
            </span>
            <span>Hôm nay ⚡</span>
          </div>
        </div>
      </div>

      {/* Second row: calendar + stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Calendar */}
        <div style={{ background: 'linear-gradient(135deg, #6366F1, #A855F7)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', color: 'white' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Tháng này</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {calendar.map(c => (
              <div key={c.date} style={{
                aspectRatio: '1', borderRadius: '50%',
                border: c.completed ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                background: c.completed ? 'rgba(255,255,255,0.25)' : 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, opacity: c.isFuture ? 0.4 : 1
              }} title={c.isFuture ? '' : `${fmt(c.date)} · ${c.done}/${c.total}`}>
                <span style={{ fontSize: 9, opacity: 0.7 }}>{c.day}</span>
                <span style={{ fontWeight: 600, fontSize: c.completed || c.rescued ? 13 : 11 }}>
                  {c.isFuture ? '-' : c.rescued ? '🛟' : c.completed ? '🔥' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ background: 'linear-gradient(135deg, #6366F1, #A855F7)', borderRadius: 'var(--radius-lg)', padding: '24px 20px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <Ring pct={consistency} label="Độ Kiên Định" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>🎖️</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{activeDays}/{totalDays}</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>Ngày Hoạt Động</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}

function Ring({ pct, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%', margin: '0 auto',
        background: `conic-gradient(white ${pct * 3.6}deg, rgba(255,255,255,0.25) 0)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#7E5BE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
          {pct}%
        </div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 8 }}>{label}</div>
    </div>
  )
}
