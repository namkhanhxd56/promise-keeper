const express = require('express')
const bcrypt = require('bcryptjs')
const { q, q1 } = require('../db')
const { wrap } = require('../lib/http')
const { setAuthCookies, clearAuthCookies, verifyRefresh, authRequired } = require('../lib/auth')

const router = express.Router()

const BCRYPT_COST = 12
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// A real (cost-12) bcrypt hash used for constant-time compares when the email
// doesn't exist, so login timing doesn't reveal whether an account is present.
const DUMMY_HASH = '$2b$12$CjGV3lnSZD6TvEIjzQI9uelEvcG/YL5QBLs9S.5O57vATbyxzsIJG'

// Tables whose legacy rows (user_id = '1') get handed to the first account.
const CLAIMABLE = ['people', 'promises', 'todos', 'daily_reviews', 'streak_rescues']

const publicUser = (u) => ({ id: u.id, email: u.email, encryption_version: u.encryption_version })

// POST /auth/register  { email, password }
router.post('/register', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email không hợp lệ' })
  if (password.length < 6) return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' })

  const existing = await q1('SELECT 1 AS x FROM users WHERE email = $1', [email])
  if (existing) return res.status(409).json({ error: 'Email đã được đăng ký' })

  const hashed = await bcrypt.hash(password, BCRYPT_COST)
  const isFirstUser = (await q1('SELECT COUNT(*)::int AS c FROM users')).c === 0

  const user = await q1(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
    [email, hashed]
  )

  // The very first account inherits any pre-auth (single-user) data.
  if (isFirstUser) {
    for (const tbl of CLAIMABLE) {
      try { await q(`UPDATE ${tbl} SET user_id = $1 WHERE user_id = '1'`, [user.id]) }
      catch (e) { console.warn(`[auth] claim ${tbl} skipped:`, e.message) }
    }
  }

  setAuthCookies(res, user.id)
  res.json({ user: publicUser(user) })
}))

// POST /auth/login  { email, password }
router.post('/login', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')

  const user = await q1('SELECT * FROM users WHERE email = $1', [email])
  // Compare against the stored hash; use a dummy compare to avoid leaking
  // whether the email exists via timing.
  const ok = user
    ? await bcrypt.compare(password, user.password)
    : await bcrypt.compare(password, DUMMY_HASH)
  if (!user || !ok) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' })

  setAuthCookies(res, user.id)
  res.json({ user: publicUser(user) })
}))

// POST /auth/refresh — mint a fresh access token from the refresh cookie
router.post('/refresh', wrap(async (req, res) => {
  const token = req.cookies?.refresh_token
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' })
  let userId
  try { userId = verifyRefresh(token).userId }
  catch { return res.status(401).json({ error: 'Phiên đã hết hạn' }) }

  const user = await q1('SELECT * FROM users WHERE id = $1', [userId])
  if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' })

  setAuthCookies(res, user.id) // rotate both tokens
  res.json({ user: publicUser(user) })
}))

// POST /auth/logout
router.post('/logout', wrap(async (_req, res) => {
  clearAuthCookies(res)
  res.json({ ok: true })
}))

// GET /auth/me — current user (requires a valid access token)
router.get('/me', authRequired, wrap(async (req, res) => {
  const user = await q1('SELECT * FROM users WHERE id = $1', [req.userId])
  if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' })
  res.json({ user: publicUser(user) })
}))

module.exports = router
