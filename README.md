<div align="center">

# 🎬 Video Notes

**A local, offline desktop app for reviewing edited videos and leaving timestamped, drawn-on notes.**

Drop in a video, pause anywhere, draw on the frame or mark a stretch of audio, and write a note pinned to that exact moment — then hand the notes to an editor or a collaborator as plain text. Everything stays on your machine.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Built with](https://img.shields.io/badge/built%20with-Electron%20%2B%20React%20%2B%20TypeScript-8a63ff)

</div>

<!--
  📸 Add a screenshot to make this page shine:
  drop an image at docs/screenshot.png and uncomment the line below.
  ![Video Notes](docs/screenshot.png)
-->

---

## Why

If you make videos, you spend a lot of time watching a cut and jotting "fix the audio here," "this title lingers too long," "typo at 4:32." Premiere and Frame.io have review tools for exactly this, but they want you online or in the cloud. **Video Notes does it locally** — no account, no upload, no subscription — and the same app runs on macOS and Windows so you can send it to a collaborator.

## Features

- 🎞️ **Clean, high-quality player** — scrub, frame-step (`,` / `.`), playback speed, volume, fullscreen, resume where you left off.
- ✏️ **Draw on the frame** — pause and drag to add a box, arrow, ellipse, or freehand pen stroke in any color, then write a note. It's saved to that timestamp.
- 🔊 **Audio notes** — a compact waveform strip sits under the video; drag across a span to leave a note about the audio over that range.
- 🔍 **Zoomable timeline** — scroll over the waveform or scrubber to zoom in for frame-precise placement; shift-scroll to pan; it auto-follows during playback.
- 🗂️ **Notes sidebar** — every note shows a thumbnail, timecode, and author, with clickable markers on the timeline. Click to jump back and see the annotation. Collapse the panel when you want a bigger picture.
- 👤 **Attribution** — set your name once; every note you make is tagged with it, so collaborators know who wrote what.
- 📤 **Share as plain text** — copy to clipboard or export Markdown/Text. The file reads cleanly *and* has all the data (drawings, audio ranges, authors) embedded, so the other person imports it onto their own copy of the video and sees everything exactly as you left it.
- 💾 **100% local** — your library and notes live in a single JSON file on your computer. Nothing is uploaded anywhere.

## Supported video formats

Standard **H.264 video + AAC audio** in `.mp4` or `.mov` — the normal export from Premiere, Final Cut, DaVinci Resolve, and what YouTube uses — plays great on both macOS and Windows. `.webm` and `.m4v` work too. HEVC/H.265, ProRes, and some `.mkv`/`.avi` files may not play in the app's video engine; if a file won't play, re-export it as H.264 MP4. (Waveforms are generated for any file with an audio track, regardless of size, via bundled ffmpeg.)

---

## Download & install

### Option A — grab a prebuilt installer (easiest)

1. Go to the **[Releases](../../releases)** page.
2. Download the installer for your OS:
   - **macOS:** `Video Notes-<version>-arm64.dmg` → open it and drag **Video Notes** to Applications.
   - **Windows:** `Video Notes-Setup-<version>.exe` → run it and follow the installer.

> **First-launch security prompts (because the app is unsigned):**
> - **macOS:** right-click the app → **Open** → **Open** (only needed once). If it's still blocked, run `xattr -cr "/Applications/Video Notes.app"` in Terminal.
> - **Windows:** SmartScreen may warn — click **More info** → **Run anyway**.

If a release for your platform isn't there yet, see [Building from source](#building-from-source) — it's one command.

### Option B — build it yourself

See [Building from source](#building-from-source).

---

## Using it

1. **Add a video** — drag it onto the window, or click **Open video…**.
2. **Watch** — `Space` to play/pause, arrows to seek, `,` / `.` to step frame-by-frame.
3. **Add a note:**
   - **On the frame** — pause, pick a tool/color, and **drag on the video** to draw. A note box appears; type and save.
   - **On the audio** — **drag across the waveform** strip to mark a time range, then write your note.
   - **Anywhere** — press `N` to drop a note at the current time without drawing.
4. **Review** — notes appear in the sidebar and as markers on the timeline. Click any note to jump back to that moment and see its annotation.
5. **Set your name** — click the 👤 button (top bar or library) so your notes are attributed to you.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek 5s (hold `Shift` for 1s) |
| `J` / `L` | Jump 10s back / forward |
| `,` / `.` | Step one frame |
| `N` / `M` | Add a note at the current time |
| `F` | Fullscreen |
| `Esc` | Cancel the note you're writing / close |
| `⌘`/`Ctrl` + `Enter` | Save the note while composing |

Mouse: **drag the frame** to draw · **drag the waveform** for an audio note · **scroll** the waveform/scrubber to zoom · **shift-scroll** to pan.

---

## Sharing notes with a collaborator

No server, no cloud. Each person keeps their own copy of the video file (share it however you like — AirDrop, Blip, a drive); only the notes travel, as plain text:

1. **You:** notes menu (top-right of the Notes panel) → **Copy all to clipboard**, or **Export as Markdown / Text**. The text reads cleanly (timecodes + comments) and carries all the structured data in a hidden block at the end.
2. Send the text or file however you like.
3. **Them:** open *their* copy of the same video → notes menu → **Paste from clipboard** or **Import from file…**

Notes attach to the video they currently have open, with all drawings, audio ranges, and authors intact. Importing is additive and de-duplicated, so you can pass notes back and forth as you each add to them.

---

## Building from source

**Requirements:** [Node.js](https://nodejs.org) 18+ and npm.

```bash
git clone <your-repo-url>
cd video-notes
npm install        # also downloads the bundled ffmpeg for your OS

npm run dev        # run the app in development
```

Build a distributable installer for your current OS:

```bash
npm run build:mac     # → dist/Video Notes-<version>-arm64.dmg   (run on a Mac)
npm run build:win     # → dist/Video Notes-Setup-<version>.exe    (run on Windows)
```

> Build each platform **on that platform** (or use the GitHub Action below). `ffmpeg-static` downloads the binary for the machine you install on, so a Windows installer must be built on Windows to bundle Windows ffmpeg.

### Automated cross-platform releases

This repo includes a GitHub Actions workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml)) that builds **both** the macOS and Windows installers on the right runners and attaches them to a GitHub Release. To cut a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The installers appear on the **Releases** page a few minutes later. (You can also trigger it manually from the **Actions** tab via "Run workflow.")

---

## Where your data lives

A single JSON file (your library + every note, including small frame thumbnails):

- **macOS:** `~/Library/Application Support/video-notes/video-notes-db.json`
- **Windows:** `%APPDATA%/video-notes/video-notes-db.json`

Back it up by copying that file. Deleting it resets the app.

## Tech & project layout

Electron (bundled Chromium → consistent codecs and identical behavior on macOS/Windows) + React + TypeScript, built with [electron-vite](https://electron-vite.org) and packaged with [electron-builder](https://www.electron.build). Waveforms come from a bundled [ffmpeg](https://ffmpeg.org) binary.

```
src/
  main/        Electron main — window, local-file streaming protocol (with range
               support for smooth scrubbing), ffmpeg waveform, JSON store
  preload/     The secure bridge exposed to the UI as window.api
  renderer/    React app
    components/  Library · Player · Controls · Waveform · AnnotationLayer
                 NoteComposer · NotesPanel · AuthorModal · Icons
    lib/         drawing · frame capture · poster · timecode format · share/export
    store.ts     app state (Zustand) + local persistence
```

## License

[MIT](LICENSE) © 2026 Ashton Miller
