const express = require('express')
const { q, q1 } = require('../db')
const { wrap, buildUpdate } = require('../lib/http')

// Mounted at '/' so it can serve both nested (/promises/:id/steps) and flat (/steps/:id) paths.
const router = express.Router()

const UPDATABLE = ['title', 'order_num', 'done', 'start_date', 'end_date', 'start_time', 'end_time']

// GET /promises/:promiseId/steps
router.get('/promises/:promiseId/steps', wrap(async (req, res) => {
  res.json(await q(
    'SELECT * FROM steps WHERE promise_id = $1 ORDER BY order_num, id',
    [Number(req.params.promiseId)]
  ))
}))

// POST /promises/:promiseId/steps  { title, start_date, end_date, start_time, end_time }
router.post('/promises/:promiseId/steps', wrap(async (req, res) => {
  const promiseId = Number(req.params.promiseId)
  const d = (typeof req.body === 'string') ? { title: req.body } : (req.body || {})
  const max = await q1('SELECT MAX(order_num) AS m FROM steps WHERE promise_id = $1', [promiseId])
  const row = await q1(`
    INSERT INTO steps (promise_id, title, order_num, start_date, end_date, start_time, end_time)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [
    promiseId, d.title, (max?.m || 0) + 1,
    d.start_date || null, d.end_date || null, d.start_time || null, d.end_time || null,
  ])
  // Adding a step turns a single promise into a multi-step ("plan") promise
  await q(`UPDATE promises SET type = 'plan' WHERE id = $1 AND type = 'single'`, [promiseId])
  res.json(row)
}))

// PUT /steps/:id  { ...fields }
router.put('/steps/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const upd = buildUpdate(req.body, UPDATABLE)
  if (!upd) return res.json(await q1('SELECT * FROM steps WHERE id = $1', [id]))
  res.json(await q1(
    `UPDATE steps SET ${upd.clause} WHERE id = $${upd.nextIndex} RETURNING *`,
    [...upd.values, id]
  ))
}))

// POST /steps/:id/toggle
router.post('/steps/:id/toggle', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const s = await q1('SELECT done FROM steps WHERE id = $1', [id])
  if (!s) return res.status(404).json({ error: 'Step not found' })
  res.json(await q1('UPDATE steps SET done = $1 WHERE id = $2 RETURNING *', [s.done ? 0 : 1, id]))
}))

// DELETE /steps/:id
router.delete('/steps/:id', wrap(async (req, res) => {
  await q('DELETE FROM steps WHERE id = $1', [Number(req.params.id)])
  res.json({ ok: true })
}))

module.exports = router
