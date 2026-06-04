import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../types'
import { formatClock } from '../lib/format'
import { Waveform } from './Waveform'
import {
  PlayIcon,
  PauseIcon,
  StepBackIcon,
  StepFwdIcon,
  VolumeIcon,
  MuteIcon,
  FullscreenIcon,
  PlusIcon,
  AudioIcon
} from './Icons'

interface Props {
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  rate: number
  notes: Note[]
  selectedNoteId: string | null
  peaks: number[] | null
  waveformLoading: boolean
  viewStart: number
  viewLen: number
  zoom: number
  waveformCollapsed: boolean
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onScrubStart: () => void
  onScrubEnd: () => void
  onStep: (dir: -1 | 1) => void
  onSetRate: (r: number) => void
  onSetVolume: (v: number) => void
  onToggleMute: () => void
  onAddNote: () => void
  onFullscreen: () => void
  onSelectNote: (id: string) => void
  onSelectRange: (start: number, end: number) => void
  onZoomAt: (focalTime: number, deltaY: number) => void
  onPan: (deltaTime: number) => void
  onSetZoom: (zoom: number) => void
  onResetZoom: () => void
  onToggleWaveform: () => void
}

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

export function Controls(props: Props): JSX.Element {
  const {
    playing,
    currentTime,
    duration,
    volume,
    muted,
    rate,
    notes,
    selectedNoteId,
    peaks,
    waveformLoading,
    viewStart,
    viewLen,
    zoom,
    waveformCollapsed,
    onTogglePlay,
    onSeek,
    onScrubStart,
    onScrubEnd,
    onStep,
    onSetRate,
    onSetVolume,
    onToggleMute,
    onAddNote,
    onFullscreen,
    onSelectNote,
    onSelectRange,
    onZoomAt,
    onPan,
    onSetZoom,
    onResetZoom,
    onToggleWaveform
  } = props

  const trackRef = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)
  const [hoverPct, setHoverPct] = useState<number | null>(null)

  const frameNotes = useMemo(() => notes.filter((n) => n.kind !== 'audio'), [notes])
  const audioNotes = useMemo(() => notes.filter((n) => n.kind === 'audio'), [notes])
  const zoomed = zoom > 1.001

  const len = viewLen > 0 ? viewLen : duration
  const start = viewLen > 0 ? viewStart : 0
  const pct = len > 0 ? Math.min(100, Math.max(0, ((currentTime - start) / len) * 100)) : 0

  const seekToClientX = (clientX: number): void => {
    const el = trackRef.current
    if (!el || len <= 0) return
    const r = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    onSeek(start + frac * len)
  }

  const onTrackDown = (e: React.PointerEvent): void => {
    if (len <= 0) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    scrubbing.current = true
    onScrubStart()
    seekToClientX(e.clientX)
  }
  const onTrackMove = (e: React.PointerEvent): void => {
    const el = trackRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setHoverPct(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)))
    }
    if (scrubbing.current) seekToClientX(e.clientX)
  }
  const onTrackUp = (): void => {
    if (!scrubbing.current) return
    scrubbing.current = false
    onScrubEnd()
  }

  // Wheel over the scrubber zooms / pans the timeline too (non-passive).
  const wheelState = useRef({ start, len, duration, onZoomAt, onPan })
  wheelState.current = { start, len, duration, onZoomAt, onPan }
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      const s = wheelState.current
      if (s.duration <= 0 || s.len <= 0) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const d = e.deltaX || e.deltaY
        s.onPan((d / r.width) * s.len)
      } else {
        s.onZoomAt(s.start + frac * s.len, e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="controls">
      {!waveformCollapsed && (
        <div className="waveform-row">
          <Waveform
            peaks={peaks}
            loading={waveformLoading}
            duration={duration}
            viewStart={start}
            viewLen={len}
            currentTime={currentTime}
            audioNotes={audioNotes}
            selectedNoteId={selectedNoteId}
            onSeek={onSeek}
            onSelectRange={onSelectRange}
            onSelectNote={onSelectNote}
            onZoomAt={onZoomAt}
            onPan={onPan}
          />
          <div className="wave-tools">
            <button
              className="wave-tool"
              onClick={() => onSetZoom(zoom / 1.6)}
              disabled={!zoomed}
              title="Zoom out"
            >
              −
            </button>
            <button
              className="wave-tool zoom-level"
              onClick={onResetZoom}
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="wave-tool"
              onClick={() => onSetZoom(zoom * 1.6)}
              disabled={zoom >= 59}
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div
        className="scrubber"
        ref={trackRef}
        onPointerDown={onTrackDown}
        onPointerMove={onTrackMove}
        onPointerUp={onTrackUp}
        onPointerLeave={() => setHoverPct(null)}
      >
        <div className="scrubber-track">
          <div className="scrubber-fill" style={{ width: `${pct}%` }} />
          {hoverPct !== null && (
            <div className="scrubber-hover" style={{ left: `${hoverPct}%` }}>
              <span>{formatClock(start + (hoverPct / 100) * len)}</span>
            </div>
          )}
          <div className="scrubber-head" style={{ left: `${pct}%` }} />
          {len > 0 &&
            frameNotes.map((n) => {
              const x = ((n.time - start) / len) * 100
              if (x < -1 || x > 101) return null
              return (
                <button
                  key={n.id}
                  className={`marker ${selectedNoteId === n.id ? 'is-active' : ''}`}
                  style={{ left: `${x}%`, background: n.color }}
                  title={n.text.trim() || 'Annotation'}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectNote(n.id)
                  }}
                />
              )
            })}
        </div>
      </div>

      <div className="controls-row">
        <div className="controls-left">
          <button className="ctl-btn" onClick={() => onStep(-1)} title="Previous frame (,)">
            <StepBackIcon />
          </button>
          <button className="ctl-btn ctl-play" onClick={onTogglePlay} title="Play / Pause (Space)">
            {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <button className="ctl-btn" onClick={() => onStep(1)} title="Next frame (.)">
            <StepFwdIcon />
          </button>

          <div className="time-readout">
            <span className="time-cur">{formatClock(currentTime)}</span>
            <span className="time-sep">/</span>
            <span className="time-dur">{formatClock(duration)}</span>
          </div>
        </div>

        <div className="controls-right">
          <button
            className={`ctl-btn ${!waveformCollapsed ? 'is-on' : ''}`}
            onClick={onToggleWaveform}
            title={waveformCollapsed ? 'Show audio waveform' : 'Hide audio waveform'}
          >
            <AudioIcon />
          </button>

          <div className="volume">
            <button className="ctl-btn" onClick={onToggleMute} title="Mute / Unmute">
              {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
            </button>
            <input
              className="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => onSetVolume(parseFloat(e.target.value))}
              title="Volume"
            />
          </div>

          <select
            className="rate-select"
            value={rate}
            onChange={(e) => onSetRate(parseFloat(e.target.value))}
            title="Playback speed"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>

          <button className="btn btn-primary add-note-btn" onClick={onAddNote} title="Add note (N)">
            <PlusIcon size={16} />
            <span>Note</span>
          </button>

          <button className="ctl-btn" onClick={onFullscreen} title="Fullscreen (F)">
            <FullscreenIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
