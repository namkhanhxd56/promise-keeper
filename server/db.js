const { Pool } = require('pg')

// Keep "today" anchored to the user's timezone (not the server's UTC).
// Used by both Node (process.env.TZ) and Postgres (session timezone via options).
const APP_TZ = process.env.APP_TZ || 'Asia/Ho_Chi_Minh'
process.env.TZ = APP_TZ

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — set it to your PostgreSQL connection string')
}

// Railway/managed Postgres generally needs SSL when connecting over the public URL.
// Disable with PGSSL=disable (e.g. local docker postgres).
const ssl = process.env.PGSSL === 'disable'
  ? false
  : { rejectUnauthorized: false }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  // Anchor every session's clock to the app timezone so now()/to_char align with Node.
  options: `-c timezone=${APP_TZ}`,
  // Keep connections warm + reused so each request doesn't pay a fresh
  // TCP/TLS handshake (costly when the DB is across the network).
  keepAlive: true,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => console.error('[db] unexpected pool error', err))

async function q(text, params) {
  const r = await pool.query(text, params)
  return r.rows
}
async function q1(text, params) {
  const r = await pool.query(text, params)
  return r.rows[0] || null
}

// Create schema + run idempotent migrations. Safe to run on every boot.
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS people (
      id SERIAL PRIMARY KEY,
      user_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      relation TEXT DEFAULT 'other',
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS promises (
      id SERIAL PRIMARY KEY,
      user_id INTEGER DEFAULT 1,
      person_id INTEGER REFERENCES people(id),
      person_name TEXT,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'single',
      aspect TEXT DEFAULT 'personal',
      status TEXT DEFAULT 'active',
      deadline TEXT,
      deadline_type TEXT DEFAULT 'soft',
      deadline_time TEXT,
      recurrence TEXT,
      recurrence_time TEXT,
      recurrence_days TEXT,
      done_criteria TEXT,
      notes TEXT,
      integrity_note TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'),
      updated_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS steps (
      id SERIAL PRIMARY KEY,
      promise_id INTEGER NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_num INTEGER DEFAULT 0,
      done INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER DEFAULT 1,
      promise_id INTEGER REFERENCES promises(id) ON DELETE SET NULL,
      step_id INTEGER REFERENCES steps(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      scheduled_date TEXT,
      scheduled_time TEXT,
      end_time TEXT,
      done INTEGER DEFAULT 0,
      snoozed INTEGER DEFAULT 0,
      original_date TEXT,
      recurring INTEGER DEFAULT 0,
      recurrence_days TEXT,
      aspect TEXT,
      duration_min INTEGER,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );

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

    CREATE TABLE IF NOT EXISTS streak_rescues (
      date TEXT PRIMARY KEY
    );
  `)

  // Forward migrations (no-ops once columns exist). Kept for already-deployed DBs.
  const migrations = [
    `ALTER TABLE people   ADD COLUMN IF NOT EXISTS user_id INTEGER DEFAULT 1`,
    `ALTER TABLE promises ADD COLUMN IF NOT EXISTS user_id INTEGER DEFAULT 1`,
    `ALTER TABLE promises ADD COLUMN IF NOT EXISTS deadline_time TEXT`,
    `ALTER TABLE promises ADD COLUMN IF NOT EXISTS integrity_note TEXT`,
    `ALTER TABLE steps    ADD COLUMN IF NOT EXISTS start_date TEXT`,
    `ALTER TABLE steps    ADD COLUMN IF NOT EXISTS end_date TEXT`,
    `ALTER TABLE steps    ADD COLUMN IF NOT EXISTS start_time TEXT`,
    `ALTER TABLE steps    ADD COLUMN IF NOT EXISTS end_time TEXT`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS user_id INTEGER DEFAULT 1`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS snoozed INTEGER DEFAULT 0`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS original_date TEXT`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS recurring INTEGER DEFAULT 0`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS recurrence_days TEXT`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS end_time TEXT`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS aspect TEXT`,
    `ALTER TABLE todos    ADD COLUMN IF NOT EXISTS duration_min INTEGER`,
  ]
  for (const m of migrations) {
    try { await pool.query(m) } catch (e) { console.warn('[db] migration skipped:', e.message) }
  }

  // Seed the default "self" person (id = 1) and align the id sequence.
  await pool.query(`
    INSERT INTO people (id, name, relation, user_id)
    VALUES (1, 'Tôi (bản thân)', 'self', 1)
    ON CONFLICT (id) DO NOTHING
  `)
  await pool.query(`
    SELECT setval(pg_get_serial_sequence('people','id'),
      GREATEST((SELECT COALESCE(MAX(id),1) FROM people), 1))
  `)

  console.log('[db] schema ready')
}

module.exports = { pool, q, q1, initDB, APP_TZ }
