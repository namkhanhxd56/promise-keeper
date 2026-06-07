import { useState, useEffect } from 'react'
import { fmtDuration, ASPECTS } from '../utils'

const DAYS = [
  { id: 'mon', label: 'T2' },
  { id: 'tue', label: 'T3' },
  { id: 'wed', label: 'T4' },
  { id: 'thu', label: 'T5' },
  { id: 'fri', label: 'T6' },
  { id: 'sat', label: 'T7' },
  { id: 'sun', label: 'CN' },
]

export default function TodoForm({ initial, defaultDate, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [date, setDate] = useState(initial?.scheduled_date || defaultDate || '')
  const [time, setTime] = useState(initial?.scheduled_time || '')
  const [endTime, setEndTime] = useState(initial?.end_time || '')
  const [promiseId, setPromiseId] = useState(initial?.promise_id || '')
  const [stepId, setStepId] = useState(initial?.step_id || '')
  const [promises, setPromises] = useState([])
  const [steps, setSteps] = useState([])
  const [aspect, setAspect] = useState(initial?.aspect || 'personal')
  const [recurring, setRecurring] = useState(!!initial?.recurring)
  const [recDays, setRecDays] = useState(
    initial?.recurrence_days ? initial.recurrence_days.split(',') : []
  )

  useEffect(() => {
    window.api.promises.list().then(p => setPromises(p.filter(x => x.status === 'active')))
  }, [])

  // Load the chosen promise's existing steps so a todo can attach to one
  useEffect(() => {
    if (!promiseId) { setSteps([]); return }
    window.api.steps.list(Number(promiseId)).then(setSteps)
  }, [promiseId])

  // When attached to an existing step, that step IS the task:
  // adopt its title (locked) and its planned times.
  useEffect(() => {
    if (!stepId) return
    const s = steps.find(x => String(x.id) === String(stepId))
    if (!s) return
    setTitle(s.title)
    setTime(s.start_time || '')
    setEndTime(s.end_time || '')
  }, [stepId, steps])

  const toggleDay = (d) => setRecDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const handleSave = async () => {
    if (!title.trim()) { alert('Vui lòng nhập tên việc cần làm'); return }
    if (recurring && recDays.length === 0) { alert('Chọn ít nhất 1 ngày trong tuần cho thói quen'); return }
    await onSave({
      title: title.trim(),
      scheduled_date: recurring ? null : (date || null),
      scheduled_time: time || null,
      end_time: endTime || null,
      promise_id: promiseId || null,
      step_id: promiseId && stepId ? stepId : null,
      recurring: recurring ? 1 : 0,
      recurrence_days: recurring && recDays.length > 0 ? recDays.join(',') : null,
      aspect: aspect || null,
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Việc cần làm</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Ghi việc cần làm..." autoFocus={!stepId}
          disabled={!!stepId}
          style={stepId ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
          onKeyDown={e => e.key === 'Enter' && handleSave()} />
        {stepId && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            Lấy từ bước trong lời hứa. Sửa giờ bên dưới sẽ cập nhật lại bước đó.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Khía cạnh</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ASPECTS.map(a => (
            <button key={a.id} type="button" onClick={() => setAspect(a.id)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, border: '1px solid',
              borderColor: aspect === a.id ? 'var(--accent)' : 'var(--border2)',
              background: aspect === a.id ? 'var(--bg3)' : 'transparent',
              color: aspect === a.id ? 'var(--text)' : 'var(--text2)',
              fontWeight: aspect === a.id ? 500 : 400, width: 'auto'
            }}>{a.label}</button>
          ))}
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
          style={{ width: 'auto', margin: 0 }} />
        ↻ Tạo thành thói quen (lặp lại các ngày trong tuần)
      </label>

      {recurring ? (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Lặp lại vào</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {DAYS.map(d => (
              <button key={d.id} type="button" onClick={() => toggleDay(d.id)} style={{
                width: 34, height: 34, borderRadius: '50%', fontSize: 12, border: '1px solid',
                borderColor: recDays.includes(d.id) ? 'var(--accent)' : 'var(--border2)',
                background: recDays.includes(d.id) ? 'var(--accent)' : 'transparent',
                color: recDays.includes(d.id) ? 'white' : 'var(--text2)', fontWeight: 500
              }}>{d.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Ngày</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Giờ bắt đầu</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Giờ hoàn thành</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Khối lượng</label>
          <div style={{
            height: 38, display: 'flex', alignItems: 'center', padding: '0 10px',
            borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)',
            fontSize: 13, color: fmtDuration(time, endTime) ? 'var(--accent)' : 'var(--text3)'
          }}>
            {fmtDuration(time, endTime) || '—'}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Gắn với lời hứa (optional)</label>
        <select value={promiseId} onChange={e => { setPromiseId(e.target.value); setStepId('') }}>
          <option value="">— Không gắn —</option>
          {promises.map(p => (
            <option key={p.id} value={p.id}>
              {p.person_name ? `${p.person_name}: ` : ''}{p.content.slice(0, 50)}{p.content.length > 50 ? '…' : ''}
            </option>
          ))}
        </select>
        {promiseId && (
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Gắn với bước trong lời hứa</label>
            <select value={stepId} onChange={e => setStepId(e.target.value)}>
              <option value="">+ Tạo bước mới từ việc này</option>
              {steps.map(s => (
                <option key={s.id} value={s.id}>{s.title.slice(0, 60)}{s.title.length > 60 ? '…' : ''}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              {stepId ? 'Việc này sẽ gắn vào bước đã có.' : 'Việc này sẽ tự thành một bước mới trong lời hứa.'}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text2)', fontSize: 13 }}>Huỷ</button>
        <button onClick={handleSave} style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 500 }}>Lưu</button>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 5 }
