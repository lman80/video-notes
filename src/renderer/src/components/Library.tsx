import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { plural } from '../lib/format'
import { generatePoster } from '../lib/poster'
import { initials, colorForName } from '../lib/author'
import { AuthorModal } from './AuthorModal'
import { UpdateChecker } from './UpdateChecker'

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|ogv)$/i

export function Library(): JSX.Element {
  const videos = useStore((s) => s.videos)
  const notes = useStore((s) => s.notes)
  const addVideosFromPaths = useStore((s) => s.addVideosFromPaths)
  const openVideo = useStore((s) => s.openVideo)
  const removeVideo = useStore((s) => s.removeVideo)
  const patchVideo = useStore((s) => s.patchVideo)
  const author = useStore((s) => s.author)
  const setAuthor = useStore((s) => s.setAuthor)
  const [dragging, setDragging] = useState(false)
  const [showAuthorModal, setShowAuthorModal] = useState(false)
  const posterAttempts = useRef<Set<string>>(new Set())

  // Generate poster thumbnails (one at a time) for videos that don't have one.
  useEffect(() => {
    let cancelled = false
    const run = async (): Promise<void> => {
      for (const v of videos) {
        if (cancelled) return
        if (v.poster || v.missing || posterAttempts.current.has(v.id)) continue
        posterAttempts.current.add(v.id)
        const poster = await generatePoster(window.api.toMediaUrl(v.path))
        if (cancelled) return
        if (poster) patchVideo(v.id, { poster })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [videos, patchVideo])

  const noteCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of notes) m.set(n.videoId, (m.get(n.videoId) || 0) + 1)
    return m
  }, [notes])

  const sorted = useMemo(
    () => [...videos].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)),
    [videos]
  )

  const handlePaths = useCallback(
    (paths: string[]) => {
      const valid = paths.filter((p) => VIDEO_EXT.test(p))
      if (valid.length === 0) return
      const added = addVideosFromPaths(valid)
      if (added[0]) openVideo(added[0].id)
    },
    [addVideosFromPaths, openVideo]
  )

  const onPick = useCallback(async () => {
    const paths = await window.api.openVideoDialog()
    handlePaths(paths)
  }, [handlePaths])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const paths: string[] = []
      for (const f of Array.from(e.dataTransfer.files)) {
        const p = window.api.getPathForFile(f)
        if (p) paths.push(p)
      }
      handlePaths(paths)
    },
    [handlePaths]
  )

  return (
    <div
      className={`library ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <header className="lib-header drag">
        <div className="lib-brand">
          <span className="brand-dot" />
          <h1>Video Notes</h1>
        </div>
        <div className="lib-header-actions no-drag">
          <button
            className="author-chip lib-author"
            onClick={() => setShowAuthorModal(true)}
            title={author ? 'Change your name' : 'Set your name'}
          >
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
          <button className="btn btn-primary" onClick={onPick}>
            Open video…
          </button>
        </div>
      </header>

      {sorted.length === 0 ? (
        <div className="dropzone" onClick={onPick}>
          <div className="dropzone-inner">
            <div className="dropzone-icon">⤓</div>
            <h2>Drop a video here</h2>
            <p>or click to choose a file — MP4, MOV, WebM, M4V…</p>
            <p className="hint">
              Pause anytime, draw on the frame, and save timestamped notes.
            </p>
          </div>
        </div>
      ) : (
        <div className="lib-body">
          <h2 className="section-title">Recent</h2>
          <div className="grid">
            {sorted.map((v) => {
              const count = noteCounts.get(v.id) || 0
              return (
                <div
                  key={v.id}
                  className={`card ${v.missing ? 'is-missing' : ''}`}
                  onClick={() => !v.missing && openVideo(v.id)}
                  title={v.path}
                >
                  <div className="card-thumb">
                    {v.poster ? (
                      <img className="card-poster" src={v.poster} alt="" draggable={false} />
                    ) : (
                      <span className="card-thumb-icon">▶</span>
                    )}
                    <span className="card-play-overlay">▶</span>
                    {count > 0 && <span className="card-badge">{count}</span>}
                  </div>
                  <div className="card-meta">
                    <div className="card-name">{v.name}</div>
                    <div className="card-sub">
                      {v.missing ? (
                        <span className="missing-tag">File not found</span>
                      ) : (
                        <span>{count > 0 ? plural(count, 'note') : 'No notes yet'}</span>
                      )}
                    </div>
                  </div>
                  <button
                    className="card-remove no-drag"
                    title="Remove from library"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeVideo(v.id)
                    }}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <footer className="lib-footer">
        <UpdateChecker />
      </footer>

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">Drop to add video</div>
        </div>
      )}

      {showAuthorModal && (
        <AuthorModal
          initialName={author}
          onSave={setAuthor}
          onClose={() => setShowAuthorModal(false)}
        />
      )}
    </div>
  )
}
