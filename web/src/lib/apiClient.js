// HTTP client that mirrors the Electron `window.api` shape, backed by the
// Express + PostgreSQL API. In the desktop (Electron) build, window.api is
// already provided by preload.js over IPC, so this is only used on the web.

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

// Auth lives in httpOnly cookies (never localStorage), so every request must
// send credentials and the API must allow them via CORS.
function rawFetch(method, path, body) {
  return fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

// Endpoints that must NOT trigger the refresh-and-retry dance (to avoid loops).
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout']

// Coalesce concurrent refreshes into a single in-flight request.
let refreshing = null
function tryRefresh() {
  if (!refreshing) {
    refreshing = rawFetch('POST', '/auth/refresh').then(r => r.ok).catch(() => false)
    refreshing.finally(() => { refreshing = null })
  }
  return refreshing
}

async function parse(res) {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const e = await res.json(); if (e?.error) msg = e.error } catch { /* ignore */ }
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function http(method, path, body, _retried) {
  const res = await rawFetch(method, path, body)
  // On an expired access token, transparently refresh once and retry.
  if (res.status === 401 && !_retried && !NO_REFRESH.includes(path)) {
    const ok = await tryRefresh()
    if (ok) return http(method, path, body, true)
    // Refresh failed → session is gone; let the app drop back to login.
    window.dispatchEvent(new CustomEvent('auth:logout'))
  }
  return parse(res)
}

const get = (p) => http('GET', p)
const qs = (obj) => {
  const parts = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export function createHttpApi() {
  return {
    auth: {
      register: (email, password) => http('POST', '/auth/register', { email, password }),
      login: (email, password) => http('POST', '/auth/login', { email, password }),
      logout: () => http('POST', '/auth/logout', {}),
      me: () => http('GET', '/auth/me'),
      refresh: () => http('POST', '/auth/refresh', {}),
    },
    people: {
      list: () => get('/people'),
      add: (name, relation) => http('POST', '/people', { name, relation }),
      delete: (id) => http('DELETE', `/people/${id}`),
    },
    promises: {
      list: () => get('/promises'),
      add: (data) => http('POST', '/promises', data),
      update: (id, data) => http('PUT', `/promises/${id}`, data),
      delete: (id) => http('DELETE', `/promises/${id}`),
    },
    steps: {
      list: (promise_id) => get(`/promises/${promise_id}/steps`),
      add: (promise_id, data) => http('POST', `/promises/${promise_id}/steps`, typeof data === 'string' ? { title: data } : data),
      update: (id, data) => http('PUT', `/steps/${id}`, data),
      toggle: (id) => http('POST', `/steps/${id}/toggle`, {}),
      delete: (id) => http('DELETE', `/steps/${id}`),
    },
    todos: {
      byDate: (date) => get(`/todos${qs({ date })}`),
      history: () => get('/todos/history'),
      upcoming: () => get('/todos/upcoming'),
      tomorrow: () => get('/todos/tomorrow'),
      habits: () => get('/todos/habits'),
      past: () => get('/todos/past'),
      add: (data) => http('POST', '/todos', data),
      toggle: (id, date) => http('POST', `/todos/${id}/toggle`, { date }),
      snooze: (id, newDate) => http('POST', `/todos/${id}/snooze`, { newDate }),
      delete: (id, opts) => http('DELETE', `/todos/${id}${qs({ scope: opts?.scope, date: opts?.date })}`),
      update: (id, data) => http('PUT', `/todos/${id}`, data),
    },
    integrity: {
      score: () => get('/integrity/score'),
      monthly: () => get('/integrity/monthly'),
    },
    streak: {
      stats: () => get('/streak/stats'),
      rescue: (date) => http('POST', '/streak/rescue', { date }),
    },
    reviews: {
      get: (date) => get(`/reviews/${date}`),
      save: (date, data) => http('PUT', `/reviews/${date}`, data),
    },
  }
}
