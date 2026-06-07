import { useState, useEffect, useCallback } from 'react'
import { fmtDuration, durationMin, fmtMins, daysLeft } from '../utils'
import Modal from '../components/Modal'
import TodoForm from '../components/TodoForm'

export default function Plans() {
  const [todos, setTodos] = useState([])
  const [tomorrow, setTomorrow] = useState([])
  const [editTodo, setEditTodo] = useState(null)

  const load = useCallback(async () => {
    const [t, tm] = await Promise.all([
      window.api.todos.upcoming(),
      window.api.todos.tomorrow()
    ])
    setTodos(t)
    setTomorrow(tm)
  }, [])

  useEffect(() => { load() }, [load])

  const del = async (todo) => {
    if (todo.recurring === 1) {
      if (!confirm('Bỏ việc lặp lại này khỏi ngày mai?')) return
      await window.api.todos.delete(todo.id, { scope: 'today', date: todo.scheduled_date })
    } else {
      if (!confirm('Xoá việc đã lên kế hoạch này?')) return
      await window.api.todos.delete(todo.id)
    }
    load()
  }

  // Group by scheduled_date (already sorted by the backend)
  const groups = []
  const byDate = {}
  for (const t of todos) {
    if (!byDate[t.scheduled_date]) {
      byDate[t.scheduled_date] = { date: t.scheduled_date, todos: [] }
      groups.push(byDate[t.scheduled_date])
    }
    byDate[t.scheduled_date].todos.push(t)
  }

  const tomorrowDate = tomorrow[0]?.scheduled_date
  const tomorrowMin = tomorrow.reduce((sum, t) => sum + (durationMin(t.scheduled_time, t.end_time) || 0), 0)
  const empty = tomorrow.length === 0 && groups.length === 0

  return (
    <div className="fade-in">
      <div style={{ padding: '20px 0 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px' }}>Kế hoạch</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
          Kế hoạch ngày mai (gồm cả thói quen) và các việc đã lên lịch cho những ngày tới
        </div>
      </div>

      {empty && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🗓</div>
          <div style={{ fontSize: 14 }}>Chưa có kế hoạch nào</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Thêm việc vào một ngày trong tương lai để xem ở đây</div>
        </div>
      )}

      {/* Tomorrow's plan — includes recurring habits */}
      {tomorrow.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, paddingLeft: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>📌 Kế hoạch ngày mai</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>
              {tomorrowDate && new Date(tomorrowDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
              {tomorrowMin > 0 ? ` · ~${fmtMins(tomorrowMin)}` : ''}
            </span>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--accent)', overflow: 'hidden' }}>
            {tomorrow.map(t => (
              <PlanItem key={`tmr-${t.id}`} todo={t} onEdit={() => setEditTodo(t)} onDelete={() => del(t)} />
            ))}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingLeft: 2 }}>
          Những ngày tới
        </div>
      )}

      {groups.map(g => {
        const days = daysLeft(g.date)
        const totalMin = g.todos.reduce((sum, t) => sum + (durationMin(t.scheduled_time, t.end_time) || 0), 0)
        return (
          <div key={g.date} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, paddingLeft: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                {new Date(g.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {days === 1 ? 'ngày mai' : `còn ${days} ngày`}{totalMin > 0 ? ` · ~${fmtMins(totalMin)}` : ''}
              </span>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {g.todos.map(t => (
                <PlanItem key={t.id} todo={t} onEdit={() => setEditTodo(t)} onDelete={() => del(t)} />
              ))}
            </div>
          </div>
        )
      })}

      <Modal open={!!editTodo} onClose={() => setEditTodo(null)} title="Sửa kế hoạch">
        <TodoForm
          initial={editTodo}
          defaultDate={editTodo?.scheduled_date}
          onSave={async (data) => {
            await window.api.todos.update(editTodo.id, data)
            setEditTodo(null)
            load()
          }}
          onCancel={() => setEditTodo(null)}
        />
      </Modal>
    </div>
  )
}

function PlanItem({ todo, onEdit, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: hover ? 'var(--bg2)' : 'transparent', transition: 'background 0.1s'
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: todo.recurring === 1 ? 'var(--purple)' : 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{todo.title}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {todo.recurring === 1 && <span style={{ fontSize: 11, color: 'var(--purple)', background: 'var(--purple-light)', padding: '1px 6px', borderRadius: 4 }}>↻ Thói quen</span>}
          {(todo.scheduled_time || todo.end_time) && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {todo.scheduled_time && todo.end_time
                ? `${todo.scheduled_time.slice(0,5)}–${todo.end_time.slice(0,5)}`
                : todo.scheduled_time ? todo.scheduled_time.slice(0,5) : `→ ${todo.end_time.slice(0,5)}`}
            </span>
          )}
          {durationMin(todo.scheduled_time, todo.end_time) != null && (
            <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>
              {fmtDuration(todo.scheduled_time, todo.end_time)}
            </span>
          )}
          {todo.promise_content && (
            <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>
              ◇ {todo.promise_content.length > 30 ? todo.promise_content.slice(0,30)+'…' : todo.promise_content}
            </span>
          )}
        </div>
      </div>
      {hover && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onEdit} style={{ fontSize: 12, color: 'var(--text3)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg3)' }}>Sửa</button>
          <button onClick={onDelete} style={{ fontSize: 12, color: 'var(--red)', padding: '2px 6px', borderRadius: 4, background: 'var(--red-light)' }}>Xoá</button>
        </div>
      )}
    </div>
  )
}
