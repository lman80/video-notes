import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { createReadStream, existsSync, statSync } from 'fs'
import { Readable } from 'stream'
import { registerStoreHandlers } from './store'
import { computeWaveform } from './waveform'

const isDev = !app.isPackaged
const GITHUB_REPO = 'lman80/video-notes'

/** Numeric "is version a newer than b" (ignores any leading "v"). */
function isVersionNewer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

/**
 * Map a file extension to a MIME type the <video> element understands.
 * Chromium (bundled with Electron, proprietary codecs enabled) plays
 * mp4/m4v/mov(h264)/webm reliably. Others are passed through best-effort.
 */
function mimeForPath(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    case 'webm':
      return 'video/webm'
    case 'ogv':
      return 'video/ogg'
    case 'mkv':
      return 'video/x-matroska'
    case 'avi':
      return 'video/x-msvideo'
    case 'm4a':
      return 'audio/mp4'
    case 'mp3':
      return 'audio/mpeg'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Privileged scheme so the renderer can stream local video files with
 * proper byte-range support (required for smooth seeking/scrubbing) without
 * disabling web security. URLs look like:  media://stream/<encodeURIComponent(absPath)>
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function registerMediaProtocol(): void {
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url)
      // Everything after media://stream/ is the encoded absolute path.
      const encoded = url.pathname.replace(/^\/+/, '')
      const filePath = decodeURIComponent(encoded)

      if (!filePath || !existsSync(filePath)) {
        return new Response('Not found', { status: 404 })
      }

      const stat = statSync(filePath)
      const fileSize = stat.size
      if (fileSize === 0) {
        return new Response('Empty file', { status: 404 })
      }
      const mime = mimeForPath(filePath)
      const rangeHeader = request.headers.get('Range')

      const baseHeaders: Record<string, string> = {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        // Allow the canvas to read frames without tainting (thumbnails / snapshots).
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
        const hasStart = !!match && match[1] !== ''
        const hasEnd = !!match && match[2] !== ''
        let start: number
        let end: number
        if (!hasStart && hasEnd) {
          // Suffix range "bytes=-N" → the last N bytes.
          const n = parseInt(match![2], 10)
          start = Number.isNaN(n) ? 0 : Math.max(0, fileSize - n)
          end = fileSize - 1
        } else {
          start = hasStart ? parseInt(match![1], 10) : 0
          end = hasEnd ? parseInt(match![2], 10) : fileSize - 1
        }
        if (Number.isNaN(start) || start < 0) start = 0
        if (Number.isNaN(end) || end >= fileSize) end = fileSize - 1
        if (start > end) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` }
          })
        }

        const nodeStream = createReadStream(filePath, { start, end })
        request.signal?.addEventListener('abort', () => nodeStream.destroy())

        return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': String(end - start + 1)
          }
        })
      }

      const nodeStream = createReadStream(filePath)
      request.signal?.addEventListener('abort', () => nodeStream.destroy())
      return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
        status: 200,
        headers: { ...baseHeaders, 'Content-Length': String(fileSize) }
      })
    } catch (err) {
      console.error('media protocol error', err)
      return new Response('Internal error', { status: 500 })
    }
  })
}

const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'ogv']

function registerIpcHandlers(): void {
  // Native open dialog — always returns reliable absolute paths.
  ipcMain.handle('dialog:openVideo', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open video',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video', extensions: VIDEO_EXTENSIONS },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle('fs:exists', (_e, p: string) => {
    try {
      return existsSync(p)
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:size', (_e, p: string) => {
    try {
      return statSync(p).size
    } catch {
      return 0
    }
  })

  ipcMain.handle('waveform:compute', (_e, p: string) => computeWaveform(p))

  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('shell:open', (_e, url: string) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) shell.openExternal(url)
  })

  // Lightweight update check: ask GitHub for the latest release and compare.
  ipcMain.handle('updates:check', async () => {
    const current = app.getVersion()
    try {
      const res = await net.fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'VideoNotes-Updater' } }
      )
      if (!res.ok) return { ok: false, current, error: `GitHub returned ${res.status}` }
      const data = (await res.json()) as { tag_name?: string; html_url?: string }
      const latest = String(data.tag_name || '').replace(/^v/, '')
      if (!latest) return { ok: false, current, error: 'No published release found' }
      return {
        ok: true,
        current,
        latest,
        newer: isVersionNewer(latest, current),
        url: data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`
      }
    } catch {
      return { ok: false, current, error: 'Could not reach GitHub (are you online?)' }
    }
  })

  // Export notes to a text/markdown/csv file chosen by the user.
  ipcMain.handle(
    'export:notes',
    async (_e, defaultName: string, content: string) => {
      const result = await dialog.showSaveDialog({
        title: 'Export notes',
        defaultPath: defaultName,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'Text', extensions: ['txt'] },
          { name: 'CSV', extensions: ['csv'] }
        ]
      })
      if (result.canceled || !result.filePath) return null
      const { writeFile } = await import('fs/promises')
      await writeFile(result.filePath, content, 'utf-8')
      return result.filePath
    }
  )

  // Export a shareable, full-fidelity notes package.
  ipcMain.handle(
    'share:export',
    async (_e, defaultName: string, content: string) => {
      const result = await dialog.showSaveDialog({
        title: 'Export notes for sharing',
        defaultPath: defaultName,
        filters: [
          { name: 'Video Notes', extensions: ['vidnotes'] },
          { name: 'JSON', extensions: ['json'] }
        ]
      })
      if (result.canceled || !result.filePath) return null
      const { writeFile } = await import('fs/promises')
      await writeFile(result.filePath, content, 'utf-8')
      return result.filePath
    }
  )

  // Pick and read a notes package to import.
  ipcMain.handle('share:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import notes',
      properties: ['openFile'],
      filters: [
        { name: 'Notes', extensions: ['md', 'txt', 'vidnotes', 'json', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    try {
      const { readFile } = await import('fs/promises')
      return await readFile(result.filePaths[0], 'utf-8')
    } catch (err) {
      console.error('import read failed', err)
      return null
    }
  })

  registerStoreHandlers(ipcMain)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: '#0d0e12',
    title: 'Video Notes',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // Open external links (e.g. help) in the real browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerMediaProtocol()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
