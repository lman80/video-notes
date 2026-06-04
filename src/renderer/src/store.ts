import { create } from 'zustand'
import type { Note, VideoEntry } from './types'
import { hashPath, uid } from './lib/id'

interface AppState {
  loaded: boolean
  videos: VideoEntry[]
  notes: Note[]
  currentVideoId: string | null
  /** The local user's display name, stamped onto notes they create. */
  author: string
  setAuthor: (name: string) => void

  load: () => Promise<void>
  /** Add one or more files by absolute path; returns the (possibly existing) entries. */
  addVideosFromPaths: (paths: string[]) => VideoEntry[]
  openVideo: (id: string) => void
  closeVideo: () => void
  removeVideo: (id: string) => void
  patchVideo: (id: string, patch: Partial<VideoEntry>) => void

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Note
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  /** Merge imported notes into a video (upsert by id). Returns counts. */
  importNotes: (videoId: string, incoming: Note[]) => { added: number; updated: number }

  notesForVideo: (videoId: string) => Note[]
  currentVideo: () => VideoEntry | null
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Persist the full DB on a short debounce so rapid edits collapse into one write. */
function scheduleSave(get: () => AppState): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const { videos, notes } = get()
    window.api.writeDB({ videos, notes }).catch((e) => console.error('save failed', e))
  }, 300)
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

export const useStore = create<AppState>((set, get) => ({
  loaded: false,
  videos: [],
  notes: [],
  currentVideoId: null,
  author:
    (typeof localStorage !== 'undefined' && localStorage.getItem('authorName')) || '',

  setAuthor: (name) => {
    const trimmed = name.trim()
    try {
      localStorage.setItem('authorName', trimmed)
    } catch {
      /* ignore */
    }
    set({ author: trimmed })
  },

  load: async () => {
    const db = await window.api.readDB()
    const videos = (db.videos as VideoEntry[]) || []
    const notes = (db.notes as Note[]) || []
    // Flag any videos whose files have moved/been deleted.
    await Promise.all(
      videos.map(async (v) => {
        v.missing = !(await window.api.fileExists(v.path))
      })
    )
    set({ videos, notes, loaded: true })
  },

  addVideosFromPaths: (paths) => {
    const now = Date.now()
    const existing = get().videos
    const added: VideoEntry[] = []
    const next = [...existing]
    for (const path of paths) {
      if (!path) continue
      const id = hashPath(path)
      const idx = next.findIndex((v) => v.id === id)
      if (idx >= 0) {
        const updated = { ...next[idx], missing: false, lastOpenedAt: now }
        next[idx] = updated
        added.push(updated)
        continue
      }
      const entry: VideoEntry = {
        id,
        path,
        name: baseName(path),
        addedAt: now,
        lastOpenedAt: now,
        missing: false
      }
      next.push(entry)
      added.push(entry)
    }
    set({ videos: next })
    scheduleSave(get)
    return added
  },

  openVideo: (id) => {
    const now = Date.now()
    set({
      currentVideoId: id,
      videos: get().videos.map((v) => (v.id === id ? { ...v, lastOpenedAt: now } : v))
    })
    scheduleSave(get)
  },

  closeVideo: () => set({ currentVideoId: null }),

  removeVideo: (id) => {
    set({
      videos: get().videos.filter((v) => v.id !== id),
      notes: get().notes.filter((n) => n.videoId !== id),
      currentVideoId: get().currentVideoId === id ? null : get().currentVideoId
    })
    scheduleSave(get)
  },

  patchVideo: (id, patch) => {
    set({ videos: get().videos.map((v) => (v.id === id ? { ...v, ...patch } : v)) })
    scheduleSave(get)
  },

  addNote: (note) => {
    const now = Date.now()
    const full: Note = { ...note, id: uid('n'), createdAt: now, updatedAt: now }
    set({ notes: [...get().notes, full] })
    scheduleSave(get)
    return full
  },

  updateNote: (id, patch) => {
    set({
      notes: get().notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n
      )
    })
    scheduleSave(get)
  },

  deleteNote: (id) => {
    set({ notes: get().notes.filter((n) => n.id !== id) })
    scheduleSave(get)
  },

  importNotes: (videoId, incoming) => {
    const byId = new Map(get().notes.map((n) => [n.id, n]))
    let added = 0
    let updated = 0
    for (const note of incoming) {
      if (byId.has(note.id)) updated++
      else added++
      byId.set(note.id, { ...note, videoId })
    }
    set({ notes: Array.from(byId.values()) })
    scheduleSave(get)
    return { added, updated }
  },

  notesForVideo: (videoId) =>
    get()
      .notes.filter((n) => n.videoId === videoId)
      .sort((a, b) => a.time - b.time),

  currentVideo: () => {
    const id = get().currentVideoId
    return id ? get().videos.find((v) => v.id === id) || null : null
  }
}))
