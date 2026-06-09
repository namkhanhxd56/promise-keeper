const express = require('express')
const { q, q1 } = require('../db')
const { wrap, buildUpdate } = require('../lib/http')
const { localDateStr, today } = require('../lib/dates')
const { getTodosForDate } = require('../lib/todos')

const router = express.Router()

const UPDATABLE = [
  'promise_id', 'step_id', 'title', 'scheduled_date', 'scheduled_time', 'end_time',
  'done', 'snoozed', 'original_date', 'recurring', 'recurrence_days', 'aspect', 'duration_min',
]

// GET /todos?date=YYYY-MM-DD
router.get('/', wrap(async (req, res) => {
  const date = req.query.date
  if (!date) return res.status(400).json({ error: 'date query param required' })
  res.json(await getTodosForDate(String(date)))
}))

// GET /todos/history — past days (before today) that had todos, newest first
router.get('/history', wrap(async (_req, res) => {
  // Daily reviews (note + mood) keyed by date, attached to each day below.
  const reviews = new Map(
    (await q('SELECT date, note, mood FROM daily_reviews')).map(r => [r.date, r])
  )
  const days = []
  for (let i = 1; i <= 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const date = localDateStr(d)
    const todos = await getTodosForDate(date)
    if (todos.length === 0) continue
    const done = todos.filter(t => t.done).length
    const rv = reviews.get(date)
    days.push({ date, total: todos.length, done, todos, mood: rv?.mood ?? null, note: rv?.note ?? null })
  }
  res.json(days)
}))

// GET /todos/tomorrow — full list for tomorrow (one-off + recurring habits)
router.get('/tomorrow', wrap(async (_req, res) => {
  const t = new Date(); t.setDate(t.getDate() + 1)
  res.json(await getTodosForDate(localDateStr(t)))
}))

// GET /todos/upcoming — one-off todos AFTER tomorrow (no recurring habits)
router.get('/upcoming', wrap(async (_req, res) => {
  const t = new Date(); t.setDate(t.getDate() + 1)
  const tomorrow = localDateStr(t)
  res.json(await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.scheduled_date > $1 AND t.snoozed = 0 AND COALESCE(t.recurring,0) = 0
    ORDER BY t.scheduled_date ASC,
      CASE WHEN t.scheduled_time IS NULL THEN 1 ELSE 0 END,
      t.scheduled_time ASC, t.id ASC
  `, [tomorrow]))
}))

// GET /todos/habits — all recurring templates, sorted by time of day
router.get('/habits', wrap(async (_req, res) => {
  res.json(await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE COALESCE(t.recurring,0) = 1
    ORDER BY
      CASE WHEN t.scheduled_time IS NOT NULL THEN 0 WHEN t.end_time IS NOT NULL THEN 1 ELSE 2 END,
      COALESCE(t.scheduled_time, t.end_time) ASC,
      t.id ASC
  `))
}))

// GET /todos/past — overdue, unfinished one-off todos
router.get('/past', wrap(async (_req, res) => {
  res.json(await q(`
    SELECT t.*, p.content AS promise_content
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.scheduled_date < $1 AND t.done = 0 AND t.snoozed = 0
    ORDER BY t.scheduled_date DESC, t.scheduled_time ASC
    LIMIT 20
  `, [today()]))
}))

// POST /todos  { ...data }
router.post('/', wrap(async (req, res) => {
  const data = req.body || {}
  const recurring = data.recurring ? 1 : 0
  let stepId = data.step_id || null

  // Linking a todo to a promise registers it as a step of that promise.
  if (data.promise_id && !stepId) {
    const max = await q1('SELECT MAX(order_num) AS m FROM steps WHERE promise_id = $1', [data.promise_id])
    const sr = await q1(`
      INSERT INTO steps (promise_id, title, order_num, start_date, end_date, start_time, end_time)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `, [
      data.promise_id, data.title, (max?.m || 0) + 1,
      recurring ? null : (data.scheduled_date || null),
      recurring ? null : (data.scheduled_date || null),
      data.scheduled_time || null, data.end_time || null,
    ])
    stepId = sr.id
    await q(`UPDATE promises SET type = 'plan' WHERE id = $1 AND type = 'single'`, [data.promise_id])
  } else if (stepId) {
    await q('UPDATE steps SET start_time = $1, end_time = $2 WHERE id = $3',
      [data.scheduled_time || null, data.end_time || null, stepId])
  }

  const row = await q1(`
    INSERT INTO todos (promise_id, step_id, title, scheduled_date, scheduled_time, end_time, recurring, recurrence_days, aspect, duration_min)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `, [
    data.promise_id || null,
    stepId,
    data.title,
    recurring ? null : (data.scheduled_date || null),
    data.scheduled_time || null,
    data.end_time || null,
    recurring,
    recurring ? (data.recurrence_days || null) : null,
    data.aspect || null,
    (data.duration_min != null && data.duration_min > 0) ? data.duration_min : null,
  ])
  res.json(row)
}))

// POST /todos/:id/toggle  { date }
router.post('/:id/toggle', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const date = req.body?.date
  const t = await q1('SELECT * FROM todos WHERE id = $1', [id])
  if (!t) return res.status(404).json({ error: 'Todo not found' })
  // Recurring todos track completion per day
  if (t.recurring) {
    const exists = await q1('SELECT 1 AS x FROM todo_completions WHERE todo_id = $1 AND date = $2', [id, date])
    if (exists) await q('DELETE FROM todo_completions WHERE todo_id = $1 AND date = $2', [id, date])
    else await q('INSERT INTO todo_completions (todo_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, date])
    return res.json({ ok: true })
  }
  res.json(await q1('UPDATE todos SET done = $1 WHERE id = $2 RETURNING *', [t.done ? 0 : 1, id]))
}))

// POST /todos/:id/snooze  { newDate }
router.post('/:id/snooze', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const newDate = req.body?.newDate
  const t = await q1('SELECT * FROM todos WHERE id = $1', [id])
  if (!t) return res.status(404).json({ error: 'Todo not found' })
  await q('UPDATE todos SET scheduled_date = $1, original_date = $2, snoozed = 0 WHERE id = $3',
    [newDate, t.original_date || t.scheduled_date, id])
  res.json({ ok: true })
}))

// PUT /todos/:id  { ...fields }
router.put('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const data = req.body || {}
  const upd = buildUpdate(data, UPDATABLE)
  if (upd) {
    await q1(`UPDATE todos SET ${upd.clause} WHERE id = $${upd.nextIndex} RETURNING *`, [...upd.values, id])
  }
  // Keep the linked step's planned times in sync with the todo
  if (data.step_id && ('scheduled_time' in data || 'end_time' in data)) {
    await q('UPDATE steps SET start_time = $1, end_time = $2 WHERE id = $3',
      [data.scheduled_time || null, data.end_time || null, data.step_id])
  }
  res.json(await q1('SELECT * FROM todos WHERE id = $1', [id]))
}))

// DELETE /todos/:id?scope=today&date=YYYY-MM-DD
router.delete('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const { scope, date } = req.query
  const t = await q1('SELECT * FROM todos WHERE id = $1', [id])
  // For a recurring habit, "today only" just skips this one date
  if (t && t.recurring && scope === 'today' && date) {
    await q('INSERT INTO todo_skips (todo_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, String(date)])
    return res.json({ ok: true })
  }
  await q('DELETE FROM todos WHERE id = $1', [id])
  res.json({ ok: true })
}))

module.exports = router
