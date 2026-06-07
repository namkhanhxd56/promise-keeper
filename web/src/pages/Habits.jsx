import { useState, useEffect, useCallback } from 'react'
import { fmtDuration, durationMin } from '../utils'

const DAY_LABEL = { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' }
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const formatDays = (csv) => {
  if (!csv) return 'Mỗi ngày'
  const ids = csv.split(',').filter(Boolean)
  if (ids.length === 7) return 'Mỗi ngày'
  return DAY_ORDER.filter(d => ids.includes(d)).map(d => DAY_LABEL[d]).join(' · ')
}

export default function Habits() {
  const [habits, setHabits] = useState([])

  const load = useCallback(async () => {
    const h = await window.api.todos.habits()
    setHabits(h)
  }, [])

  useEffect(() => { load() }, [load])

  const del = async (id) => {
    if (!confirm('Kết thúc thói quen này? Sẽ không hiển thị nữa.')) return
    await window.api.todos.delete(id, { scope: 'habit' })
    load()
  }

  return (
    <div className="fade-in">
      <div style={{ padding: '20px 0 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px' }}>Thói quen</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
          {habits.length > 0 ? `${habits.length} thói quen đang duy trì` : 'Các việc lặp lại theo ngày trong tuần'}
        </div>
      </div>

      {habits.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>↻</div>
          <div style={{ fontSize: 14 }}>Chưa có thói quen nào</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Thêm việc lặp lại ở mục Hôm nay để tạo thói quen</div>
        </div>
      )}

      {habits.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {habits.map(h => (
            <HabitItem key={h.id} habit={h} onDelete={() => del(h.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function HabitItem({ habit, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        background: hover ? 'var(--bg2)' : 'transparent', transition: 'background 0.1s'
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--purple)', marginTop: 1, flexShrink: 0 }}>↻</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{habit.title}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--purple)', background: 'var(--purple-light)', padding: '1px 6px', borderRadius: 4 }}>
            {formatDays(habit.recurrence_days)}
          </span>
          {(habit.scheduled_time || habit.end_time) && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {habit.scheduled_time && habit.end_time
                ? `${habit.scheduled_time.slice(0,5)}–${habit.end_time.slice(0,5)}`
                : habit.scheduled_time ? habit.scheduled_time.slice(0,5) : `→ ${habit.end_time.slice(0,5)}`}
            </span>
          )}
          {durationMin(habit.scheduled_time, habit.end_time) != null && (
            <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>
              {fmtDuration(habit.scheduled_time, habit.end_time)}
            </span>
          )}
          {habit.promise_content && (
            <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>
              ◇ {habit.promise_content.length > 30 ? habit.promise_content.slice(0,30)+'…' : habit.promise_content}
            </span>
          )}
        </div>
      </div>
      {hover && (
        <button onClick={onDelete} style={{ fontSize: 12, color: 'var(--red)', padding: '2px 6px', borderRadius: 4, background: 'var(--red-light)' }}>Kết thúc</button>
      )}
    </div>
  )
}
