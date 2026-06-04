import type { Note, NoteKind, Shape, Tool, VideoEntry } from '../types'

/** A self-contained, importable notes file. Includes the full annotation
 *  geometry (shapes, colors, sizes) and frame thumbnails so the recipient sees
 *  everything exactly as the author did — they just supply their own copy of
 *  the video. */
export interface NotesPackage {
  format: 'video-notes'
  version: number
  exportedAt: number
  video: { name: string; duration?: number }
  notes: Note[]
}

const TOOLS: Tool[] = ['pen', 'rect', 'arrow', 'ellipse']

function packageObject(video: VideoEntry, notes: Note[], includeThumbs: boolean): NotesPackage {
  return {
    format: 'video-notes',
    version: 1,
    exportedAt: Date.now(),
    video: { name: video.name, duration: video.duration },
    notes: [...notes]
      .sort((a, b) => a.time - b.time)
      .map((n) => (includeThumbs ? n : { ...n, thumb: undefined }))
  }
}

const DATA_MARK = '<!-- video-notes-data:1'

/** Append a hidden, machine-readable data block to a human-readable export, so
 *  one text/markdown file is BOTH readable and fully importable (drawings,
 *  ranges, authors). Thumbnails are omitted to keep the text small — they're
 *  regenerated from the video on the receiving side. */
export function embedInto(readable: string, video: VideoEntry, notes: Note[]): string {
  const json = JSON.stringify(packageObject(video, notes, false))
  return `${readable}\n${DATA_MARK} full note data — used for import; safe to ignore\n${json}\n-->\n`
}

/** Pull the embedded JSON back out of an exported text/markdown file. The JSON
 *  is always a single line (compact stringify escapes any newlines), so we read
 *  exactly the line after the marker — robust even if a note's text contains
 *  the "-->" that closes the comment. */
export function extractEmbedded(text: string): string | null {
  const i = text.indexOf(DATA_MARK)
  if (i < 0) return null
  const lineEnd = text.indexOf('\n', i)
  if (lineEnd < 0) return null
  const next = text.indexOf('\n', lineEnd + 1)
  const json = text.slice(lineEnd + 1, next < 0 ? undefined : next).trim()
  return json.startsWith('{') ? json : null
}

function sanitizeShape(raw: unknown): Shape | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const tool = TOOLS.includes(s.tool as Tool) ? (s.tool as Tool) : 'rect'
  const points = Array.isArray(s.points)
    ? s.points
        .map((p) => {
          const pt = p as Record<string, unknown>
          return { x: Number(pt?.x) || 0, y: Number(pt?.y) || 0 }
        })
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    : []
  if (points.length === 0) return null
  return {
    id: typeof s.id === 'string' ? s.id : `s_${Math.random().toString(36).slice(2)}`,
    tool,
    color: typeof s.color === 'string' ? s.color : '#ff4d4f',
    size: typeof s.size === 'number' && s.size > 0 ? s.size : 0.0072,
    points
  }
}

function sanitizeNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>
  if (typeof n.time !== 'number' || !Number.isFinite(n.time)) return null
  const shapes = Array.isArray(n.shapes)
    ? (n.shapes.map(sanitizeShape).filter(Boolean) as Shape[])
    : []
  const now = Date.now()
  const kind: NoteKind = n.kind === 'audio' ? 'audio' : 'frame'
  return {
    id: typeof n.id === 'string' ? n.id : `n_${Math.random().toString(36).slice(2)}`,
    videoId: '', // remapped to the target video on import
    time: n.time,
    text: typeof n.text === 'string' ? n.text : '',
    color: typeof n.color === 'string' ? n.color : '#ff4d4f',
    shapes,
    kind,
    rangeEnd:
      kind === 'audio' && typeof n.rangeEnd === 'number' && Number.isFinite(n.rangeEnd)
        ? n.rangeEnd
        : undefined,
    author: typeof n.author === 'string' ? n.author : undefined,
    thumb: typeof n.thumb === 'string' ? n.thumb : undefined,
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : now,
    updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : now
  }
}

/** Parse a notes file. Tolerant of a bare notes array or a full package. */
export function parseNotesPackage(
  text: string
): { video?: { name: string; duration?: number }; notes: Note[] } | null {
  // Markdown/text exports carry the data in a hidden block; otherwise the text
  // is itself the JSON (.vidnotes / .json).
  const source = extractEmbedded(text) ?? text
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    return null
  }
  let rawNotes: unknown[] = []
  let video: { name: string; duration?: number } | undefined
  if (Array.isArray(data)) {
    rawNotes = data
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.notes)) rawNotes = d.notes
    if (d.video && typeof d.video === 'object') {
      const vobj = d.video as Record<string, unknown>
      if (typeof vobj.name === 'string') {
        video = { name: vobj.name, duration: typeof vobj.duration === 'number' ? vobj.duration : undefined }
      }
    }
  } else {
    return null
  }
  const notes = rawNotes.map(sanitizeNote).filter(Boolean) as Note[]
  return { video, notes }
}

const TOOL_LABEL: Record<Tool, string> = {
  pen: 'pen',
  rect: 'box',
  arrow: 'arrow',
  ellipse: 'ellipse'
}

/** Human-readable summary of a note's drawings, e.g. "1 box, 1 arrow". */
export function describeShapes(shapes: Shape[]): string {
  if (!shapes || shapes.length === 0) return ''
  const counts = new Map<Tool, number>()
  for (const s of shapes) counts.set(s.tool, (counts.get(s.tool) || 0) + 1)
  const parts: string[] = []
  for (const [tool, n] of counts) {
    const label = TOOL_LABEL[tool]
    const plural = n === 1 ? label : /[sxz]$/.test(label) ? `${label}es` : `${label}s`
    parts.push(`${n} ${plural}`)
  }
  return parts.join(', ')
}
