/** Stable id derived from a file's absolute path (FNV-1a → base36).
 *  Re-adding the same file yields the same id, which makes dedupe trivial. */
export function hashPath(p: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < p.length; i++) {
    h ^= p.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return 'v_' + (h >>> 0).toString(36)
}

/** Random unique id for notes / shapes. */
export function uid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return `${prefix}_${rand}`
}
