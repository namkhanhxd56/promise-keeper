const jwt = require('jsonwebtoken')

// Secrets MUST come from the environment (never hardcoded / committed).
// A dev fallback keeps local `node --check`/dev working, but is unsafe for prod.
const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-access-secret-change-me'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me'

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.warn('[auth] JWT_SECRET / JWT_REFRESH_SECRET not set — using INSECURE dev fallback. Set them in .env / Railway.')
}

const ACCESS_TTL = '15m'                       // short-lived access token
const REFRESH_TTL = '30d'                       // long-lived refresh token
const ACCESS_MAX_AGE = 15 * 60 * 1000           // 15 minutes
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days

// Cross-site cookies (Vercel front-end ↔ Railway API) require SameSite=None + Secure.
// Overridable for local http testing via env.
const COOKIE_SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : true
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'none'

function cookieOpts(maxAge) {
  return { httpOnly: true, secure: COOKIE_SECURE, sameSite: COOKIE_SAMESITE, maxAge, path: '/' }
}

const signAccess = (userId) => jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: ACCESS_TTL })
const signRefresh = (userId) => jwt.sign({ userId, typ: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TTL })
const verifyAccess = (token) => jwt.verify(token, ACCESS_SECRET)
const verifyRefresh = (token) => jwt.verify(token, REFRESH_SECRET)

function setAuthCookies(res, userId) {
  res.cookie('access_token', signAccess(userId), cookieOpts(ACCESS_MAX_AGE))
  res.cookie('refresh_token', signRefresh(userId), cookieOpts(REFRESH_MAX_AGE))
}

function clearAuthCookies(res) {
  res.clearCookie('access_token', { ...cookieOpts(0), maxAge: undefined })
  res.clearCookie('refresh_token', { ...cookieOpts(0), maxAge: undefined })
}

// Express middleware: require a valid access token, expose req.userId.
function authRequired(req, res, next) {
  const token = req.cookies?.access_token
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' })
  try {
    req.userId = verifyAccess(token).userId
    next()
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' })
  }
}

module.exports = {
  signAccess, signRefresh, verifyAccess, verifyRefresh,
  setAuthCookies, clearAuthCookies, authRequired,
}
