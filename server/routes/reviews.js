const express = require('express')
const { q, q1 } = require('../db')
const { wrap } = require('../lib/http')

const router = express.Router()

// GET /reviews/:date — the daily review (note + mood) for a date, or null
router.get('/:date', wrap(async (req, res) => {
  const date = String(req.params.date)
  res.json(await q1('SELECT * FROM daily_reviews WHERE date = $1', [date]))
}))

// PUT /reviews/:date  { note, mood } — upsert the day's review
router.put('/:date', wrap(async (req, res) => {
  const date = String(req.params.date)
  const note = req.body?.note ?? null
  const moodRaw = req.body?.mood
  const mood = moodRaw == null || moodRaw === '' ? null : Number(moodRaw)
  const row = await q1(`
    INSERT INTO daily_reviews (date, note, mood, updated_at)
    VALUES ($1, $2, $3, to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'))
    ON CONFLICT (date) DO UPDATE
      SET note = EXCLUDED.note,
          mood = EXCLUDED.mood,
          updated_at = EXCLUDED.updated_at
    RETURNING *
  `, [date, note, mood])
  res.json(row)
}))

module.exports = router
