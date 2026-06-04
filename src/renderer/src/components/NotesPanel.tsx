import { useState } from 'react'
import type { Note } from '../types'
import { formatClock, formatPrecise, plural } from '../lib/format'
import { initials, colorForName } from '../lib/author'
import { EditIcon, TrashIcon, ExportIcon, ChevronRightIcon, AudioIcon } from './Icons'

export type ExportFormat = 'copy' | 'md' | 'txt' | 'csv'

interface Props {
  notes: Note[]
  selectedNoteId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onExport: (format: ExportFormat) => void
  onImport: () => void
  onImportClipboard: () => void
  onCollapse: () => void
}

export function NotesPanel({
  notes,
  selectedNoteId,
  onSelect,
  onEdit,
  onDelete,
  onExport,
  onImport,
  onImportClipboard,
  onCollapse
}: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const hasNotes = notes.length > 0

  const fire = (fmt: ExportFormat): void => {
    setMenuOpen(false)
    onExport(fmt)
  }
  const run = (fn: () => void): void => {
    setMenuOpen(false)
    fn()
  }

  return (
    <aside className="notes-panel">
      <div className="notes-header">
        <h2>
          Notes <span className="notes-count">{notes.length}</span>
        </h2>
        <div className="notes-header-actions">
          <div className="export-wrap">
            <button
              className="ctl-btn"
              onClick={() => setMenuOpen((o) => !o)}
              title="Share, export & import notes"
            >
              <ExportIcon size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="export-menu">
                  <div className="menu-label">Share — readable text, all data built in</div>
                  <button disabled={!hasNotes} onClick={() => fire('copy')}>
                    Copy all to clipboard
                  </button>
                  <button disabled={!hasNotes} onClick={() => fire('md')}>
                    Export as Markdown…
                  </button>
                  <button disabled={!hasNotes} onClick={() => fire('txt')}>
                    Export as Text…
                  </button>
                  <div className="menu-divider" />
                  <div className="menu-label">Import</div>
                  <button onClick={() => run(onImportClipboard)}>Paste from clipboard</button>
                  <button onClick={() => run(onImport)}>Import from file…</button>
                  <div className="menu-divider" />
                  <button disabled={!hasNotes} onClick={() => fire('csv')}>
                    Export as CSV (spreadsheet)
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="ctl-btn" onClick={onCollapse} title="Collapse notes panel">
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>

      {!hasNotes ? (
        <div className="notes-empty">
          <p>No notes yet.</p>
          <p className="hint">
            Pause the video and drag on the frame to highlight something, or press{' '}
            <kbd>N</kbd> to add a note at the current time.
          </p>
          <div className="notes-empty-actions">
            <button className="btn" onClick={onImport}>
              Import from file…
            </button>
            <button className="btn btn-ghost" onClick={onImportClipboard}>
              Paste notes
            </button>
          </div>
          <p className="hint">
            Got shared notes? Import the Markdown/text file (or paste) onto this video.
          </p>
        </div>
      ) : (
        <div className="notes-list">
          {notes.map((n) => {
            const isAudio = n.kind === 'audio'
            const placeholder = isAudio ? 'Audio note' : 'Annotation only'
            return (
              <div
                key={n.id}
                className={`note-item ${selectedNoteId === n.id ? 'is-active' : ''}`}
                onClick={() => onSelect(n.id)}
              >
                <div className={`note-thumb ${!n.thumb ? 'note-thumb-empty' : ''}`} style={!n.thumb ? { borderColor: n.color } : undefined}>
                  {n.thumb && <img src={n.thumb} alt="" draggable={false} />}
                  {isAudio && (
                    <span className="note-audio-badge" style={{ background: n.color }}>
                      <AudioIcon size={11} />
                    </span>
                  )}
                </div>
                <div className="note-body">
                  <div className="note-top">
                    <span className="note-tc" style={{ color: n.color }}>
                      {isAudio && <AudioIcon size={11} className="tc-audio-icon" />}
                      {isAudio && typeof n.rangeEnd === 'number'
                        ? `${formatClock(n.time)}–${formatClock(n.rangeEnd)}`
                        : formatPrecise(n.time)}
                    </span>
                    <div className="note-actions">
                      <button
                        title="Edit note"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(n.id)
                        }}
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        title="Delete note"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(n.id)
                        }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                  <div className={`note-text ${!n.text.trim() ? 'is-muted' : ''}`}>
                    {n.text.trim() || placeholder}
                  </div>
                  {n.author && (
                    <div className="note-author">
                      <span className="author-avatar sm" style={{ background: colorForName(n.author) }}>
                        {initials(n.author)}
                      </span>
                      {n.author}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="notes-footer">{plural(notes.length, 'note')}</div>
    </aside>
  )
}
