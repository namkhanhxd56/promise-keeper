const express = require('express')
const cors = require('cors')
const { initDB } = require('./db')

const app = express()

// CORS: allow the Vercel front-end origin(s). Comma-separated list, or '*' for any.
const ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim())
app.use(cors({ origin: ORIGINS.includes('*') ? true : ORIGINS }))
app.use(express.json())

// Health check
app.get('/', (_req, res) => res.json({ ok: true, service: 'promise-keeper-api' }))
app.get('/health', (_req, res) => res.json({ ok: true }))

// Routes
app.use('/people', require('./routes/people'))
app.use('/promises', require('./routes/promises'))
app.use('/', require('./routes/steps'))        // /promises/:id/steps and /steps/:id
app.use('/todos', require('./routes/todos'))
app.use('/integrity', require('./routes/integrity'))
app.use('/streak', require('./routes/streak'))
app.use('/reviews', require('./routes/reviews'))

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
