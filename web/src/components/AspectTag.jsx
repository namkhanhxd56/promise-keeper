import { aspectLabel } from '../utils'

// Colored tag for a todo's "khía cạnh" (life aspect).
const ASPECT_STYLE = {
  work:     { c: 'var(--blue)',   bg: 'var(--blue-light)' },
  family:   { c: 'var(--amber)',  bg: 'var(--amber-light)' },
  personal: { c: 'var(--accent)', bg: 'var(--accent-light)' },
  friend:   { c: 'var(--purple)', bg: 'var(--purple-light)' },
}

export default function AspectTag({ aspect }) {
  const label = aspectLabel(aspect)
  if (!label) return null
  const s = ASPECT_STYLE[aspect] || { c: 'var(--text3)', bg: 'var(--bg3)' }
  return (
    <span style={{ fontSize: 11, color: s.c, background: s.bg, padding: '1px 6px', borderRadius: 4 }}>
      {label}
    </span>
  )
}
