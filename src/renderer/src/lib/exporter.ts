import type { Note, VideoEntry } from '../types'
import { formatFull } from './format'
import { describeShapes, embedInto } from './share'

const byTime = (a: Note, b: Note): number => a.time - b.time

/** Timecode label — a range for audio notes, a single stamp otherwise. */
function stamp(n: Note): string {
  if (n.kind === 'audio' && typeof n.rangeEnd === 'number') {
    return `${formatFull(n.time)}–${formatFull(n.rangeEnd)}`
  }
  return formatFull(n.time)
}

function authorSuffix(n: Note, sep: string): string {
  return n.author ? `${sep}${n.author}` : ''
}

/** Markdown export — nice for pasting into a doc or handing to an editor. */
export function notesToMarkdown(video: VideoEntry, notes: Note[]): string {
  const lines: string[] = []
  lines.push(`# Notes — ${video.name}`)
  lines.push('')
  lines.push(`_${notes.length} note${notes.length === 1 ? '' : 's'}_`)
  lines.push('')
  for (const n of [...notes].sort(byTime)) {
    const text = n.text.trim() || '_(annotation only)_'
    const tag = n.kind === 'audio' ? '🔊 ' : ''
    const detail = n.kind === 'audio' ? '' : describeShapes(n.shapes)
    const meta = [detail ? `_(${detail})_` : '', authorSuffix(n, '— ')].filter(Boolean).join(' ')
    lines.push(`- ${tag}**[${stamp(n)}]** ${text.replace(/\n/g, '\n  ')}${meta ? `  ${meta}` : ''}`)
  }
  lines.push('')
  return embedInto(lines.join('\n'), video, notes)
}

/** Plain text export. */
export function notesToText(video: VideoEntry, notes: Note[]): string {
  const lines: string[] = [`Notes — ${video.name}`, '']
  for (const n of [...notes].sort(byTime)) {
    const text = n.text.trim() || '(annotation only)'
    const tag = n.kind === 'audio' ? '(audio) ' : ''
    const detail = n.kind === 'audio' ? '' : describeShapes(n.shapes)
    const suffix = [detail ? `(${detail})` : '', authorSuffix(n, '— ')].filter(Boolean).join(' ')
    lines.push(`[${stamp(n)}]  ${tag}${text.replace(/\n/g, ' ')}${suffix ? `  ${suffix}` : ''}`)
  }
  return embedInto(lines.join('\n') + '\n', video, notes)
}

/** CSV export. */
export function notesToCsv(_video: VideoEntry, notes: Note[]): string {
  const esc = (s: string): string => `"${s.replace(/"/g, '""')}"`
  const rows = [['Timecode', 'Seconds', 'End', 'Type', 'Author', 'Note', 'Annotations'].join(',')]
  for (const n of [...notes].sort(byTime)) {
    rows.push(
      [
        esc(stamp(n)),
        n.time.toFixed(3),
        n.kind === 'audio' && typeof n.rangeEnd === 'number' ? n.rangeEnd.toFixed(3) : '',
        n.kind === 'audio' ? 'audio' : 'frame',
        esc(n.author || ''),
        esc(n.text.trim()),
        esc(n.kind === 'audio' ? '' : describeShapes(n.shapes))
      ].join(',')
    )
  }
  return rows.join('\n') + '\n'
}

/** Build a clipboard block of all notes — readable, with embedded data so it
 *  can be pasted straight into another copy of the app via Import. */
export function notesToClipboard(video: VideoEntry, notes: Note[]): string {
  const readable = [...notes]
    .sort(byTime)
    .map((n) => {
      const tag = n.kind === 'audio' ? '(audio) ' : ''
      return `[${stamp(n)}] ${tag}${n.text.trim()}${authorSuffix(n, ' — ')}`.trim()
    })
    .join('\n')
  return embedInto(readable, video, notes)
}
