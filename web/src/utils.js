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

// Effective duration (minutes) of a todo: prefer the stored value, else derive
// from start/end. null when unknown.
export function todoDuration(todo) {
  if (todo && todo.duration_min != null && todo.duration_min > 0) return todo.duration_min
  return durationMin(todo?.scheduled_time, todo?.end_time)
}

// --- Time math for the start/end/duration triad ----------------------------

// "08:30" + 90 → "10:00" (clamped to a single day). '' if no base time.
export function addMinutes(timeStr, minutes) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  let total = h * 60 + m + Number(minutes)
  total = Math.max(0, Math.min(24 * 60 - 1, total))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// "10:00" - 90 → "08:30"
export function subMinutes(timeStr, minutes) {
  return addMinutes(timeStr, -Number(minutes))
}

// Signed end - start in minutes (can be ≤ 0). null if either side missing.
export function diffMinutesRaw(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

// Parse a duration the user typed. Default unit is MINUTES; add an "h" for hours.
//   "90"     → 90 phút
//   "1h"     → 60 phút      "2h" → 120
//   "1.5h"   → 90 phút      "1,5h" → 90
//   "1h30"   → 90 phút
// null when blank/invalid.
export function parseDuration(str) {
  if (str == null) return null
  const s = String(str).trim().toLowerCase().replace(',', '.')
  if (s === '') return null
  if (s.includes('h')) {
    const [hPart, mPart] = s.split('h')
    const h = hPart === '' ? 0 : parseFloat(hPart)
    const m = (mPart == null || mPart === '') ? 0 : parseFloat(mPart)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    const mins = Math.round(h * 60 + m)
    return mins > 0 ? mins : null
  }
  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  const mins = Math.round(n)
  return mins > 0 ? mins : null
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

// Daily mood (cảm xúc) options for the "Hôm nay" review. id 1..5.
export const MOODS = [
  { id: 1, icon: '😞', label: 'Tệ' },
  { id: 2, icon: '😕', label: 'Không vui' },
  { id: 3, icon: '😐', label: 'Bình thường' },
  { id: 4, icon: '🙂', label: 'Vui' },
  { id: 5, icon: '😄', label: 'Tuyệt vời' },
]
export function moodIcon(id) {
  return MOODS.find(m => m.id === Number(id))?.icon || ''
}
export function moodLabel(id) {
  return MOODS.find(m => m.id === Number(id))?.label || ''
}

export function daysLeft(deadlineStr) {
  if (!deadlineStr) return null
  const today = new Date()
  today.setHours(0,0,0,0)
  const d = new Date(deadlineStr + 'T00:00:00')
  return Math.round((d - today) / (1000 * 60 * 60 * 24))
}
