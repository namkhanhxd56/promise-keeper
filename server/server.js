const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { initDB } = require('./db')
const { authRequired } = require('./lib/auth')

const app = express()

// CORS: allow the Vercel front-end origin(s). Comma-separated list, or '*' for any.
// credentials:true is required so the browser sends/stores the httpOnly auth cookies.
const ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim())
app.use(cors({ origin: ORIGINS.includes('*') ? true : ORIGINS, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// Health check
app.get('/', (_req, res) => res.json({ ok: true, service: 'promise-keeper-api' }))
app.get('/health', (_req, res) => res.json({ ok: true }))

// Public auth routes
app.use('/auth', require('./routes/auth'))

// Data routes — every one requires a valid session (req.userId).
app.use('/people', authRequired, require('./routes/people'))
app.use('/promises', authRequired, require('./routes/promises'))
app.use('/', authRequired, require('./routes/steps')) // /promises/:id/steps and /steps/:id
app.use('/todos', authRequired, require('./routes/todos'))
app.use('/integrity', authRequired, require('./routes/integrity'))
app.use('/streak', authRequired, require('./routes/streak'))
app.use('/reviews', authRequired, require('./routes/reviews'))

// 404
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }))

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[api] error:', err)
  res.status(500).json({ error: err.message || 'Internal error' })
})

const PORT = process.env.PORT || 3001

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[api] listening on :${PORT}`))
  })
  .catch((err) => {
    console.error('[api] failed to init DB:', err)
    process.exit(1)
  })
