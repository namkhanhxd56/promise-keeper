const { q, q1 } = require('../db')
const { weekdayId } = require('./dates')

// Build the ordered list of todos for a given date (one-off + recurring habits).
// Scoped to a single user.
async function getTodosForDate(date, userId) {
  const normal = await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.user_id = $2 AND t.scheduled_date = $1 AND t.snoozed = 0 AND COALESCE(t.recurring,0) = 0
  `, [date, userId])

  const wd = weekdayId(date)
  const recRows = await q(`
    SELECT t.*, p.content AS promise_content, p.aspect AS promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.user_id = $3 AND COALESCE(t.recurring,0) = 1
      AND (',' || t.recurrence_days || ',') LIKE $1
      AND substr(t.created_at, 1, 10) <= $2
      AND t.id NOT IN (SELECT todo_id FROM todo_skips WHERE date = $2)
  `, ['%,' + wd + ',%', date, userId])

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

// Batched version of getTodosForDate for many dates at once (one user).
// Returns Map<dateStr, { total, done }>.
async function todoCountsForDates(dates, userId) {
  const result = new Map()
  if (!dates.length) return result
  for (const d of dates) result.set(d, { total: 0, done: 0 })

  let minDate = dates[0], maxDate = dates[0]
  for (const d of dates) { if (d < minDate) minDate = d; if (d > maxDate) maxDate = d }

  // 1) Non-recurring todos scheduled in range
  const normal = await q(`
    SELECT scheduled_date, done
    FROM todos
    WHERE user_id = $3 AND snoozed = 0 AND COALESCE(recurring,0) = 0
      AND scheduled_date BETWEEN $1 AND $2
  `, [minDate, maxDate, userId])
  for (const t of normal) {
    const c = result.get(t.scheduled_date)
    if (!c) continue
    c.total++
    if (t.done) c.done++
  }

  // 2) Recurring habits + their skips/completions (loaded once, this user only)
  const recurring = await q(`
    SELECT id, recurrence_days, substr(created_at,1,10) AS created_day
    FROM todos
    WHERE user_id = $1 AND COALESCE(recurring,0) = 1
  `, [userId])
  const skips = new Set((await q(
    `SELECT s.todo_id, s.date FROM todo_skips s JOIN todos t ON s.todo_id = t.id WHERE t.user_id = $1`, [userId]
  )).map(r => r.todo_id + '|' + r.date))
  const comps = new Set((await q(
    `SELECT c.todo_id, c.date FROM todo_completions c JOIN todos t ON c.todo_id = t.id WHERE t.user_id = $1`, [userId]
  )).map(r => r.todo_id + '|' + r.date))

  for (const d of dates) {
    const wd = weekdayId(d)
    const c = result.get(d)
    for (const t of recurring) {
      if (!t.recurrence_days) continue
      if (!(',' + t.recurrence_days + ',').includes(',' + wd + ',')) continue
      if (t.created_day && t.created_day > d) continue
      if (skips.has(t.id + '|' + d)) continue
      c.total++
      if (comps.has(t.id + '|' + d)) c.done++
    }
  }
  return result
}

// Set of dates that "count" as active (>=1 completed todo) for one user.
async function completedDateSet(userId) {
  const set = new Set()
  for (const r of await q(
    `SELECT DISTINCT scheduled_date d FROM todos WHERE user_id = $1 AND done = 1 AND scheduled_date IS NOT NULL AND COALESCE(recurring,0) = 0`,
    [userId]
  )) set.add(r.d)
  for (const r of await q(
    `SELECT DISTINCT c.date d FROM todo_completions c JOIN todos t ON c.todo_id = t.id WHERE t.user_id = $1`,
    [userId]
  )) set.add(r.d)
  return set
}

module.exports = { getTodosForDate, todoCountsForDates, completedDateSet }
