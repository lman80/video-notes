import { useCallback, useEffect, useRef } from 'react'
import type { Shape, Tool, NPoint } from '../types'
import { uid } from '../lib/id'
import { drawShape, drawShapes } from '../lib/draw'

export interface DisplayRect {
  left: number
  top: number
  width: number
  height: number
}

interface Props {
  rect: DisplayRect
  shapes: Shape[]
  editable: boolean
  composing: boolean
  tool: Tool
  color: string
  size: number
  onCommitShape: (shape: Shape) => void
  onTapPlay: () => void
}

const TAP_THRESHOLD = 5 // px of movement below which a gesture counts as a tap

export function AnnotationLayer({
  rect,
  shapes,
  editable,
  composing,
  tool,
  color,
  size,
  onCommitShape,
  onTapPlay
}: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inProgress = useRef<Shape | null>(null)
  const drawing = useRef(false)
  const startClient = useRef<{ x: number; y: number } | null>(null)
  const maxDist = useRef(0)
  const boundsRef = useRef<DOMRect | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = rect.width
    const h = rect.height
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    drawShapes(ctx, shapes, w, h)
    if (inProgress.current) drawShape(ctx, inProgress.current, w, h)
  }, [rect.width, rect.height, shapes])

  useEffect(() => {
    redraw()
  }, [redraw])

  const toNorm = (clientX: number, clientY: number): NPoint => {
    const b = boundsRef.current
    if (!b) return { x: 0, y: 0 }
    return {
      x: Math.min(1, Math.max(0, (clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (clientY - b.top) / b.height))
    }
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (!editable) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    boundsRef.current = canvasRef.current!.getBoundingClientRect()
    drawing.current = true
    startClient.current = { x: e.clientX, y: e.clientY }
    maxDist.current = 0
    const p = toNorm(e.clientX, e.clientY)
    inProgress.current = {
      id: uid('s'),
      tool,
      color,
      size,
      points: tool === 'pen' ? [p] : [p, p]
    }
    redraw()
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    if (!drawing.current || !inProgress.current) return
    const start = startClient.current
    if (start) {
      const d = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (d > maxDist.current) maxDist.current = d
    }
    const p = toNorm(e.clientX, e.clientY)
    const shp = inProgress.current
    if (shp.tool === 'pen') shp.points.push(p)
    else shp.points[1] = p
    redraw()
  }

  const endStroke = (): void => {
    if (!drawing.current) return
    drawing.current = false
    const shp = inProgress.current
    inProgress.current = null
    const wasTap = maxDist.current < TAP_THRESHOLD
    if (wasTap) {
      // A tap (not a drag): resume playback when simply reviewing.
      if (!composing) onTapPlay()
      redraw()
      return
    }
    if (shp) onCommitShape(shp)
    redraw()
  }

  return (
    <canvas
      ref={canvasRef}
      className="annotation-layer"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        pointerEvents: editable ? 'auto' : 'none',
        cursor: editable ? 'crosshair' : 'default'
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
    />
  )
}
