export function toDateStr(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

export function fmt(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

// Minutes between two "HH:MM" strings (end - start). null if invalid/non-positive.
export function durationMin(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  return mins > 0 ? mins : null
}

// Pretty minutes: "1h30", "45 phút", "2h"
export function fmtMins(mins) {
  if (mins == null || mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} phút`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

// Pretty duration between two "HH:MM" strings
export function fmtDuration(start, end) {
  return fmtMins(durationMin(start, end))
}

// A day is a "Ngày Chiến Thắng" (Victory Day) when ≥90% of its tasks are done.
export const VICTORY_PCT = 90
export function isVictory(done, total) {
  return total > 0 && (done / total) * 100 >= VICTORY_PCT
}

// Shared "Khía cạnh" (life aspect) options used by promise & todo forms.
export const ASPECTS = [
  { id: 'work', label: 'Công việc' },
  { id: 'family', label: 'Gia đình' },
  { id: 'personal', label: 'Cá nhân' },
  { id: 'friend', label: 'Bạn bè' },
]
export function aspectLabel(id) {
  return ASPECTS.find(a => a.id === id)?.label || ''
}

export function daysLeft(deadlineStr) {
  if (!deadlineStr) return null
  const today = new Date()
  today.setHours(0,0,0,0)
  const d = new Date(deadlineStr + 'T00:00:00')
  return Math.round((d - today) / (1000 * 60 * 60 * 24))
}
