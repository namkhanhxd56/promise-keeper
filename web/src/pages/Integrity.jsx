import { useState, useEffect, useCallback } from 'react'
import { fmt } from '../utils'
import Modal from '../components/Modal'

const monthLabel = (m) => {
  const [y, mo] = m.split('-')
  return `Tháng ${Number(mo)}/${y}`
}

const scoreOf = (mb) => (mb.total > 0 ? Math.round((mb.kept / mb.total) * 100) : null)
const colorOf = (s) => (s === null ? 'var(--text3)' : s >= 80 ? 'var(--accent)' : s >= 60 ? 'var(--amber)' : 'var(--red)')
const rateColor = (r) => r >= 80 ? '#7C3AED' : r >= 60 ? '#A855F7' : r >= 40 ? '#3B82F6' : 'var(--border2)'

export default function Integrity() {
  const [months, setMonths] = useState(null)
  const [streak, setStreak] = useState(null)
  const [hover, setHover] = useState(null)

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([
      window.api.integrity.monthly(),
      window.api.streak.stats()
    ])
    setMonths(m)
    setStreak(s)
  }, [])

  useEffect(() => { load() }, [load])

  if (!months || !streak) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>

  const current = months[0]
  const previous = months.slice(1)

  const total = current.total
  const kept = current.kept
  const broken = current.broken
  const upcoming = current.upcoming
  const score = scoreOf(current)

  const { current: streakDays, record, consistency, activeDays, totalDays, rescuesLeft, atRisk, trend, calendar } = streak
  const maxRate = 100

  // At-risk rescue popup (only way to rescue a streak)
  const declinedKey = atRisk ? `streak-declined-${atRisk}` : null
  const showRescue = !!atRisk && declinedKey && localStorage.getItem(declinedKey) !== '1'
  const doRescue = async () => {
    const r = await window.api.streak.rescue(atRisk)
    if (r?.error) { alert(r.error); return }
    load()
  }
  const dismissRescue = () => {
    if (declinedKey) localStorage.setItem(declinedKey, '1')
    setStreak({ ...streak, atRisk: null })
  }

  return (
    <div className="fade-in">
      <div style={{ padding: '20px 0 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px' }}>Integrity</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Tỉ lệ giữ lời hứa & chuỗi ngày hoàn thành công việc</div>
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

      {/* 1) Two hero metrics: Integrity + Chuỗi hiện tại */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Integrity — promise rate (green) */}
        <div style={{ background: 'linear-gradient(135deg, #2D6A4F, #40916C)', borderRadius: 'var(--radius-lg)', padding: '20px', color: 'white', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>Integrity · {monthLabel(current.month)}</div>
              <div style={{ fontSize: 48, fontWeight: 600, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
                {score !== null ? `${score}%` : '—'}
              </div>
            </div>
            <div style={{ fontSize: 40 }}>◈</div>
          </div>
          <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4 }}>Tỉ lệ giữ lời hứa tháng này</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{kept}/{total} lời hứa đã đến hạn</div>
          {score !== null && (
            <div style={{ fontSize: 12, marginTop: 12, fontWeight: 500, background: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: '7px 10px' }}>
              {score >= 90 ? '✨ Xuất sắc — bạn là người đáng tin cậy' :
               score >= 75 ? '👍 Tốt — tiếp tục duy trì' :
               score >= 60 ? '⚠️ Trung bình — cần cải thiện' :
               '🔻 Cần chú ý — hãy giảm số lời hứa lại'}
            </div>
          )}
        </div>

        {/* Chuỗi hiện tại (Streak) */}
        <div style={{ background: 'linear-gradient(135deg, #FB923C, #F43F5E)', borderRadius: 'var(--radius-lg)', padding: '20px', color: 'white', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>Chuỗi hiện tại</div>
              <div style={{ fontSize: 48, fontWeight: 600, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
                {streakDays}<span style={{ fontSize: 18, fontWeight: 400, marginLeft: 6 }}>ngày</span>
              </div>
            </div>
            <div style={{ fontSize: 40 }}>🔥</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 10px' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>🏆 Kỷ lục</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{record}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 10px' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>🎯 Kiên định</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{consistency}%</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 10px' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>🎖️ Hoạt động</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{activeDays}<span style={{ fontSize: 13, fontWeight: 400, opacity: 0.85 }}>/{totalDays}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2) 30-day trend + month calendar */}
      <div className="trend-month-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* 30-day trend */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Xu hướng 30 ngày</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>↗ Tỷ lệ hoàn thành</div>
          </div>
          <div style={{ position: 'relative', paddingTop: 22 }}>
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
            <div style={{ position: 'absolute', top: 22, left: 0, right: 0, borderTop: '1px dashed var(--border2)' }}>
              <span style={{ position: 'absolute', right: 0, top: -16, fontSize: 11, color: 'var(--text3)' }}>100%</span>
            </div>
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

        {/* Tháng này calendar */}
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
      </div>

      {/* 4) Tổng lời hứa + Đã giữ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <StatCard label="Tổng lời hứa (đã đến hạn)" value={total} />
        <StatCard label="Đã giữ" value={kept} color="var(--accent)" />
      </div>

      {/* 5) Không thực hiện + Tương lai */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard label="Không thực hiện" value={broken} color={broken > 0 ? 'var(--red)' : 'var(--text3)'} />
        <StatCard label="Tương lai (chưa tính)" value={upcoming} color="var(--text3)" />
      </div>

      {/* Previous months */}
      {previous.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, paddingLeft: 2 }}>Các tháng trước</div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {previous.map(mb => {
              const s = scoreOf(mb)
              return (
                <div key={mb.month} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 110, fontSize: 13, color: 'var(--text)', flexShrink: 0 }}>{monthLabel(mb.month)}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${s ?? 0}%`, height: '100%', background: colorOf(s), borderRadius: 3 }} />
                  </div>
                  <div style={{ width: 44, textAlign: 'right', fontSize: 13, fontWeight: 500, color: colorOf(s) }}>{s !== null ? `${s}%` : '—'}</div>
                  <div style={{ width: 70, textAlign: 'right', fontSize: 11, color: 'var(--text3)' }}>{mb.kept}/{mb.total} giữ</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0', lineHeight: 1.6, borderTop: '1px solid var(--border)', marginTop: 4 }}>
        Integrity tính riêng cho mỗi tháng = số lời hứa đã giữ / tổng số lời hứa đến hạn trong tháng đó.<br />
        Streak = chuỗi ngày liên tiếp có ít nhất một việc hoàn thành; đứt nếu lỡ 2 ngày liên tục.
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

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 500, color: color || 'var(--text)', fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  )
}
