// Wrap an async route handler so rejected promises reach Express' error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Build a parameterised "SET col = $n" clause from a body, restricted to a whitelist.
// Returns { clause, values } or null when no allowed fields were provided.
function buildUpdate(data, allowed, startIndex = 1) {
  const keys = Object.keys(data || {}).filter((k) => allowed.includes(k))
  if (keys.length === 0) return null
  const clause = keys.map((k, i) => `${k} = $${startIndex + i}`).join(', ')
  const values = keys.map((k) => data[k])
  return { clause, values, nextIndex: startIndex + keys.length }
}

module.exports = { wrap, buildUpdate }
