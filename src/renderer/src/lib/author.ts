/** Up to two initials from a name, e.g. "Ashton Miller" → "AM". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Stable, pleasant color derived from a name (so each person reads distinctly). */
export function colorForName(name: string): string {
  let h = 0
  const s = name.trim().toLowerCase()
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 62% 58%)`
}
