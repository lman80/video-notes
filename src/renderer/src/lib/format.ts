const pad = (n: number, len = 2): string => String(Math.floor(n)).padStart(len, '0')

/** H:MM:SS (drops the hour when under an hour) — for the main time readout. */
export function formatClock(t: number): string {
  if (!isFinite(t) || t < 0) t = 0
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** MM:SS.cs — compact, precise label used on note chips. */
export function formatPrecise(t: number): string {
  if (!isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t % 1) * 100)
  return `${pad(m)}:${pad(s)}.${pad(cs)}`
}

/** Full timecode HH:MM:SS for exports. */
export function formatFull(t: number): string {
  if (!isFinite(t) || t < 0) t = 0
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** Filesize-free, human note count helper. */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
