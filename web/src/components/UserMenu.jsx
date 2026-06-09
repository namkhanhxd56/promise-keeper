import { useState } from 'react'
import Modal from './Modal'

// Bottom-left account chip + account-info modal.
// `user` = { id, email, created_at, encryption_version }; `logout` = async fn.
export default function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const email = user?.email || 'Tài khoản'
  const initial = (email[0] || '?').toUpperCase()

  return (
    <>
      <div style={{ padding: '10px 10px 0', marginTop: 8, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setOpen(true)}
          title="Tài khoản"
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            padding: '8px 8px', borderRadius: 'var(--radius-sm)',
            background: 'transparent', border: '1px solid var(--border)',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{
            flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent, #4f46e5)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600,
          }}>
            {initial}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              display: 'block', fontSize: 12, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {email}
            </span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)' }}>
              Xem tài khoản
            </span>
          </span>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>⚙</span>
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Tài khoản">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--accent, #4f46e5)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, fontWeight: 600,
          }}>
            {initial}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', wordBreak: 'break-all' }}>
              {email}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Đã đăng nhập</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          <Row label="Email" value={email} />
          <Row label="Ngày tạo" value={fmtDate(user?.created_at)} />
          <Row label="Mã tài khoản" value={shortId(user?.id)} mono />
          <Row label="Bảo mật" value={user?.encryption_version === 2 ? 'Mã hóa đầu-cuối (E2EE)' : 'Tiêu chuẩn'} />
        </div>

        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '10px 0', borderRadius: 'var(--radius-sm)',
            background: 'transparent', color: 'var(--danger, #e5484d)',
            border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 14 }}>⎋</span> Đăng xuất
        </button>
      </Modal>
    </>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 12, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-all',
        fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit',
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

function shortId(id) {
  if (!id) return '—'
  const s = String(id)
  return s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s
}
