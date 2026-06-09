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
  res.json(await getTodosForDate(String(date), req.userId))
}))

// GET /todos/history — past days (before today) that had todos, newest first
router.get('/history', wrap(async (req, res) => {
  // Daily reviews (note + mood) keyed by date, attached to each day below.
  const reviews = new Map(
    (await q('SELECT date, note, mood FROM daily_reviews WHERE user_id = $1', [req.userId])).map(r => [r.date, r])
  )
  const days = []
  for (let i = 1; i <= 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const date = localDateStr(d)
    const todos = await getTodosForDate(date, req.userId)
    if (todos.length === 0) continue
    const done = todos.filter(t => t.done).length
    const rv = reviews.get(date)
    days.push({ date, total: todos.length, done, todos, mood: rv?.mood ?? null, note: rv?.note ?? null })
  }
  res.json(days)
}))

// GET /todos/tomorrow — full list for tomorrow (one-off + recurring habits)
router.get('/tomorrow', wrap(async (req, res) => {
  const t = new Date(); t.setDate(t.getDate() + 1)
  res.json(await getTodosForDate(localDateStr(t), req.userId))
}))

// GET /todos/upcoming — one-off todos AFTER tomorrow (no recurring habits)
router.get('/upcoming', wrap(async (req, res) => {
  const t = new Date(); t.setDate(t.getDate() + 1)
  const tomorrow = localDateStr(t)
  res.json(await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.user_id = $2 AND t.scheduled_date > $1 AND t.snoozed = 0 AND COALESCE(t.recurring,0) = 0
    ORDER BY t.scheduled_date ASC,
      CASE WHEN t.scheduled_time IS NULL THEN 1 ELSE 0 END,
      t.scheduled_time ASC, t.id ASC
  `, [tomorrow, req.userId]))
}))

// GET /todos/habits — all recurring templates, sorted by time of day
router.get('/habits', wrap(async (req, res) => {
  res.json(await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.user_id = $1 AND COALESCE(t.recurring,0) = 1
    ORDER BY
      CASE WHEN t.scheduled_time IS NOT NULL THEN 0 WHEN t.end_time IS NOT NULL THEN 1 ELSE 2 END,
      COALESCE(t.scheduled_time, t.end_time) ASC,
      t.id ASC
  `, [req.userId]))
}))

// GET /todos/past — overdue, unfinished one-off todos
router.get('/past', wrap(async (req, res) => {
  res.json(await q(`
    SELECT t.*, p.content AS promise_content
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.user_id = $2 AND t.scheduled_date < $1 AND t.done = 0 AND t.snoozed = 0
    ORDER BY t.scheduled_date DESC, t.scheduled_time ASC
    LIMIT 20
  `, [today(), req.userId]))
}))

// POST /todos  { ...data }
router.post('/', wrap(async (req, res) => {
  const data = req.body || {}
  const recurring = data.recurring ? 1 : 0
  let stepId = data.step_id || null

  // If linking to a promise, verify ownership before touching its steps.
  let promiseId = data.promise_id || null
  if (promiseId) {
    const owns = await q1('SELECT 1 AS x FROM promises WHERE id = $1 AND user_id = $2', [promiseId, req.userId])
    if (!owns) return res.status(404).json({ error: 'Không tìm thấy' })
  }

  // Linking a todo to a promise registers it as a step of that promise.
  if (promiseId && !stepId) {
    const max = await q1('SELECT MAX(order_num) AS m FROM steps WHERE promise_id = $1', [promiseId])
    const sr = await q1(`
      INSERT INTO steps (promise_id, title, order_num, start_date, end_date, start_time, end_time)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `, [
      promiseId, data.title, (max?.m || 0) + 1,
      recurring ? null : (data.scheduled_date || null),
      recurring ? null : (data.scheduled_date || null),
      data.scheduled_time || null, data.end_time || null,
    ])
    stepId = sr.id
    await q(`UPDATE promises SET type = 'plan' WHERE id = $1 AND type = 'single'`, [promiseId])
  } else if (stepId) {
    // Verify the step belongs to the user before mutating it.
    const ownsStep = await q1(
      `SELECT 1 AS x FROM steps s JOIN promises p ON s.promise_id = p.id WHERE s.id = $1 AND p.user_id = $2`,
      [stepId, req.userId])
    if (!ownsStep) return res.status(404).json({ error: 'Không tìm thấy' })
    await q('UPDATE steps SET start_time = $1, end_time = $2 WHERE id = $3',
      [data.scheduled_time || null, data.end_time || null, stepId])
  }

  const row = await q1(`
    INSERT INTO todos (user_id, promise_id, step_id, title, scheduled_date, scheduled_time, end_time, recurring, recurrence_days, aspect, duration_min)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
  `, [
    req.userId,
    promiseId,
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
  const t = await q1('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [id, req.userId])
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
  const t = await q1('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [id, req.userId])
  if (!t) return res.status(404).json({ error: 'Todo not found' })
  await q('UPDATE todos SET scheduled_date = $1, original_date = $2, snoozed = 0 WHERE id = $3 AND user_id = $4',
    [newDate, t.original_date || t.scheduled_date, id, req.userId])
  res.json({ ok: true })
}))

// PUT /todos/:id  { ...fields }
router.put('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const data = req.body || {}
  const existing = await q1('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [id, req.userId])
  if (!existing) return res.status(404).json({ error: 'Todo not found' })
  const upd = buildUpdate(data, UPDATABLE)
  if (upd) {
    const idIdx = upd.nextIndex
    const userIdx = upd.nextIndex + 1
    await q1(`UPDATE todos SET ${upd.clause} WHERE id = $${idIdx} AND user_id = $${userIdx} RETURNING *`,
      [...upd.values, id, req.userId])
  }
  // Keep the linked step's planned times in sync with the todo (ownership already verified above).
  if (data.step_id && ('scheduled_time' in data || 'end_time' in data)) {
    await q(`UPDATE steps s SET start_time = $1, end_time = $2
             FROM promises p WHERE s.id = $3 AND s.promise_id = p.id AND p.user_id = $4`,
      [data.scheduled_time || null, data.end_time || null, data.step_id, req.userId])
  }
  res.json(await q1('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [id, req.userId]))
}))

// DELETE /todos/:id?scope=today&date=YYYY-MM-DD
router.delete('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)
  const { scope, date } = req.query
  const t = await q1('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [id, req.userId])
  if (!t) return res.status(404).json({ error: 'Todo not found' })
  // For a recurring habit, "today only" just skips this one date
  if (t.recurring && scope === 'today' && date) {
    await q('INSERT INTO todo_skips (todo_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, String(date)])
    return res.json({ ok: true })
  }
  await q('DELETE FROM todos WHERE id = $1 AND user_id = $2', [id, req.userId])
  res.json({ ok: true })
}))

module.exports = router
