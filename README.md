<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LectureLane

Local YouTube playlist progress tracker for focused self‑study. Add subjects (YouTube playlists), track progress, and pick up right where you left off.

<p>
  <a href="https://img.shields.io/badge/Node.js-%E2%89%A514-brightgreen"><img alt="Node 14+" src="https://img.shields.io/badge/Node.js-%E2%89%A514-brightgreen"></a>
  <a href="#license"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <img alt="Status" src="https://img.shields.io/badge/status-Active%20MVP-purple">
  <img alt="Last Updated" src="https://img.shields.io/badge/Last%20Updated-October%202025-informational">
</p>

## Table of Contents

- About
- Features (current)
- Product timeline (MVP → v0.2)
- Quick start
- Architecture
- Calculator
- API
- Configuration
- Troubleshooting
- Security & Privacy
- Roadmap
- License

## About

LectureLane helps you learn better from YouTube playlists: organize subjects, see total and watched time, and resume videos without losing context. It runs entirely on your machine—no external databases.

## Features (current)

- 📚 Multiple subjects (playlists)
- ▶️ Video progress with periodic sync and resume
- 📊 Dashboard stats (subjects, videos, completed, durations)
- 🎯 Continue Watching and ⏭️ Play Next suggestions
- 🎨 Dark/Light theme with persistence
- 💾 100% local storage (browser localStorage)
- ⚡ Backend caching + request rate limiting
- 🔍 Debounced search, 🖼️ lazy-loaded thumbnails
- ⌨️ Player shortcuts (Space, ←/→)
- 🧮 Built‑in floating calculator in the player (basic + scientific)

## Product timeline (MVP → v0.2)

### September 2025 — MVP v0.1

Initial scope focused on a useable study companion:

- Add subject by YouTube playlist URL (backend fetch via `yt-dlp`)
- List videos with titles and durations; open player and track last watch position
- Persist everything locally in browser (no DB)
- Minimal dashboard with subject/video counts
- Settings: Reset application and manage subjects
- Productivity: Continue Watching and Play Next sections
- Serve frontend via Express at `/app`

### October 2025 — v0.2 (current)

User experience, performance, and reliability improvements:

- UX: Dark/Light theme; cleaned up card/button interactions; consistent styling
- Player: Keyboard shortcuts; hidden pause overlay; progress sync every 5s
- Study aide: Built‑in floating calculator in the player (basic ops + scientific: +, −, ×, ÷, ^, %, √, sin, cos, tan, ln, log10, π, e, n!, 1/x, 10^x, abs) with convenient keyboard input
- Performance: 10‑minute in‑memory cache, debounced search, lazy thumbnails
- Reliability & Safety: Rate limiting (30 req/min/IP), input sanitization, URL validation
- Fixes: Correct watched duration on “Completed”, light theme fixes (incl. Settings), status buttons themed

Performance highlights:
- ~80% fewer external fetches due to caching
- ~70% fewer re-renders while typing (debounce)
- Faster initial page load with lazy loading

## Quick start

Prerequisites
- Node.js 14+
- yt-dlp installed and available on PATH (https://github.com/yt-dlp/yt-dlp)

Windows (PowerShell)

```powershell
npm install
npm start
# then open
start http://localhost:3001/app
```

macOS/Linux (bash)

```bash
npm install
npm start
# then open
open http://localhost:3001/app || xdg-open http://localhost:3001/app
```

Verify yt-dlp is detected

```
GET http://localhost:3001/api/yt-dlp-version
```

Note: React and ReactDOM are loaded via CDN (esm.sh) in `public/index.html`. No build step is required.

## Architecture

Backend (server.js)
- Express server on port 3001
- Calls `yt-dlp` via `execFile` (no shell) for playlist/video data
- IP‑based rate limiting and in‑memory caching (TTL ~10 minutes)
- Serves static frontend at `/app`

Frontend (public/)
- `index.html` + `index.css` + `index.js`
- React 18 via ESM import map from CDN (no bundler)
- State stored in localStorage with BroadcastChannel sync
- YouTube IFrame API with 5s progress polling

## Calculator

A built‑in, floating calculator is available inside the video player page to support quick calculations during study sessions. It’s designed to be simple for Class 11/12 and useful for engineering students.

Highlights
- Toggle from the top‑right mini button in the player window
- Basic operations: +, −, ×, ÷, %, ^, decimal point
- Scientific/unary functions: √, sin, cos, tan, ln, log10, π, e, n!, 1/x, 10^x, abs
- Keyboard support (when calculator is open):
  - Numbers 0–9, “.”
  - +, −, *, /, x, X, ^
  - = or Enter to evaluate; C to clear; Backspace to delete; Esc to close
  - s → sin, o → cos, t → tan, r → √ (sqrt), % → percent

Data model (localStorage keys)

```javascript
{
  lectureLaneSubjects: [
    {
      id: "subject-slug",
      name: "Subject Name",
      playlistId: "PLxxx",
      playlistTitle: "Playlist Title",
      videos: [
        {
          id: "video-id",
          title: "Video Title",
          duration: "45:30",
          durationSeconds: 2730,
          status: "Completed" | "In Progress" | undefined,
          timeSpent: 2730,
          watchTime: 2730
        }
      ]
    }
  ],
  lectureLaneTheme: "dark" | "light"
}
```

## API

- POST `/api/fetchPlaylist` — Fetch and cache playlist metadata
- GET `/api/playlist?url=...` — Same as above via query string
- GET `/api/video/:id` — Video details (duration, title, thumbnails)
- GET `/api/yt-dlp-version` — Check `yt-dlp` availability
- GET `/app` — Serve the app

## Configuration

- Rate limit: `RATE_LIMIT_MAX_REQUESTS` (default 30), `RATE_LIMIT_WINDOW` (1 min)
- Cache TTL: `CACHE_TTL` (~10 minutes)
- Port: 3001 (change in `server.js` if needed)
- Theme: CSS custom properties at the top of `public/index.css`

## Troubleshooting

- yt-dlp not found: install and add to PATH; verify with `/api/yt-dlp-version`
- Port 3001 in use: change port in `server.js`
- Playlist fetch fails: ensure a valid YouTube playlist URL (must include `list` param)
- CDN blocked/offline: React from esm.sh requires internet; alternatively self‑host
- Theme not persisting: ensure browser localStorage is enabled

## Security & Privacy

- `execFile` (no shell) to avoid injection
- Input sanitization and URL validation on server
- IP‑based rate limiting to prevent abuse
- No external database — data remains in the browser’s localStorage

## Roadmap

- Import/export subjects and progress (JSON)
- Optional offline bundle for React (no CDN)
- Per‑subject notes search and tagging
- Basic analytics (session length, streaks)

## Browser compatibility

- Modern browsers (Chrome, Edge, Firefox, Safari)
- Requires ES6+, localStorage, BroadcastChannel, CSS variables

## License

MIT — see `package.json`.

---

Made with ❤️ for organized learning.  
Last Updated: October 2025
