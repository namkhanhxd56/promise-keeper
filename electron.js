const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Database = require('better-sqlite3')
const fs = require('fs')

const isDev = process.env.NODE_ENV !== 'production'

// DB path: dev = project folder, prod = userData
const dbPath = isDev
  ? path.join(__dirname, 'backend', 'promises.db')
  : path.join(app.getPath('userData'), 'promises.db')

// Ensure backend dir exists
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
}

let db

function initDB() {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      relation TEXT DEFAULT 'other',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS promises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER REFERENCES people(id),
      person_name TEXT,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'single',
      aspect TEXT DEFAULT 'personal',
      status TEXT DEFAULT 'active',
      deadline TEXT,
      deadline_type TEXT DEFAULT 'soft',
      recurrence TEXT,
      recurrence_time TEXT,
      recurrence_days TEXT,
      done_criteria TEXT,
      notes TEXT,
      integrity_note TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promise_id INTEGER NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_num INTEGER DEFAULT 0,
      done INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promise_id INTEGER REFERENCES promises(id) ON DELETE SET NULL,
      step_id INTEGER REFERENCES steps(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      scheduled_date TEXT,
      scheduled_time TEXT,
      done INTEGER DEFAULT 0,
      snoozed INTEGER DEFAULT 0,
      original_date TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Seed default people if empty
    INSERT OR IGNORE INTO people (id, name, relation) VALUES (1, 'Tôi (bản thân)', 'self');
  `)

  // Run migrations for any missing columns
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN snoozed INTEGER DEFAULT 0`)
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN original_date TEXT`)
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN recurring INTEGER DEFAULT 0`)
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN recurrence_days TEXT`)
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN end_time TEXT`)
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN aspect TEXT`)
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE promises ADD COLUMN deadline_time TEXT`)
  } catch(e) {}
  // Steps: planning fields (start/end date & time)
  try { db.exec(`ALTER TABLE steps ADD COLUMN start_date TEXT`) } catch(e) {}
  try { db.exec(`ALTER TABLE steps ADD COLUMN end_date TEXT`) } catch(e) {}
  try { db.exec(`ALTER TABLE steps ADD COLUMN start_time TEXT`) } catch(e) {}
  try { db.exec(`ALTER TABLE steps ADD COLUMN end_time TEXT`) } catch(e) {}

  // Per-day state for recurring (habit) todos
  db.exec(`
    CREATE TABLE IF NOT EXISTS todo_completions (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      PRIMARY KEY (todo_id, date)
    );
    CREATE TABLE IF NOT EXISTS todo_skips (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      PRIMARY KEY (todo_id, date)
    );
    -- Manually used streak rescues (max 2 per calendar month)
    CREATE TABLE IF NOT EXISTS streak_rescues (
      date TEXT PRIMARY KEY
    );
  `)
}

// Map JS getDay() (0=Sun) → day id used by the UI
const WEEKDAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
function weekdayId(dateStr) {
  return WEEKDAY_IDS[new Date(dateStr + 'T00:00:00').getDay()]
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Build the ordered list of todos for a given date (one-off + recurring habits)
function getTodosForDate(date) {
  const normal = db.prepare(`
    SELECT t.*, p.content as promise_content, p.aspect as promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.scheduled_date = ? AND t.snoozed = 0 AND COALESCE(t.recurring,0) = 0
  `).all(date)

  const wd = weekdayId(date)
  const recurring = db.prepare(`
    SELECT t.*, p.content as promise_content, p.aspect as promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE COALESCE(t.recurring,0) = 1
      AND (',' || t.recurrence_days || ',') LIKE ?
      AND date(t.created_at) <= ?
      AND t.id NOT IN (SELECT todo_id FROM todo_skips WHERE date = ?)
  `).all('%,' + wd + ',%', date, date).map(t => ({
    ...t,
    scheduled_date: date,
    done: db.prepare('SELECT 1 FROM todo_completions WHERE todo_id = ? AND date = ?').get(t.id, date) ? 1 : 0
  }))

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

// ─── IPC Handlers ────────────────────────────────────────────

// People
ipcMain.handle('people:list', () => {
  return db.prepare('SELECT * FROM people ORDER BY id ASC').all()
})
ipcMain.handle('people:add', (_, name, relation) => {
  const r = db.prepare('INSERT INTO people (name, relation) VALUES (?, ?)').run(name, relation || 'other')
  return db.prepare('SELECT * FROM people WHERE id = ?').get(r.lastInsertRowid)
})
ipcMain.handle('people:delete', (_, id) => {
  if (id === 1) return { error: 'Cannot delete self' }
  db.prepare('DELETE FROM people WHERE id = ?').run(id)
  return { ok: true }
})

// Promises
ipcMain.handle('promises:list', () => {
  const rows = db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM steps s WHERE s.promise_id = p.id) as step_count,
      (SELECT COUNT(*) FROM steps s WHERE s.promise_id = p.id AND s.done = 1) as steps_done
    FROM promises p
    WHERE p.status != 'deleted'
    ORDER BY
      CASE p.status WHEN 'draft' THEN 2 ELSE 1 END,
      CASE WHEN p.deadline IS NULL THEN 1 ELSE 0 END,
      p.deadline ASC,
      p.created_at ASC
  `).all()
  return rows
})

ipcMain.handle('promises:add', (_, data) => {
  const r = db.prepare(`
    INSERT INTO promises
      (person_id, person_name, content, type, aspect, status, deadline, deadline_type, deadline_time,
       recurrence, recurrence_time, recurrence_days, done_criteria, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    data.person_id || null,
    data.person_name || '',
    data.content,
    data.type || 'single',
    data.aspect || 'personal',
    data.status || 'active',
    data.deadline || null,
    data.deadline_type || 'soft',
    data.deadline_time || null,
    data.recurrence || null,
    data.recurrence_time || null,
    data.recurrence_days || null,
    data.done_criteria || null,
    data.notes || null
  )
  return db.prepare('SELECT * FROM promises WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('promises:update', (_, id, data) => {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(data), id]
  db.prepare(`UPDATE promises SET ${fields}, updated_at = datetime('now','localtime') WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM promises WHERE id = ?').get(id)
})

ipcMain.handle('promises:delete', (_, id) => {
  db.prepare(`UPDATE promises SET status = 'deleted' WHERE id = ?`).run(id)
  return { ok: true }
})

// Steps
ipcMain.handle('steps:list', (_, promise_id) => {
  return db.prepare('SELECT * FROM steps WHERE promise_id = ? ORDER BY order_num, id').all(promise_id)
})
ipcMain.handle('steps:add', (_, promise_id, data) => {
  // Accept either a plain title string or an object with planning fields
  const d = (typeof data === 'string') ? { title: data } : (data || {})
  const maxOrder = db.prepare('SELECT MAX(order_num) as m FROM steps WHERE promise_id = ?').get(promise_id)
  const r = db.prepare(`
    INSERT INTO steps (promise_id, title, order_num, start_date, end_date, start_time, end_time)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    promise_id, d.title, (maxOrder.m || 0) + 1,
    d.start_date || null, d.end_date || null, d.start_time || null, d.end_time || null
  )
  // Adding a step turns a single promise into a multi-step ("plan") promise
  db.prepare(`UPDATE promises SET type = 'plan' WHERE id = ? AND type = 'single'`).run(promise_id)
  return db.prepare('SELECT * FROM steps WHERE id = ?').get(r.lastInsertRowid)
})
ipcMain.handle('steps:update', (_, id, data) => {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE steps SET ${fields} WHERE id = ?`).run(...Object.values(data), id)
  return db.prepare('SELECT * FROM steps WHERE id = ?').get(id)
})
ipcMain.handle('steps:toggle', (_, id) => {
  const s = db.prepare('SELECT * FROM steps WHERE id = ?').get(id)
  db.prepare('UPDATE steps SET done = ? WHERE id = ?').run(s.done ? 0 : 1, id)
  return db.prepare('SELECT * FROM steps WHERE id = ?').get(id)
})
ipcMain.handle('steps:delete', (_, id) => {
  db.prepare('DELETE FROM steps WHERE id = ?').run(id)
  return { ok: true }
})

// Todos
ipcMain.handle('todos:byDate', (_, date) => {
  return getTodosForDate(date)
})

// History: past days (before today) that had any todos, newest first
ipcMain.handle('todos:history', () => {
  const today = localDateStr(new Date())
  const days = []
  for (let i = 1; i <= 60; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = localDateStr(d)
    const todos = getTodosForDate(date)
    if (todos.length === 0) continue
    const done = todos.filter(t => t.done).length
    days.push({ date, total: todos.length, done, todos })
  }
  return days
})

// Tomorrow's plan: full list for tomorrow (one-off + recurring habits that fall on tomorrow)
ipcMain.handle('todos:tomorrow', () => {
  const t = new Date(); t.setDate(t.getDate() + 1)
  return getTodosForDate(localDateStr(t))
})

// Upcoming plans: one-off todos scheduled for days AFTER tomorrow (no recurring habits)
ipcMain.handle('todos:upcoming', () => {
  const t = new Date(); t.setDate(t.getDate() + 1)
  const tomorrow = localDateStr(t)
  return db.prepare(`
    SELECT t.*, p.content as promise_content, p.aspect as promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.scheduled_date > ? AND t.snoozed = 0 AND COALESCE(t.recurring,0) = 0
    ORDER BY t.scheduled_date ASC,
      CASE WHEN t.scheduled_time IS NULL THEN 1 ELSE 0 END,
      t.scheduled_time ASC, t.id ASC
  `).all(tomorrow)
})

// Habits: all recurring todo templates (shown as habits, sorted by time of day)
ipcMain.handle('todos:habits', () => {
  return db.prepare(`
    SELECT t.*, p.content as promise_content, p.aspect as promise_aspect
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE COALESCE(t.recurring,0) = 1
    ORDER BY
      CASE WHEN t.scheduled_time IS NOT NULL THEN 0 WHEN t.end_time IS NOT NULL THEN 1 ELSE 2 END,
      COALESCE(t.scheduled_time, t.end_time) ASC,
      t.id ASC
  `).all()
})

ipcMain.handle('todos:past', () => {
  const today = new Date().toISOString().split('T')[0]
  return db.prepare(`
    SELECT t.*, p.content as promise_content
    FROM todos t
    LEFT JOIN promises p ON t.promise_id = p.id
    WHERE t.scheduled_date < ? AND t.done = 0 AND t.snoozed = 0
    ORDER BY t.scheduled_date DESC, t.scheduled_time ASC
    LIMIT 20
  `).all(today)
})

ipcMain.handle('todos:add', (_, data) => {
  const recurring = data.recurring ? 1 : 0
  let stepId = data.step_id || null
  // Linking a todo to a promise registers it as a step of that promise.
  // If no existing step was chosen, create a new one mirroring this todo.
  if (data.promise_id && !stepId) {
    const maxOrder = db.prepare('SELECT MAX(order_num) as m FROM steps WHERE promise_id = ?').get(data.promise_id)
    const sr = db.prepare(`
      INSERT INTO steps (promise_id, title, order_num, start_date, end_date, start_time, end_time)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      data.promise_id, data.title, (maxOrder.m || 0) + 1,
      recurring ? null : (data.scheduled_date || null),
      recurring ? null : (data.scheduled_date || null),
      data.scheduled_time || null, data.end_time || null
    )
    stepId = sr.lastInsertRowid
    db.prepare(`UPDATE promises SET type = 'plan' WHERE id = ? AND type = 'single'`).run(data.promise_id)
  } else if (stepId) {
    // Attached to an existing step → keep that step's planned times in sync
    db.prepare('UPDATE steps SET start_time = ?, end_time = ? WHERE id = ?')
      .run(data.scheduled_time || null, data.end_time || null, stepId)
  }
  const r = db.prepare(`
    INSERT INTO todos (promise_id, step_id, title, scheduled_date, scheduled_time, end_time, recurring, recurrence_days, aspect)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    data.promise_id || null,
    stepId,
    data.title,
    recurring ? null : (data.scheduled_date || null),
    data.scheduled_time || null,
    data.end_time || null,
    recurring,
    recurring ? (data.recurrence_days || null) : null,
    data.aspect || null
  )
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('todos:toggle', (_, id, date) => {
  const t = db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
  // Recurring todos track completion per day
  if (t && t.recurring) {
    const exists = db.prepare('SELECT 1 FROM todo_completions WHERE todo_id = ? AND date = ?').get(id, date)
    if (exists) db.prepare('DELETE FROM todo_completions WHERE todo_id = ? AND date = ?').run(id, date)
    else db.prepare('INSERT OR IGNORE INTO todo_completions (todo_id, date) VALUES (?,?)').run(id, date)
    return { ok: true }
  }
  db.prepare('UPDATE todos SET done = ? WHERE id = ?').run(t.done ? 0 : 1, id)
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
})

ipcMain.handle('todos:snooze', (_, id, newDate) => {
  const t = db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
  db.prepare('UPDATE todos SET scheduled_date = ?, original_date = ?, snoozed = 0 WHERE id = ?')
    .run(newDate, t.original_date || t.scheduled_date, id)
  return { ok: true }
})

ipcMain.handle('todos:delete', (_, id, opts) => {
  const t = db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
  // For a recurring habit, "today only" just skips this one date
  if (t && t.recurring && opts && opts.scope === 'today' && opts.date) {
    db.prepare('INSERT OR IGNORE INTO todo_skips (todo_id, date) VALUES (?,?)').run(id, opts.date)
    return { ok: true }
  }
  // Otherwise remove the todo entirely (ends the habit). Cascades clean completions/skips.
  db.prepare('DELETE FROM todos WHERE id = ?').run(id)
  return { ok: true }
})

ipcMain.handle('todos:update', (_, id, data) => {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE todos SET ${fields} WHERE id = ?`).run(...Object.values(data), id)
  // Keep the linked step's planned times in sync with the todo
  if (data.step_id && ('scheduled_time' in data || 'end_time' in data)) {
    db.prepare('UPDATE steps SET start_time = ?, end_time = ? WHERE id = ?')
      .run(data.scheduled_time || null, data.end_time || null, data.step_id)
  }
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
})

// Integrity score
// Integrity = số lời hứa đã giữ / tổng số lời hứa đến hiện tại.
// "Lời hứa trong tương lai" (đang thực hiện & deadline còn ở phía trước) KHÔNG tính vào tổng.
ipcMain.handle('integrity:score', () => {
  const today = localDateStr(new Date())

  // A promise is "in the future" if it's still active and its deadline is after today.
  const futureCond = `status = 'active' AND deadline IS NOT NULL AND deadline > ?`

  // Total = all real promises (not draft/deleted) that have already come due / been resolved
  const total = db.prepare(`
    SELECT COUNT(*) as c FROM promises
    WHERE status NOT IN ('draft','deleted')
      AND NOT (${futureCond})
  `).get(today).c
  const kept = db.prepare(`SELECT COUNT(*) as c FROM promises WHERE status = 'done'`).get().c
  const broken = db.prepare(`SELECT COUNT(*) as c FROM promises WHERE status = 'broken'`).get().c
  const upcoming = db.prepare(`SELECT COUNT(*) as c FROM promises WHERE ${futureCond}`).get(today).c

  // Daily todo completion up to today (one-off tasks only)
  const todoTotal = db.prepare(`SELECT COUNT(*) as c FROM todos WHERE scheduled_date <= ? AND COALESCE(recurring,0) = 0`).get(today).c
  const todoDone = db.prepare(`SELECT COUNT(*) as c FROM todos WHERE scheduled_date <= ? AND done = 1 AND COALESCE(recurring,0) = 0`).get(today).c

  return { total, kept, broken, upcoming, todoTotal, todoDone }
})

// Integrity broken down per month.
// A promise belongs to a month by its deadline (or created_at if no deadline).
// Promises still active with a deadline in the future are counted as "upcoming", not in total.
ipcMain.handle('integrity:monthly', () => {
  const today = localDateStr(new Date())
  const curMonth = today.slice(0, 7)

  const map = {}
  const ensure = (m) => {
    if (!map[m]) map[m] = { month: m, total: 0, kept: 0, broken: 0, upcoming: 0, todoTotal: 0, todoDone: 0 }
    return map[m]
  }
  ensure(curMonth) // always show the current month

  const promiseRows = db.prepare(`
    SELECT substr(COALESCE(deadline, date(created_at)), 1, 7) as month, status, deadline
    FROM promises
    WHERE status NOT IN ('draft','deleted')
  `).all()
  for (const r of promiseRows) {
    const b = ensure(r.month)
    const isFuture = r.status === 'active' && r.deadline && r.deadline > today
    if (isFuture) { b.upcoming++; continue }
    b.total++
    if (r.status === 'done') b.kept++
    else if (r.status === 'broken') b.broken++
  }

  const todoRows = db.prepare(`
    SELECT substr(scheduled_date, 1, 7) as month, done
    FROM todos
    WHERE scheduled_date IS NOT NULL AND scheduled_date <= ? AND COALESCE(recurring,0) = 0
  `).all(today)
  for (const r of todoRows) {
    const b = ensure(r.month)
    b.todoTotal++
    if (r.done) b.todoDone++
  }

  return Object.values(map)
    .filter(x => x.month <= curMonth)
    .sort((a, b) => (a.month < b.month ? 1 : -1))
})

// ─── Streak ──────────────────────────────────────────────────
// A day "counts" (active) when it has >=1 completed todo.
// Streak breaks on 2 consecutive missed days, unless a day is rescued.
// Rescues are manual, max 2 per calendar month.

function completedDateSet() {
  const set = new Set()
  for (const r of db.prepare(`SELECT DISTINCT scheduled_date d FROM todos WHERE done = 1 AND scheduled_date IS NOT NULL AND COALESCE(recurring,0) = 0`).all()) set.add(r.d)
  for (const r of db.prepare(`SELECT DISTINCT date d FROM todo_completions`).all()) set.add(r.d)
  return set
}

ipcMain.handle('streak:stats', () => {
  const today = localDateStr(new Date())
  const completed = completedDateSet()
  const rescues = new Set(db.prepare(`SELECT date FROM streak_rescues`).all().map(r => r.date))

  // First day that ever had a today-list (scheduled todo or a recurring completion)
  const minTodo = db.prepare(`SELECT MIN(scheduled_date) m FROM todos WHERE scheduled_date IS NOT NULL`).get().m
  const minComp = db.prepare(`SELECT MIN(date) m FROM todo_completions`).get().m
  const firstDate = [minTodo, minComp].filter(Boolean).sort()[0] || today

  const end = new Date(today + 'T00:00:00')
  const start = new Date(firstDate + 'T00:00:00')

  let run = 0, miss = 0, record = 0, activeDays = 0, totalDays = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = localDateStr(d)
    totalDays++
    if (completed.has(ds)) {
      activeDays++; run++; miss = 0
      if (run > record) record = run
    } else if (rescues.has(ds)) {
      miss = 0 // rescued day bridges the gap but isn't an active day
    } else {
      miss++
      if (miss >= 2) { run = 0; miss = 0 } // streak broken
    }
  }
  const current = run
  const consistency = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0
  const curMonth = today.slice(0, 7)
  const rescuesThisMonth = db.prepare(`SELECT COUNT(*) c FROM streak_rescues WHERE substr(date,1,7) = ?`).get(curMonth).c
  const rescuesLeft = Math.max(0, 2 - rescuesThisMonth)

  // Recent missed (uncovered) days, last 14 days excluding today → candidates to rescue
  const recentMisses = []
  for (let i = 1; i <= 14; i++) {
    const d = new Date(end); d.setDate(d.getDate() - i)
    const ds = localDateStr(d)
    if (ds < firstDate) break
    if (!completed.has(ds) && !rescues.has(ds)) recentMisses.push(ds)
  }

  // 30-day completion-rate trend
  const trend = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i)
    const ds = localDateStr(d)
    const todos = getTodosForDate(ds)
    const total = todos.length
    const done = todos.filter(t => t.done).length
    trend.push({ date: ds, total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 })
  }

  // Current-month calendar
  const calendar = []
  const cy = end.getFullYear(), cm = end.getMonth()
  const daysInMonth = new Date(cy, cm + 1, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = localDateStr(new Date(cy, cm, day))
    const isFuture = ds > today
    let total = 0, done = 0
    if (!isFuture) { const ts = getTodosForDate(ds); total = ts.length; done = ts.filter(t => t.done).length }
    calendar.push({ date: ds, day, total, done, isFuture, completed: completed.has(ds), rescued: rescues.has(ds) })
  }

  // At-risk day: a streak was alive, yesterday was missed (uncovered) → prompt to rescue.
  // If the user declines and today also ends missed, the streak breaks naturally.
  let atRisk = null
  {
    const y = new Date(end); y.setDate(y.getDate() - 1); const yds = localDateStr(y)
    const b = new Date(end); b.setDate(b.getDate() - 2); const bds = localDateStr(b)
    if (yds >= firstDate && !completed.has(yds) && !rescues.has(yds) && rescuesLeft > 0
        && (completed.has(bds) || rescues.has(bds))) {
      atRisk = yds
    }
  }

  return { current, record, activeDays, totalDays, firstDate, consistency, rescuesLeft, recentMisses, atRisk, trend, calendar }
})

ipcMain.handle('streak:rescue', (_, date) => {
  const curMonth = localDateStr(new Date()).slice(0, 7)
  const used = db.prepare(`SELECT COUNT(*) c FROM streak_rescues WHERE substr(date,1,7) = ?`).get(curMonth).c
  if (used >= 2) return { error: 'Hết lượt cứu streak tháng này' }
  db.prepare(`INSERT OR IGNORE INTO streak_rescues (date) VALUES (?)`).run(date)
  return { ok: true }
})

// ─── Window ──────────────────────────────────────────────────

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FAF9F6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, 'web', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  initDB()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
