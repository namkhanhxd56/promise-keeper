const express = require('express')
const { q, q1 } = require('../db')
const { wrap, buildUpdate } = require('../lib/http')

// Mounted at '/' so it can serve both nested (/promises/:id/steps) and flat (/steps/:id) paths.
const router = express.Router()

const UPDATABLE = ['title', 'order_num', 'done', 'start_date', 'end_date', 'start_time', 'end_time']

// Steps have no user_id of their own — ownership is inherited from the promise.
const ownsPromise = (promiseId, userId) =>
  q1('SELECT 1 AS x FROM promises WHERE id = $1 AND user_id = $2', [promiseId, userId])
const ownsStep = (stepId, userId) =>
  q1(`SELECT s.* FROM steps s JOIN promises p ON s.promise_id = p.id
      WHERE s.id = $1 AND p.user_id = $2`, [stepId, userId])

// GET /promises/:promiseId/steps
router.get('/promises/:promiseId/steps', wrap(async (req, res) => {
  const promiseId = Number(req.params.promiseId)
  if (!(await ownsPromise(promiseId, req.userId))) return res.status(404).json({ error: 'Không tìm thấy' })
  res.json(await q(
    'SELECT * FROM steps WHERE promise_id = $1 ORDER BY order_num, id',
    [promiseId]
  ))
}))

// POST /promises/:promiseId/steps  { title, start_date, end_date, start_time, end_time }
router.post('/promises/:promiseId/steps', wrap(async (req, res) => {
  const promiseId = Number(req.params.promiseId)
  if (!(await ownsPromise(promiseId, req.userId))) return res.status(404).json({ error: 'Không tìm thấy' })
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
  const existing = await ownsStep(id, req.userId)
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })
  const upd = buildUpdate(req.body, UPDATABLE)
  if (!upd) return res.json(existing)
  res.json(await q1(
    `UPDATE steps SET ${upd.clause} WHERE id = $${upd.nextIndex} RETURNING *`,
    [...upd.values, id]
  ))
}))

// POST /steps/:id/toggle
router.post('/steps/:id/toggle', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const s = await ownsStep(id, req.userId)
  if (!s) return res.status(404).json({ error: 'Step not found' })
  res.json(await q1('UPDATE steps SET done = $1 WHERE id = $2 RETURNING *', [s.done ? 0 : 1, id]))
}))

// DELETE /steps/:id
router.delete('/steps/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (!(await ownsStep(id, req.userId))) return res.status(404).json({ error: 'Không tìm thấy' })
  await q('DELETE FROM steps WHERE id = $1', [id])
  res.json({ ok: true })
}))

module.exports = router
