import { useState, useEffect, useCallback } from 'react'
import { fmtMins, isVictory, toDateStr, todoDuration, moodIcon, moodLabel } from '../utils'
import AspectTag from '../components/AspectTag'

// Only yesterday can still be marked done (a 1-day grace period to record what
// you actually finished). Older days are locked read-only.
const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d) })()

export default function History() {
  const [days, setDays] = useState([])
  const [open, setOpen] = useState({})

  const load = useCallback(async () => {
    const d = await window.api.todos.history()
    setDays(d)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (date) => setOpen(o => ({ ...o, [date]: !o[date] }))

  const toggleTodo = async (id, date) => {
    await window.api.todos.toggle(id, date)
    load()
  }

  const totalDone = days.reduce((s, d) => s + d.done, 0)
  const totalTasks = days.reduce((s, d) => s + d.total, 0)

  return (
    <div className="fade-in">
      <div style={{ padding: '20px 0 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px' }}>Lịch sử</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
          {days.length > 0
            ? `${days.length} ngày · ${totalDone}/${totalTasks} việc đã xong`
            : 'Xem lại các việc đã làm những ngày trước'}
        </div>
      </div>

      {days.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🕘</div>
          <div style={{ fontSize: 14 }}>Chưa có lịch sử</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Các ngày đã qua có việc sẽ hiện ở đây</div>
        </div>
      )}

      {days.map(d => {
        const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0
        const isOpen = open[d.date]
        const editable = d.date === yesterdayStr
        const totalMin = d.todos.reduce((sum, t) => sum + (todoDuration(t) || 0), 0)
        return (
          <div key={d.date} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 10, overflow: 'hidden' }}>
            <button onClick={() => toggle(d.date)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '12px 14px', background: 'transparent', textAlign: 'left'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, textTransform: 'capitalize' }}>
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                  </span>
                  {d.mood && <span title={moodLabel(d.mood)} style={{ fontSize: 16, lineHeight: 1 }}>{moodIcon(d.mood)}</span>}
                  {isVictory(d.done, d.total) && <span className="victory-tag sm"><span className="vt-star">⭐</span> Chiến thắng</span>}
                  {editable
                    ? <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 7px', borderRadius: 4, fontWeight: 500 }}>Hôm qua · có thể đánh dấu</span>
                    : <span style={{ fontSize: 11, color: 'var(--text3)' }}>🔒</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {d.done}/{d.total} việc xong{totalMin > 0 ? ` · ${fmtMins(totalMin)}` : ''}
                </div>
              </div>
              <div style={{ width: 90, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--accent)' : 'var(--amber)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text3)', width: 36, textAlign: 'right' }}>{pct}%</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {(d.note || d.mood) && (
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      <span>Review</span>
                      {d.mood && <span style={{ fontSize: 15 }}>{moodIcon(d.mood)}</span>}
                    </div>
                    {d.note && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 5, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{d.note}</div>}
                  </div>
                )}
                {d.todos.map(t => {
                  const boxStyle = {
                    width: 16, height: 16, minWidth: 16, borderRadius: 4, marginTop: 1, flexShrink: 0,
                    border: `1.5px solid ${t.done ? 'var(--accent)' : 'var(--border2)'}`,
                    background: t.done ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: editable ? 'pointer' : 'default',
                  }
                  const check = t.done ? <span style={{ color: 'white', fontSize: 10 }}>✓</span> : null
                  return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                    {editable
                      ? <button onClick={() => toggleTodo(t.id, d.date)} style={boxStyle} title="Đánh dấu hoàn thành">{check}</button>
                      : <span style={boxStyle}>{check}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: t.done ? 'var(--text3)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        {(t.scheduled_time || t.end_time) && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {t.scheduled_time && t.end_time
                              ? `${t.scheduled_time.slice(0,5)}–${t.end_time.slice(0,5)}`
                              : t.scheduled_time ? t.scheduled_time.slice(0,5) : `→ ${t.end_time.slice(0,5)}`}
                          </span>
                        )}
                        {todoDuration(t) != null && (
                          <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>{fmtMins(todoDuration(t))}</span>
                        )}
                        <AspectTag aspect={t.aspect || t.promise_aspect} />
                        {t.recurring === 1 && <span style={{ fontSize: 11, color: 'var(--purple)', background: 'var(--purple-light)', padding: '1px 6px', borderRadius: 4 }}>↻ Thói quen</span>}
                        {t.promise_content && (
                          <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>
                            ◇ {t.promise_content.length > 30 ? t.promise_content.slice(0,30)+'…' : t.promise_content}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
