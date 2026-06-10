import { useState, useEffect } from 'react'
import { toDateStr, fmt, fmtDuration, durationMin } from '../utils'

const emptyDraft = { title: '', start_date: '', end_date: '', start_time: '', end_time: '' }

export default function StepsPanel({ promise }) {
  const [steps, setSteps] = useState([])
  const [draft, setDraft] = useState(emptyDraft)
  const [addedToday, setAddedToday] = useState([])

  const load = async () => {
    const s = await window.api.steps.list(promise.id)
    setSteps(s)
  }

  useEffect(() => { load() }, [promise.id])

  const add = async () => {
    if (!draft.title.trim()) return
    await window.api.steps.add(promise.id, {
      title: draft.title.trim(),
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      start_time: draft.start_time || null,
      end_time: draft.end_time || null,
    })
    setDraft(emptyDraft)
    load()
  }

  const toggle = async (id) => {
    await window.api.steps.toggle(id)
    load()
  }

  const del = async (id) => {
    await window.api.steps.delete(id)
    load()
  }

  const addToToday = async (s) => {
    await window.api.todos.add({
      title: s.title,
      scheduled_date: s.start_date || toDateStr(new Date()),
      scheduled_time: s.start_time || null,
      end_time: s.end_time || null,
      promise_id: promise.id,
      step_id: s.id,
    })
    setAddedToday(prev => [...prev, s.id])
  }

  const done = steps.filter(s => s.done).length
  const draftWorkload = fmtDuration(draft.start_time, draft.end_time)

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
        {promise.content}
        {steps.length > 0 && (
          <span style={{ marginLeft: 10, color: 'var(--accent)', fontWeight: 500 }}>
            {done}/{steps.length} bước
          </span>
        )}
      </div>

      {steps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${steps.length > 0 ? (done / steps.length) * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          {steps.map((s, i) => {
            const wl = fmtDuration(s.start_time, s.end_time)
            const hasDate = s.start_date || s.end_date
            const hasTime = s.start_time || s.end_time
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                borderRadius: 8, marginBottom: 4,
                background: s.done ? 'var(--accent-light)' : 'var(--bg2)'
              }}>
                <button onClick={() => toggle(s.id)} style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                  border: `1.5px solid ${s.done ? 'var(--accent)' : 'var(--border2)'}`,
                  background: s.done ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {!!s.done && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: s.done ? 'var(--accent)' : 'var(--text)', textDecoration: s.done ? 'line-through' : 'none' }}>
                    {i + 1}. {s.title}
                  </div>
                  {(hasDate || hasTime) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                      {hasDate && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {s.start_date ? fmt(s.start_date) : '?'}{s.end_date && s.end_date !== s.start_date ? ` → ${fmt(s.end_date)}` : ''}
                        </span>
                      )}
                      {hasTime && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {s.start_time && s.end_time
                            ? `${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`
                            : s.start_time ? s.start_time.slice(0,5) : `→ ${s.end_time.slice(0,5)}`}
                        </span>
                      )}
                      {wl && (
                        <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>{wl}</span>
                      )}
                    </div>
                  )}
                </div>
                {addedToday.includes(s.id) ? (
                  <span style={{ fontSize: 11, color: 'var(--accent)', padding: '1px 6px' }}>✓ Đã thêm</span>
                ) : (
                  <button onClick={() => addToToday(s)} title="Thêm vào Hôm nay"
                    style={{ fontSize: 12, color: 'var(--accent)', padding: '1px 7px', borderRadius: 4, background: 'var(--accent-light)', fontWeight: 600, flexShrink: 0 }}>+ Hôm nay</button>
                )}
                <button onClick={() => del(s.id)} style={{ fontSize: 12, color: 'var(--text3)', padding: '1px 6px', borderRadius: 4, background: 'var(--bg3)', flexShrink: 0 }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add step form */}
      <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: 10, marginTop: 8 }}>
        <input
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          placeholder="Tên bước mới..."
          onKeyDown={e => e.key === 'Enter' && add()}
          autoFocus={steps.length === 0}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={miniLabel}>Ngày bắt đầu</label>
            <input type="date" value={draft.start_date} onChange={e => setDraft(d => ({ ...d, start_date: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={miniLabel}>Ngày kết thúc</label>
            <input type="date" value={draft.end_date} onChange={e => setDraft(d => ({ ...d, end_date: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={miniLabel}>Giờ bắt đầu</label>
            <input type="time" value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={miniLabel}>Giờ kết thúc</label>
            <input type="time" value={draft.end_time} onChange={e => setDraft(d => ({ ...d, end_time: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={miniLabel}>Khối lượng</label>
            <div style={{
              height: 36, display: 'flex', alignItems: 'center', padding: '0 10px',
              borderRadius: 8, background: 'var(--bg3)', fontSize: 13,
              color: draftWorkload ? 'var(--accent)' : 'var(--text3)'
            }}>
              {draftWorkload || '—'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Nhấn Enter ở ô tên để thêm nhanh</span>
          <button onClick={add} style={{
            padding: '7px 16px', borderRadius: 8, background: 'var(--accent)',
            color: 'white', fontSize: 13, fontWeight: 500, flexShrink: 0
          }}>Thêm bước</button>
        </div>
      </div>
    </div>
  )
}

const miniLabel = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }
