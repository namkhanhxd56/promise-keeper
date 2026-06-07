import { useState } from 'react'

const SELF = 'Tôi (bản thân)'

const F = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
)

const ASPECTS = [
  { id: 'work', label: 'Công việc' },
  { id: 'family', label: 'Gia đình' },
  { id: 'personal', label: 'Cá nhân' },
  { id: 'friend', label: 'Bạn bè' },
]

const DAYS = [
  { id: 'mon', label: 'T2' },
  { id: 'tue', label: 'T3' },
  { id: 'wed', label: 'T4' },
  { id: 'thu', label: 'T5' },
  { id: 'fri', label: 'T6' },
  { id: 'sat', label: 'T7' },
  { id: 'sun', label: 'CN' },
]

export default function PromiseForm({ initial, onSave, onCancel }) {
  const [isSelf, setIsSelf] = useState(initial ? initial.person_name === SELF : false)
  const [personName, setPersonName] = useState(
    initial?.person_name && initial.person_name !== SELF ? initial.person_name : ''
  )
  const [content, setContent] = useState(initial?.content || '')
  // Multi-step vs single is decided automatically when steps are added.
  // The form only asks whether the promise repeats.
  const [recurring, setRecurring] = useState(initial?.type === 'recurring')
  const [aspect, setAspect] = useState(initial?.aspect || 'personal')
  const [deadline, setDeadline] = useState(initial?.deadline || '')
  const [deadlineTime, setDeadlineTime] = useState(initial?.deadline_time || '')
  const [deadlineType, setDeadlineType] = useState(initial?.deadline_type || 'soft')
  const [recDays, setRecDays] = useState(
    initial?.recurrence_days ? initial.recurrence_days.split(',') : []
  )
  const [recTime, setRecTime] = useState(initial?.recurrence_time || '')
  const [doneCriteria, setDoneCriteria] = useState(initial?.done_criteria || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)

  const toggleDay = (d) => setRecDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const handleSave = async (status = 'active') => {
    if (!content.trim()) { alert('Vui lòng nhập nội dung lời hứa'); return }
    setSaving(true)
    // Keep an existing multi-step promise as 'plan'; otherwise single, unless recurring.
    const type = recurring ? 'recurring' : (initial?.type === 'plan' ? 'plan' : 'single')
    const data = {
      person_name: isSelf ? SELF : personName.trim(),
      content: content.trim(),
      type,
      aspect,
      status,
      deadline: deadline || null,
      deadline_time: deadline && deadlineTime ? deadlineTime : null,
      deadline_type: deadlineType,
      recurrence: recurring ? 'weekly' : null,
      recurrence_time: recurring && recTime ? recTime : null,
      recurrence_days: recurring && recDays.length > 0 ? recDays.join(',') : null,
      done_criteria: doneCriteria || null,
      notes: notes || null,
    }
    await onSave(data)
    setSaving(false)
  }

  return (
    <div>
      <F label="Hứa với">
        <input value={isSelf ? '' : personName} onChange={e => setPersonName(e.target.value)}
          placeholder="Tên người bạn hứa..." disabled={isSelf}
          style={isSelf ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={isSelf} onChange={e => setIsSelf(e.target.checked)}
            style={{ width: 'auto', margin: 0 }} />
          Hứa với bản thân
        </label>
      </F>

      <F label="Nội dung lời hứa">
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Tôi sẽ..." rows={2}
          style={{ resize: 'vertical', minHeight: 60 }} />
      </F>

      <F label="Lặp lại">
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
            style={{ width: 'auto', margin: 0 }} />
          ↻ Lời hứa lặp lại theo các ngày trong tuần
        </label>
      </F>

      {recurring ? (
        <F label="Lặp lại">
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {DAYS.map(d => (
              <button key={d.id} onClick={() => toggleDay(d.id)} style={{
                width: 36, height: 36, borderRadius: '50%', fontSize: 12, border: '1px solid',
                borderColor: recDays.includes(d.id) ? 'var(--accent)' : 'var(--border2)',
                background: recDays.includes(d.id) ? 'var(--accent)' : 'transparent',
                color: recDays.includes(d.id) ? 'white' : 'var(--text2)',
                fontWeight: 500
              }}>{d.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>Giờ nhắc:</label>
            <input type="time" value={recTime} onChange={e => setRecTime(e.target.value)} style={{ width: 120 }} />
          </div>
        </F>
      ) : (
        <F label="Deadline">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ flex: 1 }} />
            <input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)}
              disabled={!deadline} title="Giờ (tuỳ chọn)"
              style={{ width: 110, opacity: deadline ? 1 : 0.5 }} />
            <select value={deadlineType} onChange={e => setDeadlineType(e.target.value)} style={{ width: 130 }}>
              <option value="soft">Mềm (có thể dời)</option>
              <option value="hard">Cứng (không dời)</option>
            </select>
          </div>
        </F>
      )}

      <F label="Khía cạnh">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {ASPECTS.map(a => (
            <button key={a.id} onClick={() => setAspect(a.id)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, border: '1px solid',
              borderColor: aspect === a.id ? 'var(--border2)' : 'var(--border)',
              background: aspect === a.id ? 'var(--bg3)' : 'transparent',
              color: aspect === a.id ? 'var(--text)' : 'var(--text2)', fontWeight: aspect === a.id ? 500 : 400
            }}>{a.label}</button>
          ))}
        </div>
      </F>

      <F label="Tiêu chí hoàn thành (optional)">
        <input value={doneCriteria} onChange={e => setDoneCriteria(e.target.value)}
          placeholder="Xong trông như thế nào?" />
      </F>

      <F label="Ghi chú (optional)">
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú thêm..." />
      </F>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <button onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text2)', fontSize: 13 }}>Huỷ</button>
        <button onClick={() => handleSave('draft')} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13 }} disabled={saving}>Lưu nháp</button>
        <button onClick={() => handleSave('active')} style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 500 }} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Xác nhận hứa'}
        </button>
      </div>
    </div>
  )
}
