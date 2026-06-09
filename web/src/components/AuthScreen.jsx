import { useState } from 'react'

// Login / Register screen shown when there is no authenticated session.
// onAuthed(user) is called after a successful login or registration.
export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isRegister = mode === 'register'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Vui lòng nhập email và mật khẩu'); return }
    if (isRegister) {
      if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return }
      if (password !== confirm) { setError('Mật khẩu nhập lại không khớp'); return }
    }
    setBusy(true)
    try {
      const res = isRegister
        ? await window.api.auth.register(email.trim(), password)
        : await window.api.auth.login(email.trim(), password)
      onAuthed(res.user)
    } catch (err) {
      setError(err?.message || 'Đã có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  const swap = () => {
    setMode(isRegister ? 'login' : 'register')
    setError(''); setPassword(''); setConfirm('')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: 'var(--bg2)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)', padding: '28px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', letterSpacing: '-0.4px' }}>
            Promise Keeper
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            {isRegister ? 'Tạo tài khoản mới' : 'Đăng nhập để tiếp tục'}
          </div>
        </div>

        <form onSubmit={submit}>
          <label style={labelStyle}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="email" placeholder="you@example.com" style={inputStyle}
          />

          <label style={labelStyle}>Mật khẩu</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="••••••" style={inputStyle}
          />

          {isRegister && (
            <>
              <label style={labelStyle}>Nhập lại mật khẩu</label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password" placeholder="••••••" style={inputStyle}
              />
            </>
          )}

          {error && (
            <div style={{ color: 'var(--danger, #e5484d)', fontSize: 12, margin: '4px 0 10px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} style={{
            width: '100%', padding: '10px 0', marginTop: 6,
            borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--accent, #4f46e5)', color: '#fff',
            fontSize: 14, fontWeight: 500, cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}>
            {busy ? 'Đang xử lý…' : (isRegister ? 'Đăng ký' : 'Đăng nhập')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text3)' }}>
          {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
          <button onClick={swap} style={{
            background: 'none', border: 'none', color: 'var(--accent, #4f46e5)',
            cursor: 'pointer', fontSize: 12, padding: 0,
          }}>
            {isRegister ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 12, color: 'var(--text2)', margin: '10px 0 4px',
}
const inputStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
}
