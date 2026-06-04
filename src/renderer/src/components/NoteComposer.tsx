import { useEffect, useRef } from 'react'
import type { NoteKind, Tool } from '../types'
import { formatClock } from '../lib/format'
import { initials, colorForName } from '../lib/author'
import { PenIcon, RectIcon, ArrowIcon, EllipseIcon, UndoIcon, TrashIcon, AudioIcon } from './Icons'

export const PALETTE = ['#ff4d4f', '#ffd23f', '#46d160', '#3da5ff', '#b06bff', '#ffffff']
export const SIZES: { key: string; label: string; value: number }[] = [
  { key: 's', label: 'S', value: 0.004 },
  { key: 'm', label: 'M', value: 0.0072 },
  { key: 'l', label: 'L', value: 0.012 }
]

interface Props {
  kind: NoteKind
  time: number
  rangeEnd?: number
  tool: Tool
  color: string
  size: number
  text: string
  shapeCount: number
  editing: boolean
  author: string
  onSetTool: (t: Tool) => void
  onSetColor: (c: string) => void
  onSetSize: (n: number) => void
  onSetText: (s: string) => void
  onUndo: () => void
  onClear: () => void
  onSave: () => void
  onCancel: () => void
  onEditAuthor: () => void
}

const TOOLS: { key: Tool; Icon: typeof PenIcon; title: string }[] = [
  { key: 'pen', Icon: PenIcon, title: 'Pen (freehand)' },
  { key: 'rect', Icon: RectIcon, title: 'Rectangle' },
  { key: 'arrow', Icon: ArrowIcon, title: 'Arrow' },
  { key: 'ellipse', Icon: EllipseIcon, title: 'Ellipse' }
]

export function NoteComposer(props: Props): JSX.Element {
  const {
    kind,
    time,
    rangeEnd,
    tool,
    color,
    size,
    text,
    shapeCount,
    editing,
    author,
    onSetTool,
    onSetColor,
    onSetSize,
    onSetText,
    onUndo,
    onClear,
    onSave,
    onCancel,
    onEditAuthor
  } = props

  const textRef = useRef<HTMLTextAreaElement>(null)
  const isAudio = kind === 'audio'

  useEffect(() => {
    const el = textRef.current
    if (el) {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className={`composer ${isAudio ? 'is-audio' : ''}`}>
      <div className="composer-toolbar">
        <div className={`composer-tc ${isAudio ? 'is-audio' : ''}`}>
          {isAudio ? (
            <>
              <AudioIcon size={14} />
              {formatClock(time)}
              {typeof rangeEnd === 'number' && <span>–{formatClock(rangeEnd)}</span>}
            </>
          ) : (
            <>
              <span className="rec-dot" />
              {formatClock(time)}
            </>
          )}
        </div>

        {!isAudio && (
          <>
            <div className="tool-group">
              {TOOLS.map(({ key, Icon, title }) => (
                <button
                  key={key}
                  className={`tool-btn ${tool === key ? 'is-active' : ''}`}
                  title={title}
                  onClick={() => onSetTool(key)}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <div className="size-group">
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  className={`size-btn ${Math.abs(size - s.value) < 0.0001 ? 'is-active' : ''}`}
                  title={`Stroke ${s.label}`}
                  onClick={() => onSetSize(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="swatches">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? 'is-active' : ''}`}
              style={{ background: c }}
              title={c}
              onClick={() => onSetColor(c)}
            />
          ))}
        </div>

        {!isAudio && (
          <div className="tool-group">
            <button className="tool-btn" title="Undo last shape" onClick={onUndo} disabled={shapeCount === 0}>
              <UndoIcon size={16} />
            </button>
            <button className="tool-btn" title="Clear all shapes" onClick={onClear} disabled={shapeCount === 0}>
              <TrashIcon size={16} />
            </button>
          </div>
        )}
      </div>

      <textarea
        ref={textRef}
        className="composer-text"
        placeholder={
          isAudio
            ? 'Comment on the audio in this range…  (⌘/Ctrl+Enter to save, Esc to cancel)'
            : 'Write a note for this moment…  (⌘/Ctrl+Enter to save, Esc to cancel)'
        }
        value={text}
        onChange={(e) => onSetText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
      />

      <div className="composer-actions">
        <button className="author-chip" onClick={onEditAuthor} title="Set your name">
          {author ? (
            <>
              <span className="author-avatar" style={{ background: colorForName(author) }}>
                {initials(author)}
              </span>
              <span className="author-name">{author}</span>
            </>
          ) : (
            <span className="author-name muted">Set your name</span>
          )}
        </button>
        <span className="composer-hint">
          {isAudio
            ? 'Audio note'
            : shapeCount > 0
              ? `${shapeCount} shape${shapeCount === 1 ? '' : 's'} · drag on the video to draw`
              : 'Drag on the video to highlight something'}
        </span>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={onSave}>
          {editing ? 'Update note' : 'Save note'}
        </button>
      </div>
    </div>
  )
}
