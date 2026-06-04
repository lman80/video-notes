import { useCallback, useEffect, useRef } from 'react'
import type { Note } from '../types'

interface Props {
  peaks: number[] | null
  loading: boolean
  duration: number
  viewStart: number
  viewLen: number
  currentTime: number
  audioNotes: Note[]
  selectedNoteId: string | null
  onSeek: (t: number) => void
  onSelectRange: (start: number, end: number) => void
  onSelectNote: (id: string) => void
  onZoomAt: (focalTime: number, deltaY: number) => void
  onPan: (deltaTime: number) => void
}

const TAP_THRESHOLD = 6
const MIN_RANGE = 0.12

export function Waveform(props: Props): JSX.Element {
  const {
    peaks,
    loading,
    duration,
    viewStart,
    viewLen,
    currentTime,
    audioNotes,
    selectedNoteId,
    onSeek,
    onSelectRange,
    onSelectNote,
    onZoomAt,
    onPan
  } = props

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const curX = useRef(0)
  const maxDist = useRef(0)
  const bounds = useRef<DOMRect | null>(null)

  // Latest values for the native (non-passive) wheel listener.
  const latest = useRef(props)
  latest.current = props

  const accent = useRef('#4f8cff')
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    if (v) accent.current = v
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (viewLen <= 0) return

    const mid = h / 2
    const ac = accent.current
    const timeToX = (t: number): number => ((t - viewStart) / viewLen) * w
    const playedX = timeToX(currentTime)

    if (peaks && peaks.length > 0) {
      for (let x = 0; x < w; x++) {
        const t = viewStart + (x / w) * viewLen
        const idx = Math.min(peaks.length - 1, Math.max(0, Math.floor((t / duration) * peaks.length)))
        const amp = peaks[idx]
        const barH = Math.max(0.5, amp * (h * 0.46))
        ctx.fillStyle = x <= playedX ? ac : 'rgba(255,255,255,0.22)'
        ctx.fillRect(x, mid - barH, 1, barH * 2)
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.fillRect(0, mid - 1, w, 2)
      ctx.fillStyle = ac
      ctx.fillRect(0, mid - 1, Math.max(0, Math.min(w, playedX)), 2)
    }

    // Audio-note regions (clipped to the visible window).
    for (const n of audioNotes) {
      const end = typeof n.rangeEnd === 'number' ? n.rangeEnd : n.time
      let x1 = timeToX(n.time)
      let x2 = timeToX(end)
      if (x2 < 0 || x1 > w) continue
      x1 = Math.max(0, x1)
      x2 = Math.min(w, x2)
      const active = n.id === selectedNoteId
      ctx.fillStyle = withAlpha(n.color, active ? 0.32 : 0.16)
      ctx.fillRect(x1, 0, Math.max(2, x2 - x1), h)
      ctx.fillStyle = n.color
      ctx.fillRect(x1, 0, 1.5, h)
      ctx.fillRect(x2 - 1.5, 0, 1.5, h)
    }

    if (dragging.current && maxDist.current >= TAP_THRESHOLD) {
      const a = Math.min(startX.current, curX.current)
      const b = Math.max(startX.current, curX.current)
      ctx.fillStyle = withAlpha(ac, 0.3)
      ctx.fillRect(a, 0, b - a, h)
      ctx.fillStyle = ac
      ctx.fillRect(a, 0, 1.5, h)
      ctx.fillRect(b - 1.5, 0, 1.5, h)
    }

    if (playedX >= 0 && playedX <= w) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(playedX - 0.75, 0, 1.5, h)
    }
  }, [peaks, duration, viewStart, viewLen, currentTime, audioNotes, selectedNoteId])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const ro = new ResizeObserver(() => draw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [draw])

  // Native wheel listener so we can preventDefault (zoom / horizontal pan).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      const p = latest.current
      if (p.duration <= 0) return
      e.preventDefault()
      const b = el.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width))
      const focal = p.viewStart + frac * p.viewLen
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const d = e.deltaX || e.deltaY
        p.onPan((d / b.width) * p.viewLen)
      } else {
        p.onZoomAt(focal, e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const xToTime = (clientX: number): number => {
    const b = bounds.current
    if (!b || viewLen <= 0) return 0
    const frac = Math.min(1, Math.max(0, (clientX - b.left) / b.width))
    return viewStart + frac * viewLen
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (duration <= 0) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    bounds.current = wrapRef.current!.getBoundingClientRect()
    dragging.current = true
    const x = e.clientX - bounds.current.left
    startX.current = x
    curX.current = x
    maxDist.current = 0
    draw()
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!dragging.current || !bounds.current) return
    const x = e.clientX - bounds.current.left
    curX.current = x
    maxDist.current = Math.max(maxDist.current, Math.abs(x - startX.current))
    draw()
  }
  const onPointerUp = (e: React.PointerEvent): void => {
    if (!dragging.current) return
    dragging.current = false
    if (maxDist.current < TAP_THRESHOLD) {
      const t = xToTime(e.clientX)
      const hit = audioNotes.find(
        (n) => t >= n.time && t <= (typeof n.rangeEnd === 'number' ? n.rangeEnd : n.time)
      )
      if (hit) onSelectNote(hit.id)
      else onSeek(t)
    } else {
      const t1 = xToTime(Math.min(e.clientX, (bounds.current?.left ?? 0) + startX.current))
      const t2 = xToTime(Math.max(e.clientX, (bounds.current?.left ?? 0) + startX.current))
      if (t2 - t1 >= MIN_RANGE) onSelectRange(t1, t2)
      else onSeek(t1)
    }
    draw()
  }

  return (
    <div
      ref={wrapRef}
      className="waveform"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="Tap to seek · drag to add an audio note · scroll to zoom, shift-scroll to pan"
    >
      <canvas ref={canvasRef} />
      {loading && <span className="waveform-hint">Analyzing audio…</span>}
    </div>
  )
}

/** Apply alpha to a hex or hsl color string. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', ` / ${alpha})`)
  return color
}
