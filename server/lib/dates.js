// Map JS getDay() (0=Sun) → day id used by the UI
const WEEKDAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function weekdayId(dateStr) {
  return WEEKDAY_IDS[new Date(dateStr + 'T00:00:00').getDay()]
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function today() {
  return localDateStr(new Date())
}

module.exports = { WEEKDAY_IDS, weekdayId, localDateStr, today }
