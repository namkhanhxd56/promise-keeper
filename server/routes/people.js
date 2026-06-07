const express = require('express')
const { q, q1 } = require('../db')
const { wrap } = require('../lib/http')

const router = express.Router()

// GET /people
router.get('/', wrap(async (_req, res) => {
  res.json(await q('SELECT * FROM people ORDER BY id ASC'))
}))

// POST /people  { name, relation }
router.post('/', wrap(async (req, res) => {
  const { name, relation } = req.body || {}
  const row = await q1(
    'INSERT INTO people (name, relation) VALUES ($1, $2) RETURNING *',
    [name, relation || 'other']
  )
  res.json(row)
}))

// DELETE /people/:id
router.delete('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (id === 1) return res.status(400).json({ error: 'Cannot delete self' })
  await q('DELETE FROM people WHERE id = $1', [id])
  res.json({ ok: true })
}))

module.exports = router
