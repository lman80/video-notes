/** Generate a poster thumbnail for a video by loading it off-screen, seeking a
 *  little way in, and capturing a downscaled JPEG. Resolves undefined on any
 *  failure (missing file, unsupported codec, taint, timeout). */
export function generatePoster(mediaUrl: string, maxW = 480): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.muted = true
    v.crossOrigin = 'anonymous'
    v.preload = 'auto'
    v.playsInline = true
    v.style.position = 'fixed'
    v.style.left = '-10000px'
    v.style.top = '0'
    v.style.width = '2px'
    v.style.height = '2px'
    v.style.opacity = '0'
    v.style.pointerEvents = 'none'
    document.body.appendChild(v)

    let settled = false
    const finish = (result: string | undefined): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        v.removeAttribute('src')
        v.load()
      } catch {
        /* ignore */
      }
      v.remove()
      resolve(result)
    }

    const capture = (): void => {
      try {
        const vw = v.videoWidth
        const vh = v.videoHeight
        if (!vw || !vh) return finish(undefined)
        const scale = Math.min(1, maxW / vw)
        const w = Math.max(1, Math.round(vw * scale))
        const h = Math.max(1, Math.round(vh * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(undefined)
        ctx.drawImage(v, 0, 0, w, h)
        finish(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        finish(undefined)
      }
    }

    const timer = setTimeout(() => finish(undefined), 9000)

    v.addEventListener('error', () => finish(undefined))
    v.addEventListener('loadeddata', () => {
      // Seek a little way in for a more representative frame than pure black.
      const target = Math.min(1, (v.duration || 2) * 0.1)
      if (Math.abs(v.currentTime - target) < 0.05) {
        capture()
      } else {
        v.addEventListener('seeked', capture, { once: true })
        try {
          v.currentTime = target
        } catch {
          capture()
        }
      }
    })

    v.src = mediaUrl
  })
}
