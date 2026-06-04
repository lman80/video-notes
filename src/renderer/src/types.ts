export type Tool = 'pen' | 'rect' | 'arrow' | 'ellipse'

/** A point expressed in normalized frame coordinates (0..1), so annotations
 *  scale correctly regardless of player size or video resolution. */
export interface NPoint {
  x: number
  y: number
}

export interface Shape {
  id: string
  tool: Tool
  color: string
  /** Stroke width as a fraction of the frame width (so it scales). */
  size: number
  /** pen: many points · rect/ellipse: [topLeftish, bottomRightish] · arrow: [start, end] */
  points: NPoint[]
}

/** 'frame' = a drawn-on visual note · 'audio' = a comment on a time range of audio. */
export type NoteKind = 'frame' | 'audio'

export interface Note {
  id: string
  videoId: string
  /** Timestamp in seconds (for audio notes, the start of the range). */
  time: number
  text: string
  /** Accent color shown in the list / on the timeline. */
  color: string
  shapes: Shape[]
  /** Defaults to 'frame'. */
  kind?: NoteKind
  /** End of the range, for audio notes. */
  rangeEnd?: number
  /** Name of the person who wrote the note (for attribution / sharing). */
  author?: string
  /** Small JPEG data URL of the annotated frame, for the notes list. */
  thumb?: string
  createdAt: number
  updatedAt: number
}

export interface VideoEntry {
  id: string
  path: string
  name: string
  addedAt: number
  lastOpenedAt?: number
  duration?: number
  /** Resume position. */
  lastTime?: number
  /** Set when the file can no longer be found on disk. */
  missing?: boolean
  /** Poster frame (small JPEG data URL) shown on the library card. */
  poster?: string
  /** Cached, normalized audio peaks (0..1) for the waveform strip. */
  waveform?: number[]
}

export interface DB {
  videos: VideoEntry[]
  notes: Note[]
}
