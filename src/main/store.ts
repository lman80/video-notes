import { app } from 'electron'
import type { IpcMain } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'

/**
 * Tiny, dependency-free JSON store kept in the OS user-data directory:
 *   macOS:   ~/Library/Application Support/Video Notes/
 *   Windows: %APPDATA%/Video Notes/
 *
 * The renderer owns application state (Zustand) and pushes the full DB here
 * on a debounce. Writes are atomic (write temp + rename) so a crash mid-save
 * can never corrupt the database.
 */

interface DB {
  version: number
  videos: unknown[]
  notes: unknown[]
}

const EMPTY_DB: DB = { version: 1, videos: [], notes: [] }

function dbPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'video-notes-db.json')
}

function readDB(): DB {
  const file = dbPath()
  if (!existsSync(file)) return { ...EMPTY_DB }
  try {
    const raw = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : []
    }
  } catch (err) {
    console.error('Failed to read DB, starting fresh:', err)
    return { ...EMPTY_DB }
  }
}

function writeDB(data: Partial<DB>): boolean {
  const file = dbPath()
  const tmp = `${file}.tmp`
  const payload: DB = {
    version: 1,
    videos: Array.isArray(data.videos) ? data.videos : [],
    notes: Array.isArray(data.notes) ? data.notes : []
  }
  try {
    writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8')
    renameSync(tmp, file)
    return true
  } catch (err) {
    console.error('Failed to write DB:', err)
    return false
  }
}

export function registerStoreHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('store:read', () => readDB())
  ipcMain.handle('store:write', (_e, data: Partial<DB>) => writeDB(data))
  ipcMain.handle('store:path', () => dbPath())
}
