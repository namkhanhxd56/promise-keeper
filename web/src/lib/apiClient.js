// HTTP client that mirrors the Electron `window.api` shape, backed by the
// Express + PostgreSQL API. In the desktop (Electron) build, window.api is
// already provided by preload.js over IPC, so this is only used on the web.

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

// Token transport. Cross-site cookies are blocked by mobile browsers (Safari
// iOS, Chrome), so we ALSO carry the JWTs ourselves and send the access token
// via the Authorization header. Cookies still work on desktop/same-site.
const ACCESS_KEY = 'pk_access_token'
const REFRESH_KEY = 'pk_refresh_token'
const tokens = {
  get access() { try { return localStorage.getItem(ACCESS_KEY) } catch { return null } },
  get refresh() { try { return localStorage.getItem(REFRESH_KEY) } catch { return null } },
  set(access, refresh) {
    try {
      if (access) localStorage.setItem(ACCESS_KEY, access)
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
    } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY) } catch { /* ignore */ }
  },
}

function rawFetch(method, path, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const at = tokens.access
  if (at) headers['Authorization'] = `Bearer ${at}`
  return fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length ? headers : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

// Endpoints that must NOT trigger the refresh-and-retry dance (to avoid loops).
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout']

// Coalesce concurrent refreshes into a single in-flight request.
let refreshing = null
function tryRefresh() {
  if (!refreshing) {
    const rt = tokens.refresh
    refreshing = rawFetch('POST', '/auth/refresh', rt ? { refreshToken: rt } : {})
      .then(async (r) => {
        if (!r.ok) return false
        const data = await r.json().catch(() => null)
        if (data?.accessToken) tokens.set(data.accessToken, data.refreshToken)
        return true
      })
      .catch(() => false)
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
    tokens.clear()
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
      register: async (email, password) => {
        const r = await http('POST', '/auth/register', { email, password })
        if (r?.accessToken) tokens.set(r.accessToken, r.refreshToken)
        return r
      },
      login: async (email, password) => {
        const r = await http('POST', '/auth/login', { email, password })
        if (r?.accessToken) tokens.set(r.accessToken, r.refreshToken)
        return r
      },
      logout: async () => {
        try { await http('POST', '/auth/logout', {}) } finally { tokens.clear() }
        return { ok: true }
      },
      me: () => http('GET', '/auth/me'),
      refresh: async () => {
        const rt = tokens.refresh
        const r = await http('POST', '/auth/refresh', rt ? { refreshToken: rt } : {})
        if (r?.accessToken) tokens.set(r.accessToken, r.refreshToken)
        return r
      },
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
