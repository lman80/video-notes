import { contextBridge, ipcRenderer, webUtils } from 'electron'

/**
 * The only bridge between the sandboxed renderer and Node/Electron.
 * Everything the UI is allowed to do with the OS lives here.
 */
const api = {
  /** Open the native file picker. Returns absolute paths (or [] if cancelled). */
  openVideoDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openVideo'),

  /** Resolve the absolute path of a File dropped onto the window. */
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      // Fallback for older Electron where File.path still exists.
      return (file as unknown as { path?: string }).path || ''
    }
  },

  /** Build a streamable URL for a local video file. */
  toMediaUrl: (absPath: string): string =>
    `media://stream/${encodeURIComponent(absPath)}`,

  /** Whether a path still exists on disk (to flag moved/deleted videos). */
  fileExists: (absPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:exists', absPath),

  /** File size in bytes (0 if unknown). */
  fileSize: (absPath: string): Promise<number> => ipcRenderer.invoke('fs:size', absPath),

  /** Compute the audio waveform peaks for a video via ffmpeg (main process). */
  computeWaveform: (absPath: string): Promise<number[] | null> =>
    ipcRenderer.invoke('waveform:compute', absPath),

  /** The running app's version. */
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  /** Ask GitHub whether a newer release exists. */
  checkForUpdates: (): Promise<{
    ok: boolean
    current: string
    latest?: string
    newer?: boolean
    url?: string
    error?: string
  }> => ipcRenderer.invoke('updates:check'),

  /** Open an https URL in the user's default browser. */
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url),

  /** Load the persisted database. */
  readDB: (): Promise<{ version: number; videos: unknown[]; notes: unknown[] }> =>
    ipcRenderer.invoke('store:read'),

  /** Persist the full database. */
  writeDB: (data: { videos: unknown[]; notes: unknown[] }): Promise<boolean> =>
    ipcRenderer.invoke('store:write', data),

  /** Absolute path of the database file (shown in Settings/About). */
  dbPath: (): Promise<string> => ipcRenderer.invoke('store:path'),

  /** Save exported notes to a user-chosen file. Returns the path, or null. */
  exportNotes: (defaultName: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('export:notes', defaultName, content),

  /** Save a shareable notes package (.vidnotes). Returns the path, or null. */
  exportNotesPackage: (defaultName: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('share:export', defaultName, content),

  /** Pick and read a notes package/file. Returns its text, or null. */
  importNotesFile: (): Promise<string | null> => ipcRenderer.invoke('share:import'),

  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
