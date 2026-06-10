import { useState, useEffect, useCallback, useRef } from 'react'
import { fmt, toDateStr, tomorrow, fmtMins, isVictory, todoDuration, MOODS } from '../utils'
import Modal from '../components/Modal'
import TodoForm from '../components/TodoForm'
import AspectTag from '../components/AspectTag'

export default function Today() {
  const today = toDateStr(new Date())
  const [todos, setTodos] = useState([])
  const [past, setPast] = useState([])
  const [dueToday, setDueToday] = useState([])
  const [showPast, setShowPast] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editTodo, setEditTodo] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    const [t, p, promises] = await Promise.all([
      window.api.todos.byDate(today),
      window.api.todos.past(),
      window.api.promises.list()
    ])
    setTodos(t)
    setPast(p)
    setDueToday(promises.filter(pr => pr.status === 'active' && pr.deadline === today))
  }, [today])

  const completePromise = async (id) => {
    await window.api.promises.update(id, { status: 'done' })
    load()
  }

  useEffect(() => { load() }, [load])

  const toggle = async (id) => {
    await window.api.todos.toggle(id, today)
    load()
  }

  const snooze = async (id) => {
    await window.api.todos.snooze(id, tomorrow())
    load()
  }

  const del = async (todo) => {
    // Recurring habit: ask whether to skip just today or end the habit
    if (todo.recurring) { setDeleteTarget(todo); return }
    if (!confirm('Xoá việc này?')) return
    await window.api.todos.delete(todo.id)
    load()
  }

  const deleteHabit = async (scope) => {
    if (!deleteTarget) return
    await window.api.todos.delete(deleteTarget.id,
      scope === 'today' ? { scope: 'today', date: today } : { scope: 'habit' })
    setDeleteTarget(null)
    load()
  }

  const done = todos.filter(t => t.done).length
  const totalMin = todos.reduce((sum, t) => sum + (todoDuration(t) || 0), 0)
  const victory = isVictory(done, todos.length)

  // Fire the firework once when the day crosses into victory
  const [showFw, setShowFw] = useState(false)
  const prevVictory = useRef(false)
  useEffect(() => {
    if (victory && !prevVictory.current) {
      setShowFw(true)
      const t = setTimeout(() => setShowFw(false), 1700)
      prevVictory.current = victory
      return () => clearTimeout(t)
    }
    prevVictory.current = victory
  }, [victory])

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px' }}>
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long' })}
            </h1>
            {victory && (
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <span className="victory-tag"><span className="vt-star">⭐</span> Ngày chiến thắng</span>
                {showFw && <Firework />}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            {new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
            {todos.length > 0 && <span style={{ marginLeft: 10, color: 'var(--accent)' }}>{done}/{todos.length} việc xong</span>}
            {totalMin > 0 && <span style={{ marginLeft: 10, color: 'var(--text3)' }}>· khối lượng ~{fmtMins(totalMin)}</span>}
          </div>
        </div>
        <button onClick={() => { setEditTodo(null); setAddOpen(true) }} style={btnPrimary}>
          + Thêm việc
        </button>
      </div>

      {/* Past tasks banner */}
      {past.length > 0 && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid #FCD34D', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--amber)' }}>⏰ {past.length} việc chưa xong từ trước</span>
          <button onClick={() => setShowPast(v => !v)} style={{ fontSize: 12, color: 'var(--amber)', textDecoration: 'underline', background: 'none' }}>
            {showPast ? 'Ẩn' : 'Xem'}
          </button>
        </div>
      )}

      {showPast && past.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 'var(--radius)', marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', borderBottom: '1px solid #FCD34D', textTransform: 'uppercase', letterSpacing: '.05em' }}>Quá hạn</div>
          {past.map(t => (
            <PastItem key={t.id} todo={t} onSnooze={() => snooze(t.id)} onDone={() => toggle(t.id)} onDelete={() => del(t)} />
          ))}
        </div>
      )}

      {/* Promises due today */}
      {dueToday.length > 0 && (
        <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', borderBottom: '1px solid var(--accent)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            ◇ Lời hứa đến hạn hôm nay
          </div>
          {dueToday.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(45,106,79,0.18)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{p.content}</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>
                  {p.person_name || 'Tôi'}{p.deadline_time ? ` · hạn ${p.deadline_time.slice(0,5)}` : ''}
                </div>
              </div>
              <button onClick={() => completePromise(p.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'var(--accent)', color: 'white', fontWeight: 500 }}>✓ Hoàn thành</button>
            </div>
          ))}
        </div>
      )}

      {/* Tasks (single ordered list) */}
      {todos.length > 0 && (
        <Section>
          {todos.map(t => (
            <TodoItem key={t.id} todo={t} onToggle={() => toggle(t.id)} onDelete={() => del(t)}
              onEdit={() => { setEditTodo(t); setAddOpen(true) }} />
          ))}
        </Section>
      )}

      {todos.length === 0 && past.length === 0 && dueToday.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>◎</div>
          <div style={{ fontSize: 14 }}>Chưa có việc nào hôm nay</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Bấm "+ Thêm việc" để bắt đầu</div>
        </div>
      )}

      {/* Daily review — note + mood at the bottom of the day */}
      <DailyReview date={today} />

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setEditTodo(null) }} title={editTodo ? 'Sửa việc' : 'Thêm việc hôm nay'}>
        <TodoForm
          initial={editTodo}
          defaultDate={today}
          onSave={async (data) => {
            if (editTodo) {
              await window.api.todos.update(editTodo.id, data)
            } else {
              await window.api.todos.add(data)
            }
            setAddOpen(false)
            setEditTodo(null)
            load()
          }}
          onCancel={() => { setAddOpen(false); setEditTodo(null) }}
        />
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xoá thói quen">
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
          "{deleteTarget?.title}" là việc lặp lại. Bạn muốn xoá thế nào?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => deleteHabit('today')} style={{ padding: '9px 14px', borderRadius: 8, background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, fontWeight: 500, textAlign: 'left' }}>
            Chỉ xoá hôm nay
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400, marginTop: 2 }}>Thói quen vẫn tiếp tục các ngày sau</div>
          </button>
          <button onClick={() => deleteHabit('habit')} style={{ padding: '9px 14px', borderRadius: 8, background: 'var(--red-light)', color: 'var(--red)', fontSize: 13, fontWeight: 500, textAlign: 'left' }}>
            Kết thúc thói quen
            <div style={{ fontSize: 11, color: 'var(--red)', opacity: 0.8, fontWeight: 400, marginTop: 2 }}>Xoá hẳn, không hiển thị nữa</div>
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Firework() {
  const colors = ['#FBBF24', '#F59E0B', '#FCD34D', '#FB923C', '#FDE68A', '#F97316', '#EF4444']
  return (
    <div className="fw-wrap">
      <span className="fw-rocket">🎆</span>
      {Array.from({ length: 14 }).map((_, i) => {
        const ang = (i / 14) * 2 * Math.PI
        const r = 34 + (i % 3) * 8
        return (
          <span key={i} className="fw-particle" style={{
            '--dx': `${Math.cos(ang) * r}px`,
            '--dy': `${Math.sin(ang) * r}px`,
            background: colors[i % colors.length]
          }} />
        )
      })}
    </div>
  )
}

function Section({ label, children, muted }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, paddingLeft: 2 }}>{label}</div>}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', opacity: muted ? 0.92 : 1 }}>
        {children}
      </div>
    </div>
  )
}

function TodoItem({ todo, onToggle, onDelete, onEdit }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
        borderBottom: '1px solid var(--border)', cursor: 'default',
        background: hover ? 'var(--bg2)' : 'transparent', transition: 'background 0.1s'
      }}
    >
      <button onClick={onToggle} style={{
        width: 18, height: 18, minWidth: 18, borderRadius: 4, marginTop: 1,
        border: `1.5px solid ${todo.done ? 'var(--accent)' : 'var(--border2)'}`,
        background: todo.done ? 'var(--accent)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        {!!todo.done && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: todo.done ? 'var(--text3)' : 'var(--text)', textDecoration: todo.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
          {todo.title}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {(todo.scheduled_time || todo.end_time) && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {todo.scheduled_time && todo.end_time
                ? `${todo.scheduled_time.slice(0,5)}–${todo.end_time.slice(0,5)}`
                : todo.scheduled_time
                  ? todo.scheduled_time.slice(0,5)
                  : `→ ${todo.end_time.slice(0,5)}`}
            </span>
          )}
          {todoDuration(todo) != null && (
            <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: 4 }}>
              {fmtMins(todoDuration(todo))}
            </span>
          )}
          <AspectTag aspect={todo.aspect || todo.promise_aspect} />
          {todo.recurring === 1 && <span style={{ fontSize: 11, color: 'var(--purple)', background: 'var(--purple-light)', padding: '1px 6px', borderRadius: 4 }}>↻ Thói quen</span>}
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

function PastItem({ todo, onSnooze, onDone, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #FCD34D' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--amber)' }}>{todo.title}</div>
        <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>{fmt(todo.scheduled_date)}</div>
      </div>
      <button onClick={onDone} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>Xong rồi</button>
      <button onClick={onSnooze} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'var(--bg3)', color: 'var(--text2)' }}>→ Ngày mai</button>
      <button onClick={onDelete} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, color: 'var(--red)', background: 'var(--red-light)' }}>Xoá</button>
    </div>
  )
}

function DailyReview({ date }) {
  const [note, setNote] = useState('')
  const [mood, setMood] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState(false)

  useEffect(() => {
    let alive = true
    window.api.reviews.get(date).then(r => {
      if (!alive) return
      setNote(r?.note || '')
      setMood(r?.mood ?? null)
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { alive = false }
  }, [date])

  const save = async (nextNote = note, nextMood = mood) => {
    await window.api.reviews.save(date, { note: nextNote || null, mood: nextMood })
    setSavedAt(true)
    setTimeout(() => setSavedAt(false), 1800)
  }

  const pickMood = (id) => {
    const next = mood === id ? null : id
    setMood(next)
    save(note, next) // mood picks save immediately
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '16px 18px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        Bài học - Tâm đắc - Ngộ ra hôm nay của bạn là gì?
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => loaded && save()}
        placeholder="Viết lại điều bạn học được, tâm đắc hay ngộ ra hôm nay..."
        rows={4}
        style={{ width: '100%', resize: 'vertical', lineHeight: 1.5 }}
      />

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 16, marginBottom: 8 }}>
        Hôm nay bạn cảm thấy thế nào?
      </div>
      <div className="mood-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MOODS.map(m => {
          const active = mood === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => pickMood(m.id)}
              title={m.label}
              className="mood-btn"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '8px 10px', borderRadius: 10, minWidth: 56,
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
                background: active ? 'var(--accent-light)' : 'transparent',
                transition: 'all 0.12s', transform: active ? 'translateY(-2px)' : 'none',
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1, filter: active ? 'none' : 'grayscale(0.4)', opacity: active ? 1 : 0.75 }}>{m.icon}</span>
              <span className="mood-label" style={{ fontSize: 10, color: active ? 'var(--accent)' : 'var(--text3)', fontWeight: active ? 600 : 400 }}>{m.label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button onClick={() => save()} style={btnPrimary}>Lưu review</button>
        {savedAt && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Đã lưu ✓</span>}
      </div>
    </div>
  )
}

const btnPrimary = {
  background: 'var(--accent)', color: 'white', padding: '7px 14px',
  borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
  border: 'none', cursor: 'pointer'
}
