const express = require('express')
const { q, q1 } = require('../db')
const { wrap, buildUpdate } = require('../lib/http')

const router = express.Router()

const UPDATABLE = [
  'person_id', 'person_name', 'content', 'type', 'aspect', 'status',
  'deadline', 'deadline_type', 'deadline_time', 'recurrence', 'recurrence_time',
  'recurrence_days', 'done_criteria', 'notes', 'integrity_note',
]

// GET /promises
router.get('/', wrap(async (req, res) => {
  const rows = await q(`
    SELECT p.*,
      (SELECT COUNT(*) FROM steps s WHERE s.promise_id = p.id) AS step_count,
      (SELECT COUNT(*) FROM steps s WHERE s.promise_id = p.id AND s.done = 1) AS steps_done
    FROM promises p
    WHERE p.user_id = $1 AND p.status != 'deleted'
    ORDER BY
      CASE p.status WHEN 'draft' THEN 2 ELSE 1 END,
      CASE WHEN p.deadline IS NULL THEN 1 ELSE 0 END,
      p.deadline ASC,
      p.created_at ASC
  `, [req.userId])
  res.json(rows)
}))

// POST /promises  { ...data }
router.post('/', wrap(async (req, res) => {
  const d = req.body || {}
  const row = await q1(`
    INSERT INTO promises
      (user_id, person_id, person_name, content, type, aspect, status, deadline, deadline_type, deadline_time,
       recurrence, recurrence_time, recurrence_days, done_criteria, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *
  `, [
    req.userId,
    d.person_id || null,
    d.person_name || '',
    d.content,
    d.type || 'single',
    d.aspect || 'personal',
    d.status || 'active',
    d.deadline || null,
    d.deadline_type || 'soft',
    d.deadline_time || null,
    d.recurrence || null,
    d.recurrence_time || null,
    d.recurrence_days || null,
    d.done_criteria || null,
    d.notes || null,
  ])
  res.json(row)
}))

// PUT /promises/:id  { ...fields }
router.put('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const upd = buildUpdate(req.body, UPDATABLE)
  if (!upd) return res.json(await q1('SELECT * FROM promises WHERE id = $1 AND user_id = $2', [id, req.userId]))
  // user_id is appended as the last param so the row can only be updated by its owner.
  const idIdx = upd.nextIndex
  const userIdx = upd.nextIndex + 1
  const sql = `UPDATE promises SET ${upd.clause}, updated_at = to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
               WHERE id = $${idIdx} AND user_id = $${userIdx} RETURNING *`
  res.json(await q1(sql, [...upd.values, id, req.userId]))
}))

// DELETE /promises/:id  (soft delete)
router.delete('/:id', wrap(async (req, res) => {
  await q(`UPDATE promises SET status = 'deleted' WHERE id = $1 AND user_id = $2`,
    [Number(req.params.id), req.userId])
  res.json({ ok: true })
}))

module.exports = router
