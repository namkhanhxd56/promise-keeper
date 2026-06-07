const express = require('express')
const { q, q1 } = require('../db')
const { wrap } = require('../lib/http')
const { localDateStr, today } = require('../lib/dates')
const { todoCountsForDates, completedDateSet } = require('../lib/todos')

const router = express.Router()

// A day "counts" (active) when it has >=1 completed todo.
// Streak breaks on 2 consecutive missed days, unless a day is rescued (max 2 / month).
// GET /streak/stats
router.get('/stats', wrap(async (_req, res) => {
  const t = today()
  const completed = await completedDateSet()
  const rescues = new Set((await q(`SELECT date FROM streak_rescues`)).map(r => r.date))

  const minTodo = (await q1(`SELECT MIN(scheduled_date) m FROM todos WHERE scheduled_date IS NOT NULL`))?.m
  const minComp = (await q1(`SELECT MIN(date) m FROM todo_completions`))?.m
  const firstDate = [minTodo, minComp].filter(Boolean).sort()[0] || t

  const end = new Date(t + 'T00:00:00')
  const start = new Date(firstDate + 'T00:00:00')

  let run = 0, miss = 0, record = 0, activeDays = 0, totalDays = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = localDateStr(d)
    totalDays++
    if (completed.has(ds)) {
      activeDays++; run++; miss = 0
      if (run > record) record = run
    } else if (rescues.has(ds)) {
      miss = 0
    } else {
      miss++
      if (miss >= 2) { run = 0; miss = 0 }
    }
  }
  const current = run
  const consistency = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0
  const curMonth = t.slice(0, 7)
  const rescuesThisMonth = (await q1(`SELECT COUNT(*)::int c FROM streak_rescues WHERE substr(date,1,7) = $1`, [curMonth])).c
  const rescuesLeft = Math.max(0, 2 - rescuesThisMonth)

  // Recent missed (uncovered) days, last 14 days excluding today
  const recentMisses = []
  for (let i = 1; i <= 14; i++) {
    const d = new Date(end); d.setDate(d.getDate() - i)
    const ds = localDateStr(d)
    if (ds < firstDate) break
    if (!completed.has(ds) && !rescues.has(ds)) recentMisses.push(ds)
  }

  // Collect all dates we need counts for: 30-day trend + current-month calendar.
  const trendDates = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i)
    trendDates.push(localDateStr(d))
  }
  const cy = end.getFullYear(), cm = end.getMonth()
  const daysInMonth = new Date(cy, cm + 1, 0).getDate()
  const calDates = []
  for (let day = 1; day <= daysInMonth; day++) calDates.push(localDateStr(new Date(cy, cm, day)))

  // One batched read instead of ~60 sequential getTodosForDate() calls.
  const neededDates = [...new Set([...trendDates, ...calDates.filter(ds => ds <= t)])]
  const counts = await todoCountsForDates(neededDates)
  const cnt = (ds) => counts.get(ds) || { total: 0, done: 0 }

  // 30-day completion-rate trend
  const trend = trendDates.map(ds => {
    const { total, done } = cnt(ds)
    return { date: ds, total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
  })

  // Current-month calendar
  const calendar = calDates.map((ds, idx) => {
    const isFuture = ds > t
    const { total, done } = isFuture ? { total: 0, done: 0 } : cnt(ds)
    return { date: ds, day: idx + 1, total, done, isFuture, completed: completed.has(ds), rescued: rescues.has(ds) }
  })

  // At-risk day: streak alive, yesterday missed (uncovered) → prompt to rescue.
  let atRisk = null
  {
    const y = new Date(end); y.setDate(y.getDate() - 1); const yds = localDateStr(y)
    const b = new Date(end); b.setDate(b.getDate() - 2); const bds = localDateStr(b)
    if (yds >= firstDate && !completed.has(yds) && !rescues.has(yds) && rescuesLeft > 0
        && (completed.has(bds) || rescues.has(bds))) {
      atRisk = yds
    }
  }

  res.json({ current, record, activeDays, totalDays, firstDate, consistency, rescuesLeft, recentMisses, atRisk, trend, calendar })
}))

// POST /streak/rescue  { date }
router.post('/rescue', wrap(async (req, res) => {
  const date = req.body?.date
  const curMonth = today().slice(0, 7)
  const used = (await q1(`SELECT COUNT(*)::int c FROM streak_rescues WHERE substr(date,1,7) = $1`, [curMonth])).c
  if (used >= 2) return res.status(400).json({ error: 'Hết lượt cứu streak tháng này' })
  await q(`INSERT INTO streak_rescues (date) VALUES ($1) ON CONFLICT DO NOTHING`, [date])
  res.json({ ok: true })
}))

module.exports = router
