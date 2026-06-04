import { app } from 'electron'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import ffmpegStatic from 'ffmpeg-static'

/** Locate an ffmpeg binary: the bundled one first (works packaged + in a GUI
 *  app with no shell PATH), then common system locations as a fallback. */
function resolveFfmpeg(): string | null {
  let bundled = ffmpegStatic as unknown as string | null
  if (bundled && app.isPackaged) bundled = bundled.replace('app.asar', 'app.asar.unpacked')
  if (bundled && existsSync(bundled)) return bundled
  for (const cand of [
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    'ffmpeg'
  ]) {
    if (cand === 'ffmpeg' || existsSync(cand)) return cand
  }
  return null
}

/**
 * Stream a video's audio through ffmpeg (decoding audio only, sequentially —
 * so even a multi-GB file uses little memory) and reduce it to a small array
 * of normalized peaks for the waveform strip.
 */
export function computeWaveform(filePath: string, buckets = 1600): Promise<number[] | null> {
  return new Promise((resolve) => {
    const ffmpeg = resolveFfmpeg()
    if (!ffmpeg || !existsSync(filePath)) {
      resolve(null)
      return
    }
    const sampleRate = 2000 // mono, 2 kHz — plenty for an amplitude envelope
    const args = [
      '-v', 'error',
      '-i', filePath,
      '-vn',
      '-ac', '1',
      '-ar', String(sampleRate),
      '-f', 'f32le',
      'pipe:1'
    ]

    let child
    try {
      child = spawn(ffmpeg, args)
    } catch {
      resolve(null)
      return
    }

    const chunks: Buffer[] = []
    let total = 0
    const MAX_PCM = 240 * 1024 * 1024 // ~8h at 2kHz; backstop only

    child.stdout.on('data', (d: Buffer) => {
      total += d.length
      if (total > MAX_PCM) {
        try {
          child.kill()
        } catch {
          /* ignore */
        }
        return
      }
      chunks.push(d)
    })
    child.on('error', () => resolve(null))
    child.on('close', () => {
      if (chunks.length === 0) {
        resolve(null)
        return
      }
      const buf = Buffer.concat(chunks)
      const usableLen = Math.floor(buf.length / 4) * 4
      if (usableLen === 0) {
        resolve(null)
        return
      }
      const samples = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + usableLen))
      const n = samples.length
      const block = Math.max(1, Math.floor(n / buckets))
      const peaks = new Array<number>(buckets).fill(0)
      let max = 0
      for (let i = 0; i < buckets; i++) {
        const start = i * block
        const end = Math.min(n, start + block)
        let peak = 0
        for (let j = start; j < end; j++) {
          const v = samples[j] < 0 ? -samples[j] : samples[j]
          if (v > peak) peak = v
        }
        peaks[i] = peak
        if (peak > max) max = peak
      }
      if (max > 0) {
        for (let i = 0; i < buckets; i++) peaks[i] = Math.round((peaks[i] / max) * 1000) / 1000
      }
      resolve(peaks)
    })
  })
}
