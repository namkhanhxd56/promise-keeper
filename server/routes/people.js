const express = require('express')
const { q, q1 } = require('../db')
const { wrap } = require('../lib/http')

const router = express.Router()

// GET /people
router.get('/', wrap(async (req, res) => {
  res.json(await q('SELECT * FROM people WHERE user_id = $1 ORDER BY id ASC', [req.userId]))
}))

// POST /people  { name, relation }
router.post('/', wrap(async (req, res) => {
  const { name, relation } = req.body || {}
  const row = await q1(
    'INSERT INTO people (user_id, name, relation) VALUES ($1, $2, $3) RETURNING *',
    [req.userId, name, relation || 'other']
  )
  res.json(row)
}))

// DELETE /people/:id
router.delete('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const person = await q1('SELECT relation FROM people WHERE id = $1 AND user_id = $2', [id, req.userId])
  if (!person) return res.status(404).json({ error: 'Không tìm thấy' })
  if (person.relation === 'self') return res.status(400).json({ error: 'Cannot delete self' })
  await q('DELETE FROM people WHERE id = $1 AND user_id = $2', [id, req.userId])
  res.json({ ok: true })
}))

module.exports = router
