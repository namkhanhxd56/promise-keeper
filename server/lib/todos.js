const { q, q1 } = require('../db')
const { weekdayId } = require('./dates')

// Build the ordered list of todos for a given date (one-off + recurring habits).
// Ported from the Electron main process (better-sqlite3) to async pg.
async function getTodosForDate(date) {
  const normal = await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.scheduled_date = $1 AND t.snoozed = 0 AND COALESCE(t.recurring,0) = 0
  `, [date])

  const wd = weekdayId(date)
  const recRows = await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE COALESCE(t.recurring,0) = 1
      AND (',' || t.recurrence_days || ',') LIKE $1
      AND substr(t.created_at, 1, 10) <= $2
      AND t.id NOT IN (SELECT todo_id FROM todo_skips WHERE date = $3)
  `, ['%,' + wd + ',%', date, date])

  const recurring = []
  for (const t of recRows) {
    const done = await q1('SELECT 1 AS x FROM todo_completions WHERE todo_id = $1 AND date = $2', [t.id, date])
    recurring.push({ ...t, scheduled_date: date, done: done ? 1 : 0 })
  }

  const all = [...normal, ...recurring]
  // Ordering:
  //  1) tasks with a start time → by start time asc
  //  2) tasks with only an end time → by end time asc
  //  3) tasks with no time → last, by id
  const rank = (t) => t.scheduled_time ? 0 : (t.end_time ? 1 : 2)
  all.sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra !== rb) return ra - rb
    if (ra === 0) return a.scheduled_time === b.scheduled_time ? a.id - b.id : (a.scheduled_time < b.scheduled_time ? -1 : 1)
    if (ra === 1) return a.end_time === b.end_time ? a.id - b.id : (a.end_time < b.end_time ? -1 : 1)
    return a.id - b.id
  })
  return all
}

// Set of dates that "count" as active (>=1 completed todo).
async function completedDateSet() {
  const set = new Set()
  for (const r of await q(`SELECT DISTINCT scheduled_date d FROM todos WHERE done = 1 AND scheduled_date IS NOT NULL AND COALESCE(recurring,0) = 0`)) set.add(r.d)
  for (const r of await q(`SELECT DISTINCT date d FROM todo_completions`)) set.add(r.d)
  return set
}

module.exports = { getTodosForDate, completedDateSet }
