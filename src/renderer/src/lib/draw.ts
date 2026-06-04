import type { NPoint, Shape } from '../types'

/** Draw a set of normalized shapes onto a 2D context of pixel size w×h.
 *  A soft dark shadow keeps strokes legible over bright footage. */
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  w: number,
  h: number,
  withShadow = true
): void {
  for (const s of shapes) drawShape(ctx, s, w, h, withShadow)
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  s: Shape,
  w: number,
  h: number,
  withShadow = true
): void {
  const lw = Math.max(1.5, s.size * w)
  ctx.save()
  ctx.lineWidth = lw
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (withShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = lw * 1.2
  }

  const P = (p: NPoint): { x: number; y: number } => ({ x: p.x * w, y: p.y * h })
  const pts = s.points

  if (s.tool === 'pen') {
    if (pts.length === 1) {
      const p = P(pts[0])
      ctx.beginPath()
      ctx.arc(p.x, p.y, lw / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (pts.length > 1) {
      ctx.beginPath()
      const p0 = P(pts[0])
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < pts.length; i++) {
        const p = P(pts[i])
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
  } else if (pts.length >= 2) {
    const a = P(pts[0])
    const b = P(pts[1])
    if (s.tool === 'rect') {
      ctx.strokeRect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y)
      )
    } else if (s.tool === 'ellipse') {
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const rx = Math.abs(b.x - a.x) / 2
      const ry = Math.abs(b.y - a.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (s.tool === 'arrow') {
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      const head = Math.max(lw * 3.2, 12)
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - head * Math.cos(ang - Math.PI / 6), b.y - head * Math.sin(ang - Math.PI / 6))
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - head * Math.cos(ang + Math.PI / 6), b.y - head * Math.sin(ang + Math.PI / 6))
      ctx.stroke()
    }
  }
  ctx.restore()
}
