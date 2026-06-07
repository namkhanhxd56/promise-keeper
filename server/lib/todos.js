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

// Batched version of getTodosForDate for many dates at once.
// Returns Map<dateStr, { total, done }>. Replaces calling getTodosForDate in a
// loop (which fired ~2-3 queries per day → dozens of network round-trips).
// Here we read all relevant rows in ~5 queries and compute counts in memory.
async function todoCountsForDates(dates) {
  const result = new Map()
  if (!dates.length) return result
  for (const d of dates) result.set(d, { total: 0, done: 0 })

  const dateSet = new Set(dates)
  let minDate = dates[0], maxDate = dates[0]
  for (const d of dates) { if (d < minDate) minDate = d; if (d > maxDate) maxDate = d }

  // 1) Non-recurring todos scheduled in range
  const normal = await q(`
    SELECT scheduled_date, done
    FROM todos
    WHERE snoozed = 0 AND COALESCE(recurring,0) = 0
      AND scheduled_date BETWEEN $1 AND $2
  `, [minDate, maxDate])
  for (const t of normal) {
    const c = result.get(t.scheduled_date)
    if (!c) continue
    c.total++
    if (t.done) c.done++
  }

  // 2) Recurring habits + their skips/completions (loaded once)
  const recurring = await q(`
    SELECT id, recurrence_days, substr(created_at,1,10) AS created_day
    FROM todos
    WHERE COALESCE(recurring,0) = 1
  `)
  const skips = new Set((await q(`SELECT todo_id, date FROM todo_skips`)).map(r => r.todo_id + '|' + r.date))
  const comps = new Set((await q(`SELECT todo_id, date FROM todo_completions`)).map(r => r.todo_id + '|' + r.date))

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

// Set of dates that "count" as active (>=1 completed todo).
async function completedDateSet() {
  const set = new Set()
  for (const r of await q(`SELECT DISTINCT scheduled_date d FROM todos WHERE done = 1 AND scheduled_date IS NOT NULL AND COALESCE(recurring,0) = 0`)) set.add(r.d)
  for (const r of await q(`SELECT DISTINCT date d FROM todo_completions`)) set.add(r.d)
  return set
}

module.exports = { getTodosForDate, todoCountsForDates, completedDateSet }
