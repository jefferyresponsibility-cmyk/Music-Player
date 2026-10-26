# Jeff's Music Player

A local-first music player for the browser. No build step, no dependencies, no uploads.

## Run it

Double-click `index.html`, or serve the folder with any static server:

```powershell
# Option A — just open it
start index.html

# Option B — local server
python -m http.server 8000
# then open http://localhost:8000
```

Your browser must support HTML5 audio (Chrome, Edge, Firefox, Safari).

## Install it as an app

Jeff's is a PWA. The player still works as a plain page, but install and offline
support need a secure origin — `localhost` or HTTPS. Service workers cannot run
from a `file://` URL.

1. Serve the folder over localhost (for example `python -m http.server 8000`).
2. Open `http://localhost:8000`.
3. Use the install button in the browser's address bar (or **Install app** in
   the browser menu). On iOS, use **Share → Add to Home Screen**.
4. Once installed, launch it from your desktop or home screen. The app shell is
   cached, so it opens offline; your songs are still loaded from disk each time.

When you change any of the cached files, bump `CACHE_NAME` in `sw.js` (for
example `jeff-shell-v2`) so installed copies pick up the update.

The single-file `aurora-player.html` build has no manifest or service worker, so
use the full project folder when you want to install Jeff's as an app.

## Download / share

Two ready-to-share builds are included:

- **`aurora-player.html`** — the entire player in one self-contained file. Download it and double-click to play; no other files needed.
- **`aurora-player.zip`** — the full project (source files, README, and the single-file build) for sharing or submission.

## Use it

- **Add music** with the button, or drag and drop audio files anywhere on the page.
- Click a track to play it; click the active track to pause/resume.
- Filenames like `Artist - Song Title.mp3` are split into artist and title automatically.
- Remove a track with the **×** that appears on hover.
- Search filters your library as you type.
- Open **Appearance** from the palette button in the top-right to switch themes and light/dark mode.

## Themes

Pick any of the five palettes, then choose **Dark** or **Light**:

- **Aurora** — violet and cyan
- **Sunset** — orange and pink
- **Ocean** — blue and teal
- **Forest** — green and lime
- **Rose** — pink and purple

Your theme and mode are remembered the next time you open the player.

## Features

- Playlist with metadata, durations, search, and per-track removal
- Play/pause, previous/next, seek, volume, mute
- Shuffle and three repeat modes (off / all / one)
- Circular audio visualizer synced to the music (Web Audio API)
- Animated vinyl artwork with a color derived from each song
- Five color themes plus independent dark and light modes
- Drag-and-drop importing
- Keyboard shortcuts and OS media-key support
- Responsive layout for desktop, tablet, and phone
- Installable PWA with an offline app shell
- Remembers volume, mute, shuffle, repeat, theme, and mode between visits

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Seek back / forward 5 s |
| `↑` / `↓` | Volume up / down |
| `M` | Mute / unmute |
| `S` | Toggle shuffle |
| `R` | Cycle repeat mode |
| `N` / `P` | Next / previous track |

Shortcuts are ignored while typing in a field or when a button has focus.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, metadata, and icon sprite |
| `styles.css` | Theme tokens, palettes, light/dark modes, layout, artwork, and responsive rules |
| `app.js` | Playlist logic, playback, persistence, visualizer, and service-worker registration |
| `manifest.webmanifest` | PWA name, colors, display mode, and icons |
| `sw.js` | Offline app-shell cache and navigation fallback |
| `icons/` | App icons, including the maskable and Apple touch variants |

## Notes

- Songs are loaded straight from disk and played locally — nothing is uploaded.
- For browser security reasons the library is not stored between page reloads; re-add your files after a refresh. Settings (volume, shuffle, repeat, theme, mode) are remembered.
- Format support depends on the browser. MP3, WAV, OGG, M4A, and FLAC cover most cases.
