const express = require('express')
const { q, q1 } = require('../db')
const { wrap } = require('../lib/http')
const { today } = require('../lib/dates')

const router = express.Router()

// GET /integrity/score
router.get('/score', wrap(async (req, res) => {
  const t = today()
  const u = req.userId
  const futureCond = `status = 'active' AND deadline IS NOT NULL AND deadline > $1`

  const total = (await q1(`
    SELECT COUNT(*)::int AS c FROM promises
    WHERE user_id = $2 AND status NOT IN ('draft','deleted') AND NOT (${futureCond})
  `, [t, u])).c
  const kept = (await q1(`SELECT COUNT(*)::int AS c FROM promises WHERE user_id = $1 AND status = 'done'`, [u])).c
  const broken = (await q1(`SELECT COUNT(*)::int AS c FROM promises WHERE user_id = $1 AND status = 'broken'`, [u])).c
  const upcoming = (await q1(`SELECT COUNT(*)::int AS c FROM promises WHERE user_id = $2 AND ${futureCond}`, [t, u])).c

  const todoTotal = (await q1(`SELECT COUNT(*)::int AS c FROM todos WHERE user_id = $2 AND scheduled_date <= $1 AND COALESCE(recurring,0) = 0`, [t, u])).c
  const todoDone = (await q1(`SELECT COUNT(*)::int AS c FROM todos WHERE user_id = $2 AND scheduled_date <= $1 AND done = 1 AND COALESCE(recurring,0) = 0`, [t, u])).c

  res.json({ total, kept, broken, upcoming, todoTotal, todoDone })
}))

// GET /integrity/monthly
router.get('/monthly', wrap(async (req, res) => {
  const t = today()
  const u = req.userId
  const curMonth = t.slice(0, 7)

  const map = {}
  const ensure = (m) => {
    if (!map[m]) map[m] = { month: m, total: 0, kept: 0, broken: 0, upcoming: 0, todoTotal: 0, todoDone: 0 }
    return map[m]
  }
  ensure(curMonth)

  const promiseRows = await q(`
    SELECT substr(COALESCE(deadline, substr(created_at,1,10)), 1, 7) AS month, status, deadline
    FROM promises
    WHERE user_id = $1 AND status NOT IN ('draft','deleted')
  `, [u])
  for (const r of promiseRows) {
    const b = ensure(r.month)
    const isFuture = r.status === 'active' && r.deadline && r.deadline > t
    if (isFuture) { b.upcoming++; continue }
    b.total++
    if (r.status === 'done') b.kept++
    else if (r.status === 'broken') b.broken++
  }

  const todoRows = await q(`
    SELECT substr(scheduled_date, 1, 7) AS month, done
    FROM todos
    WHERE user_id = $2 AND scheduled_date IS NOT NULL AND scheduled_date <= $1 AND COALESCE(recurring,0) = 0
  `, [t, u])
  for (const r of todoRows) {
    const b = ensure(r.month)
    b.todoTotal++
    if (r.done) b.todoDone++
  }

  res.json(
    Object.values(map)
      .filter(x => x.month <= curMonth)
      .sort((a, b) => (a.month < b.month ? 1 : -1))
  )
}))

module.exports = router
