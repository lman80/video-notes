import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Shape, Tool, Note, NoteKind } from '../types'
import { captureThumb } from '../lib/capture'
import { AnnotationLayer, type DisplayRect } from './AnnotationLayer'
import { Controls } from './Controls'
import { NotesPanel, type ExportFormat } from './NotesPanel'
import { NoteComposer, PALETTE, SIZES } from './NoteComposer'
import { AuthorModal } from './AuthorModal'
import { BackIcon, PanelIcon, PersonIcon } from './Icons'
import {
  notesToMarkdown,
  notesToText,
  notesToCsv,
  notesToClipboard
} from '../lib/exporter'
import { parseNotesPackage } from '../lib/share'

const EMPTY_SHAPES: Shape[] = []
const FRAME = 1 / 30 // assumed frame duration for single-frame stepping
const NEAR_SECONDS = 5 // a saved note's overlay (shape + caption) only shows within this window of its time

/** Is the playhead close enough to a note for its annotation to be shown? */
function isNearNote(note: Note, t: number): boolean {
  const end = note.kind === 'audio' && typeof note.rangeEnd === 'number' ? note.rangeEnd : note.time
  return t >= note.time - NEAR_SECONDS && t <= end + NEAR_SECONDS
}

function containRect(sw: number, sh: number, vw: number, vh: number): DisplayRect {
  if (!vw || !vh || !sw || !sh) return { left: 0, top: 0, width: sw, height: sh }
  const scale = Math.min(sw / vw, sh / vh)
  const width = vw * scale
  const height = vh * scale
  return { left: (sw - width) / 2, top: (sh - height) / 2, width, height }
}

function isFormField(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

function cloneShapes(shapes: Shape[]): Shape[] {
  return shapes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }))
}

export function Player(): JSX.Element {
  const video = useStore((s) => s.currentVideo())
  const allNotes = useStore((s) => s.notes)
  const addNote = useStore((s) => s.addNote)
  const updateNote = useStore((s) => s.updateNote)
  const deleteNote = useStore((s) => s.deleteNote)
  const importNotes = useStore((s) => s.importNotes)
  const patchVideo = useStore((s) => s.patchVideo)
  const closeVideo = useStore((s) => s.closeVideo)
  const author = useStore((s) => s.author)
  const setAuthor = useStore((s) => s.setAuthor)

  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const playerMainRef = useRef<HTMLDivElement>(null)

  // Playback state
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [videoError, setVideoError] = useState(false)

  // Geometry
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 })

  // Annotation / composer state
  const [composing, setComposing] = useState(false)
  const [composeKind, setComposeKind] = useState<NoteKind>('frame')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [composeTime, setComposeTime] = useState(0)
  const [composeRangeEnd, setComposeRangeEnd] = useState<number | null>(null)
  const [draftShapes, setDraftShapes] = useState<Shape[]>([])
  const [draftText, setDraftText] = useState('')
  const [tool, setTool] = useState<Tool>('rect')
  const [color, setColor] = useState(PALETTE[0])
  const [size, setSize] = useState(SIZES[1].value)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  // Waveform (audio peaks) + author modal
  const [waveformLoading, setWaveformLoading] = useState(false)
  const [showAuthorModal, setShowAuthorModal] = useState(false)

  // Timeline zoom + waveform collapse
  const [zoom, setZoom] = useState(1)
  const [viewStart, setViewStart] = useState(0)
  const [waveformCollapsed, setWaveformCollapsed] = useState(
    () => localStorage.getItem('waveformCollapsed') === '1'
  )
  const zoomRef = useRef(1)
  const viewStartRef = useRef(0)

  const [showHelp, setShowHelp] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(
    () => localStorage.getItem('notesPanelCollapsed') === '1'
  )

  const togglePanel = useCallback(() => {
    setPanelCollapsed((c) => {
      const next = !c
      localStorage.setItem('notesPanelCollapsed', next ? '1' : '0')
      return next
    })
  }, [])

  const wasPlayingBeforeScrub = useRef(false)

  const videoId = video?.id ?? ''
  const mediaUrl = useMemo(
    () => (video ? window.api.toMediaUrl(video.path) : ''),
    [video]
  )

  const notes = useMemo<Note[]>(
    () => allNotes.filter((n) => n.videoId === videoId).sort((a, b) => a.time - b.time),
    [allNotes, videoId]
  )

  const peaks = video?.waveform ?? null

  // Compute & cache the audio waveform once per video (ffmpeg, main process).
  useEffect(() => {
    setWaveformLoading(false)
    if (!video || video.waveform) return
    const { id, path } = video
    let cancelled = false
    ;(async () => {
      try {
        setWaveformLoading(true)
        const result = await window.api.computeWaveform(path)
        if (cancelled) return
        if (result && result.length) patchVideo(id, { waveform: result })
      } catch (err) {
        console.error('Waveform generation failed:', err)
      } finally {
        if (!cancelled) setWaveformLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  // --- Timeline zoom ---
  const viewLen = duration > 0 ? duration / zoom : 0
  const viewStartClamped = Math.min(Math.max(0, viewStart), Math.max(0, duration - viewLen))

  useEffect(() => {
    zoomRef.current = zoom
    viewStartRef.current = viewStartClamped
  }, [zoom, viewStartClamped])

  // Reset zoom when switching videos.
  useEffect(() => {
    setZoom(1)
    setViewStart(0)
  }, [videoId])

  const zoomAt = useCallback((focalTime: number, deltaY: number) => {
    const dur = videoRef.current?.duration || 0
    if (dur <= 0) return
    const prevLen = dur / zoomRef.current
    const factor = deltaY < 0 ? 1.25 : 1 / 1.25
    const nextZoom = Math.min(60, Math.max(1, zoomRef.current * factor))
    const nextLen = dur / nextZoom
    const rel = prevLen > 0 ? (focalTime - viewStartRef.current) / prevLen : 0.5
    const ns = Math.max(0, Math.min(dur - nextLen, focalTime - rel * nextLen))
    setZoom(nextZoom)
    setViewStart(nextZoom <= 1 ? 0 : ns)
  }, [])

  const panBy = useCallback((deltaTime: number) => {
    const dur = videoRef.current?.duration || 0
    if (dur <= 0) return
    const len = dur / zoomRef.current
    setViewStart(Math.max(0, Math.min(dur - len, viewStartRef.current + deltaTime)))
  }, [])

  const setZoomLevel = useCallback((z: number) => {
    const dur = videoRef.current?.duration || 0
    const nextZoom = Math.min(60, Math.max(1, z))
    if (dur > 0) {
      const center = viewStartRef.current + dur / zoomRef.current / 2
      const nextLen = dur / nextZoom
      setViewStart(nextZoom <= 1 ? 0 : Math.max(0, Math.min(dur - nextLen, center - nextLen / 2)))
    }
    setZoom(nextZoom)
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(1)
    setViewStart(0)
  }, [])

  const toggleWaveform = useCallback(() => {
    setWaveformCollapsed((c) => {
      const next = !c
      localStorage.setItem('waveformCollapsed', next ? '1' : '0')
      return next
    })
  }, [])

  const flashToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  // ---- Geometry observers ----
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = (): void =>
      setStageSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rect = useMemo(
    () => containRect(stageSize.w, stageSize.h, videoSize.w, videoSize.h),
    [stageSize, videoSize]
  )

  // ---- Smooth playhead while playing ----
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = (): void => {
      const v = videoRef.current
      if (v) {
        setCurrentTime(v.currentTime)
        // Keep the playhead in view when zoomed in.
        const z = zoomRef.current
        const dur = v.duration || 0
        if (z > 1 && dur > 0) {
          const len = dur / z
          const vs = viewStartRef.current
          const t = v.currentTime
          if (t < vs + len * 0.08 || t > vs + len * 0.92) {
            const ns = Math.max(0, Math.min(dur - len, t - len / 2))
            viewStartRef.current = ns
            setViewStart(ns)
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // ---- Fullscreen tracking ----
  useEffect(() => {
    const onFs = (): void => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // ---- Playback helpers ----
  const seek = useCallback((t: number) => {
    const v = videoRef.current
    if (!v) return
    const dur = v.duration || 0
    const clamped = Math.min(dur || t, Math.max(0, t))
    v.currentTime = clamped
    setCurrentTime(clamped)
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }, [])

  const step = useCallback((dir: -1 | 1) => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    const dur = v.duration || 0
    v.currentTime = Math.min(dur, Math.max(0, v.currentTime + dir * FRAME))
    setCurrentTime(v.currentTime)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = playerMainRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen()
  }, [])

  // ---- Composer flow ----
  const exitCompose = useCallback(() => {
    setComposing(false)
    setComposeKind('frame')
    setComposeRangeEnd(null)
    setEditingNoteId(null)
    setDraftShapes([])
    setDraftText('')
  }, [])

  const beginCompose = useCallback((atTime: number, seed: Shape[] = []) => {
    const v = videoRef.current
    if (v && !v.paused) v.pause()
    setSelectedNoteId(null)
    setComposeKind('frame')
    setComposeRangeEnd(null)
    setComposeTime(atTime)
    setEditingNoteId(null)
    setDraftShapes(seed)
    setDraftText('')
    setComposing(true)
  }, [])

  const beginAudioNote = useCallback(
    (start: number, end: number) => {
      const v = videoRef.current
      if (v && !v.paused) v.pause()
      setSelectedNoteId(null)
      setComposeKind('audio')
      setComposeTime(start)
      setComposeRangeEnd(end)
      setEditingNoteId(null)
      setDraftShapes([])
      setDraftText('')
      setComposing(true)
      seek(start)
    },
    [seek]
  )

  const handleCommitShape = useCallback(
    (shape: Shape) => {
      if (composing) {
        setDraftShapes((prev) => [...prev, shape])
      } else {
        const v = videoRef.current
        beginCompose(v ? v.currentTime : currentTime, [shape])
      }
    },
    [composing, beginCompose, currentTime]
  )

  const saveNote = useCallback(() => {
    const text = draftText.trim()
    const isAudio = composeKind === 'audio'
    const shapes = isAudio ? [] : draftShapes
    // An audio note needs text (it has no drawing); a frame note needs text or a shape.
    if (!text && shapes.length === 0) {
      if (isAudio) {
        flashToast('Add a comment for this audio range')
        return
      }
      exitCompose()
      return
    }
    const v = videoRef.current
    const thumb = v ? captureThumb(v, shapes) : undefined
    const rangeEnd = isAudio ? composeRangeEnd ?? composeTime : undefined
    if (editingNoteId) {
      updateNote(editingNoteId, {
        text,
        shapes,
        color,
        kind: composeKind,
        rangeEnd,
        ...(thumb ? { thumb } : {})
      })
      setSelectedNoteId(editingNoteId)
    } else {
      const created = addNote({
        videoId,
        time: composeTime,
        text,
        color,
        shapes,
        kind: composeKind,
        rangeEnd,
        author: author || undefined,
        thumb
      })
      setSelectedNoteId(created.id)
    }
    exitCompose()
    flashToast(editingNoteId ? 'Note updated' : 'Note saved')
  }, [
    draftText,
    draftShapes,
    composeKind,
    composeRangeEnd,
    editingNoteId,
    color,
    videoId,
    composeTime,
    author,
    addNote,
    updateNote,
    exitCompose,
    flashToast
  ])

  const editNote = useCallback(
    (id: string) => {
      const n = notes.find((x) => x.id === id)
      if (!n) return
      seek(n.time)
      setSelectedNoteId(null)
      setComposeKind(n.kind || 'frame')
      setComposeTime(n.time)
      setComposeRangeEnd(typeof n.rangeEnd === 'number' ? n.rangeEnd : null)
      setDraftShapes(cloneShapes(n.shapes))
      setDraftText(n.text)
      setColor(n.color || PALETTE[0])
      setEditingNoteId(id)
      setComposing(true)
    },
    [notes, seek]
  )

  const selectNote = useCallback(
    (id: string) => {
      const n = notes.find((x) => x.id === id)
      if (!n) return
      if (composing) exitCompose()
      const v = videoRef.current
      if (v && !v.paused) v.pause()
      seek(n.time)
      setSelectedNoteId(id)
    },
    [notes, composing, exitCompose, seek]
  )

  const removeNote = useCallback(
    (id: string) => {
      deleteNote(id)
      if (selectedNoteId === id) setSelectedNoteId(null)
      if (editingNoteId === id) exitCompose()
    },
    [deleteNote, selectedNoteId, editingNoteId, exitCompose]
  )

  // ---- Export ----
  const onExport = useCallback(
    async (fmt: ExportFormat) => {
      if (!video) return
      const base = video.name.replace(/\.[^.]+$/, '')
      if (fmt === 'copy') {
        try {
          await navigator.clipboard.writeText(notesToClipboard(video, notes))
          flashToast('Copied — paste to import elsewhere')
        } catch {
          flashToast('Could not access clipboard')
        }
        return
      }
      const map = {
        md: { content: notesToMarkdown(video, notes), ext: 'md' },
        txt: { content: notesToText(video, notes), ext: 'txt' },
        csv: { content: notesToCsv(video, notes), ext: 'csv' }
      } as const
      const { content, ext } = map[fmt]
      const saved = await window.api.exportNotes(`${base} — notes.${ext}`, content)
      if (saved) flashToast('Notes exported')
    },
    [video, notes, flashToast]
  )

  const applyImportText = useCallback(
    (text: string | null) => {
      if (!video) return
      if (!text || !text.trim()) {
        flashToast('Nothing to import')
        return
      }
      const parsed = parseNotesPackage(text)
      if (!parsed || parsed.notes.length === 0) {
        flashToast('No importable notes found')
        return
      }
      const { added, updated } = importNotes(video.id, parsed.notes)
      if (added && updated) flashToast(`Imported ${added} new, updated ${updated}`)
      else if (added) flashToast(`Imported ${added} note${added === 1 ? '' : 's'}`)
      else flashToast(`Updated ${updated} note${updated === 1 ? '' : 's'}`)
    },
    [video, importNotes, flashToast]
  )

  const onImport = useCallback(async () => {
    applyImportText(await window.api.importNotesFile())
  }, [applyImportText])

  const onImportClipboard = useCallback(async () => {
    try {
      applyImportText(await navigator.clipboard.readText())
    } catch {
      flashToast('Could not read clipboard')
    }
  }, [applyImportText, flashToast])

  // ---- Back to library (persist resume position) ----
  const goBack = useCallback(() => {
    const v = videoRef.current
    if (v && video) patchVideo(video.id, { lastTime: v.currentTime, duration: v.duration || undefined })
    closeVideo()
  }, [video, patchVideo, closeVideo])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isFormField(e.target)) return
      const v = videoRef.current
      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (v) seek(v.currentTime - (e.shiftKey ? 1 : 5))
          break
        case 'ArrowRight':
          e.preventDefault()
          if (v) seek(v.currentTime + (e.shiftKey ? 1 : 5))
          break
        case 'KeyJ':
          e.preventDefault()
          if (v) seek(v.currentTime - 10)
          break
        case 'KeyL':
          e.preventDefault()
          if (v) seek(v.currentTime + 10)
          break
        case 'Comma':
          e.preventDefault()
          step(-1)
          break
        case 'Period':
          e.preventDefault()
          step(1)
          break
        case 'KeyN':
        case 'KeyM':
          e.preventDefault()
          if (!composing && v) beginCompose(v.currentTime)
          break
        case 'KeyF':
          toggleFullscreen()
          break
        case 'Escape':
          if (composing) exitCompose()
          else if (selectedNoteId) setSelectedNoteId(null)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [composing, selectedNoteId, togglePlay, seek, step, beginCompose, toggleFullscreen, exitCompose])

  // ---- Persist resume position on unmount ----
  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v && videoId) {
        patchVideo(videoId, {
          lastTime: v.currentTime,
          duration: v.duration || undefined
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  const displayShapes = useMemo<Shape[]>(() => {
    if (composing) return draftShapes
    if (selectedNoteId) {
      const n = notes.find((x) => x.id === selectedNoteId)
      if (n && isNearNote(n, currentTime)) return n.shapes
    }
    return EMPTY_SHAPES
  }, [composing, draftShapes, selectedNoteId, notes, currentTime])

  const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null
  const showCaption =
    !!selectedNote && !composing && !!selectedNote.text.trim() && isNearNote(selectedNote, currentTime)

  if (!video) return <div className="boot">No video selected.</div>

  return (
    <div className={`player ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="player-main" ref={playerMainRef}>
        <header className="player-top drag">
          <button className="ctl-btn no-drag" onClick={goBack} title="Back to library">
            <BackIcon />
          </button>
          <div className="player-title">
            <span className="player-name">{video.name}</span>
          </div>
          <button
            className="ctl-btn no-drag"
            onClick={() => setShowAuthorModal(true)}
            title={author ? `Notes tagged as “${author}” — click to change` : 'Set your name'}
          >
            <PersonIcon />
          </button>
          <button
            className={`ctl-btn no-drag ${!panelCollapsed ? 'is-on' : ''}`}
            onClick={togglePanel}
            title={panelCollapsed ? 'Show notes panel' : 'Hide notes panel'}
          >
            <PanelIcon />
          </button>
          <button
            className="ctl-btn no-drag"
            onClick={() => setShowHelp((s) => !s)}
            title="Keyboard shortcuts"
          >
            ?
          </button>
        </header>

        <div className="stage" ref={stageRef}>
          {videoError ? (
            <div className="stage-error">
              <h3>Can’t play this file</h3>
              <p>{video.path}</p>
              <p className="hint">
                The file may have moved, or its codec isn’t supported (try H.264 MP4).
              </p>
              <div className="row">
                <button
                  className="btn"
                  onClick={async () => {
                    const picked = await window.api.openVideoDialog()
                    if (picked[0]) {
                      patchVideo(video.id, { path: picked[0], missing: false })
                      setVideoError(false)
                    }
                  }}
                >
                  Relink file…
                </button>
                <button className="btn btn-ghost" onClick={goBack}>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="video-el"
                src={mediaUrl}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
                onClick={togglePlay}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget
                  setVideoSize({ w: v.videoWidth, h: v.videoHeight })
                  setDuration(v.duration || 0)
                  v.volume = volume
                  v.muted = muted
                  v.playbackRate = rate
                  if (video.lastTime && video.lastTime > 3 && video.lastTime < (v.duration || 0) - 2) {
                    v.currentTime = video.lastTime
                    setCurrentTime(video.lastTime)
                  }
                }}
                onError={() => setVideoError(true)}
                onPlay={() => setPlaying(true)}
                onPause={() => {
                  setPlaying(false)
                  const v = videoRef.current
                  if (v && videoId) patchVideo(videoId, { lastTime: v.currentTime })
                }}
                onEnded={() => setPlaying(false)}
                onVolumeChange={(e) => {
                  setVolume(e.currentTarget.volume)
                  setMuted(e.currentTarget.muted)
                }}
                onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
                onTimeUpdate={(e) => {
                  if (!playing) setCurrentTime(e.currentTarget.currentTime)
                }}
              />
              <AnnotationLayer
                rect={rect}
                shapes={displayShapes}
                editable={!playing && !(composing && composeKind === 'audio')}
                composing={composing}
                tool={tool}
                color={color}
                size={size}
                onCommitShape={handleCommitShape}
                onTapPlay={togglePlay}
              />
              {showCaption && selectedNote && (
                <div className="review-caption" style={{ borderColor: selectedNote.color }}>
                  {selectedNote.text}
                </div>
              )}
            </>
          )}
        </div>

        <Controls
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          muted={muted}
          rate={rate}
          notes={notes}
          selectedNoteId={selectedNoteId}
          peaks={peaks}
          waveformLoading={waveformLoading}
          viewStart={viewStartClamped}
          viewLen={viewLen}
          zoom={zoom}
          waveformCollapsed={waveformCollapsed}
          onTogglePlay={togglePlay}
          onSeek={seek}
          onScrubStart={() => {
            const v = videoRef.current
            wasPlayingBeforeScrub.current = !!v && !v.paused
            if (v) v.pause()
          }}
          onScrubEnd={() => {
            if (wasPlayingBeforeScrub.current) void videoRef.current?.play()
          }}
          onStep={step}
          onSetRate={(r) => {
            if (videoRef.current) videoRef.current.playbackRate = r
          }}
          onSetVolume={(vol) => {
            const v = videoRef.current
            if (v) {
              v.volume = vol
              v.muted = vol === 0
            }
          }}
          onToggleMute={() => {
            const v = videoRef.current
            if (v) v.muted = !v.muted
          }}
          onAddNote={() => {
            const v = videoRef.current
            if (!composing && v) beginCompose(v.currentTime)
          }}
          onFullscreen={toggleFullscreen}
          onSelectNote={selectNote}
          onSelectRange={beginAudioNote}
          onZoomAt={zoomAt}
          onPan={panBy}
          onSetZoom={setZoomLevel}
          onResetZoom={resetZoom}
          onToggleWaveform={toggleWaveform}
        />

        {composing && (
          <NoteComposer
            kind={composeKind}
            time={composeTime}
            rangeEnd={composeRangeEnd ?? undefined}
            tool={tool}
            color={color}
            size={size}
            text={draftText}
            shapeCount={draftShapes.length}
            editing={!!editingNoteId}
            author={author}
            onSetTool={setTool}
            onSetColor={setColor}
            onSetSize={setSize}
            onSetText={setDraftText}
            onUndo={() => setDraftShapes((p) => p.slice(0, -1))}
            onClear={() => setDraftShapes([])}
            onSave={saveNote}
            onCancel={exitCompose}
            onEditAuthor={() => setShowAuthorModal(true)}
          />
        )}

        {showHelp && <ShortcutsOverlay onClose={() => setShowHelp(false)} />}
        {showAuthorModal && (
          <AuthorModal
            initialName={author}
            onSave={setAuthor}
            onClose={() => setShowAuthorModal(false)}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>

      {!panelCollapsed && (
        <NotesPanel
          notes={notes}
          selectedNoteId={selectedNoteId}
          onSelect={selectNote}
          onEdit={editNote}
          onDelete={removeNote}
          onExport={onExport}
          onImport={onImport}
          onImportClipboard={onImportClipboard}
          onCollapse={togglePanel}
        />
      )}
    </div>
  )
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }): JSX.Element {
  const rows: [string, string][] = [
    ['Space / K', 'Play / pause'],
    ['← / →', 'Seek 5s (Shift = 1s)'],
    ['J / L', 'Jump 10s back / forward'],
    [', / .', 'Step one frame'],
    ['N / M', 'Add note at current time'],
    ['Drag frame', 'Draw an annotation'],
    ['Drag waveform', 'Add an audio note over a range'],
    ['F', 'Fullscreen'],
    ['Esc', 'Cancel note / close'],
    ['⌘/Ctrl + Enter', 'Save note (while composing)']
  ]
  return (
    <div className="overlay" onClick={onClose}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        <table>
          <tbody>
            {rows.map(([k, d]) => (
              <tr key={k}>
                <td>
                  <kbd>{k}</kbd>
                </td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
