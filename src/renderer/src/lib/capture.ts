import type { Shape } from '../types'
import { drawShapes } from './draw'

/** Grab the current video frame (with annotations composited on top) as a
 *  small JPEG data URL for the notes list. Returns undefined if the frame
 *  isn't ready or the canvas is tainted. */
export function captureThumb(
  video: HTMLVideoElement,
  shapes: Shape[],
  maxW = 360
): string | undefined {
  try {
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return undefined
    const scale = Math.min(1, maxW / vw)
    const w = Math.max(1, Math.round(vw * scale))
    const h = Math.max(1, Math.round(vh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(video, 0, 0, w, h)
    drawShapes(ctx, shapes, w, h)
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch (err) {
    console.warn('Thumbnail capture failed:', err)
    return undefined
  }
}
