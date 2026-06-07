import { useState, useEffect, useCallback } from 'react'
import Modal from '../components/Modal'
import PromiseForm from '../components/PromiseForm'
import StepsPanel from '../components/StepsPanel'
import { fmt, daysLeft } from '../utils'

const ASPECT_LABEL = { work: 'Công việc', family: 'Gia đình', personal: 'Cá nhân', friend: 'Bạn bè' }
const ASPECT_COLOR = {
  work: { bg: 'var(--blue-light)', text: 'var(--blue)' },
  family: { bg: 'var(--amber-light)', text: 'var(--amber)' },
  personal: { bg: 'var(--accent-light)', text: 'var(--accent)' },
  friend: { bg: 'var(--purple-light)', text: 'var(--purple)' },
}

export default function Promises() {
  const [promises, setPromises] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [editPromise, setEditPromise] = useState(null)
  const [stepsFor, setStepsFor] = useState(null)

  const load = useCallback(async () => {
    const rows = await window.api.promises.list()
    setPromises(rows)
  }, [])

  useEffect(() => { load() }, [load])

  const del = async (id) => {
    if (!confirm('Xoá lời hứa này?')) return
    await window.api.promises.delete(id)
    load()
  }

  const markDone = async (id) => {
    await window.api.promises.update(id, { status: 'done' })
    load()
  }

  const undo = async (id) => {
    await window.api.promises.update(id, { status: 'active' })
    load()
  }

  const active = promises.filter(p => p.status === 'active')
  const draft = promises.filter(p => p.status === 'draft')
  const done = promises.filter(p => p.status === 'done')
  const broken = promises.filter(p => p.status === 'broken')

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.5px' }}>Lời hứa</h1>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{active.length} đang mở · {draft.length} nháp</div>
        </div>
        <button onClick={() => { setEditPromise(null); setAddOpen(true) }} style={btnPrimary}>+ Thêm lời hứa</button>
      </div>

      {active.length > 0 && (
        <Section label="Đang mở — theo hạn gần nhất">
          {active.map(p => (
            <PromiseRow key={p.id} promise={p}
              onEdit={() => { setEditPromise(p); setAddOpen(true) }}
              onDelete={() => del(p.id)}
              onDone={() => markDone(p.id)}
              onSteps={() => setStepsFor(p)}
            />
          ))}
        </Section>
      )}

      {draft.length > 0 && (
        <Section label="Nháp — chưa đủ thông tin" muted>
          {draft.map(p => (
            <PromiseRow key={p.id} promise={p}
              onEdit={() => { setEditPromise(p); setAddOpen(true) }}
              onDelete={() => del(p.id)}
              onDone={() => markDone(p.id)}
              onSteps={() => setStepsFor(p)}
              isDraft
            />
          ))}
        </Section>
      )}

      {(done.length > 0 || broken.length > 0) && (
        <Section label="Đã kết thúc" muted>
          {[...done, ...broken].map(p => (
            <PromiseRow key={p.id} promise={p}
              onDelete={() => del(p.id)}
              onUndo={() => undo(p.id)}
              onSteps={() => setStepsFor(p)}
              isEnded
            />
          ))}
        </Section>
      )}

      {promises.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>◇</div>
          <div>Chưa có lời hứa nào</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Bấm "+ Thêm lời hứa" để bắt đầu</div>
        </div>
      )}

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setEditPromise(null) }} title={editPromise ? 'Sửa lời hứa' : 'Thêm lời hứa'} wide>
        <PromiseForm
          initial={editPromise}
          onSave={async (data) => {
            if (editPromise) {
              await window.api.promises.update(editPromise.id, data)
            } else {
              await window.api.promises.add(data)
            }
            setAddOpen(false)
            setEditPromise(null)
            load()
          }}
          onCancel={() => { setAddOpen(false); setEditPromise(null) }}
        />
      </Modal>

      <Modal open={!!stepsFor} onClose={() => { setStepsFor(null); load() }} title={`Các bước — ${stepsFor?.content?.slice(0,40) || ''}`} wide>
        {stepsFor && <StepsPanel promise={stepsFor} />}
      </Modal>
    </div>
  )
}

function Section({ label, children, muted }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, paddingLeft: 2 }}>{label}</div>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', opacity: muted ? 0.88 : 1 }}>
        {children}
      </div>
    </div>
  )
}

function PromiseRow({ promise: p, onEdit, onDelete, onDone, onUndo, onSteps, isDraft, isEnded }) {
  const [hover, setHover] = useState(false)
  const ac = ASPECT_COLOR[p.aspect] || ASPECT_COLOR.personal
  const days = p.deadline ? daysLeft(p.deadline) : null

  let deadlineBadge = null
  if (p.deadline && !isEnded) {
    const d = days
    const bg = d < 0 ? 'var(--red-light)' : d <= 1 ? 'var(--red-light)' : d <= 3 ? 'var(--amber-light)' : 'var(--bg2)'
    const tc = d < 0 ? 'var(--red)' : d <= 1 ? 'var(--red)' : d <= 3 ? 'var(--amber)' : 'var(--text3)'
    const label = d < 0 ? `Trễ ${Math.abs(d)} ngày` : d === 0 ? 'Hôm nay' : d === 1 ? 'Ngày mai' : `Còn ${d} ngày`
    deadlineBadge = <span style={{ fontSize: 11, background: bg, color: tc, padding: '2px 7px', borderRadius: 4 }}>{label}</span>
  }

  const recLabel = p.recurrence ? '↻ Lặp lại' : null

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px',
        borderBottom: '1px solid var(--border)',
        background: hover && !isEnded ? 'var(--bg2)' : 'transparent', transition: 'background 0.1s'
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: ac.bg, color: ac.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 1
      }}>
        {(p.person_name || 'T').slice(0,2).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: isDraft ? 400 : 500, color: isDraft ? 'var(--text2)' : isEnded ? 'var(--text3)' : 'var(--text)', fontStyle: isDraft ? 'italic' : 'normal', lineHeight: 1.4 }}>
          {p.content}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, background: ac.bg, color: ac.text, padding: '1px 7px', borderRadius: 4 }}>
            {p.person_name || 'Tôi'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', padding: '1px 7px', borderRadius: 4 }}>
            {ASPECT_LABEL[p.aspect] || p.aspect}
          </span>
          {deadlineBadge}
          {p.deadline && p.deadline_time && !isEnded && <span style={{ fontSize: 11, color: 'var(--text3)' }}>lúc {p.deadline_time.slice(0,5)}</span>}
          {recLabel && <span style={{ fontSize: 11, color: 'var(--purple)', background: 'var(--purple-light)', padding: '1px 7px', borderRadius: 4 }}>{recLabel}</span>}
          {isDraft && <span style={{ fontSize: 11, color: 'var(--text3)', border: '1px dashed var(--border2)', padding: '1px 7px', borderRadius: 4 }}>Nháp</span>}
          {p.status === 'done' && <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 7px', borderRadius: 4 }}>✓ Đã xong</span>}
          {p.status === 'broken' && <span style={{ fontSize: 11, color: 'var(--red)', background: 'var(--red-light)', padding: '1px 7px', borderRadius: 4 }}>✗ Không thực hiện</span>}
          {p.step_count > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.steps_done}/{p.step_count} bước</span>}
        </div>
      </div>

      {hover && !isEnded && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {onSteps && <button onClick={onSteps} title="Thêm / xem các bước" style={btnSm('var(--purple-light)', 'var(--purple)')}>+</button>}
          {onEdit && <button onClick={onEdit} style={btnSm('var(--bg3)', 'var(--text2)')}>Sửa</button>}
          {onDone && <button onClick={onDone} style={btnSm('var(--accent-light)', 'var(--accent)')}>Xong</button>}
          {onDelete && <button onClick={onDelete} style={btnSm('var(--red-light)', 'var(--red)')}>Xoá</button>}
        </div>
      )}
      {hover && isEnded && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {onUndo && <button onClick={onUndo} style={btnSm('var(--bg3)', 'var(--text2)')}>↺ Hoàn tác</button>}
          {onDelete && <button onClick={onDelete} style={btnSm('var(--red-light)', 'var(--red)')}>Xoá</button>}
        </div>
      )}
    </div>
  )
}

const btnSm = (bg, color) => ({ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: bg, color, fontWeight: 500 })
const btnPrimary = { background: 'var(--accent)', color: 'white', padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }
