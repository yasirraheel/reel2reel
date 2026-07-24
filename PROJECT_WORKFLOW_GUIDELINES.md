# Reel2Reel & Stock API Project Workflow Guidelines

This document provides a comprehensive overview of the system architecture, repository structure, branching strategy, deployment procedures, and coding guidelines for **Reel2Reel Video Editor** and **Stock Media Platform**. Any AI agent working on this codebase should strictly adhere to these guidelines.

---

## 1. System Overview & Architecture

### A. Reel2Reel Video Editor (`openreel-video`)
- **Local Path**: `D:\Git Work\Web\openreel-video`
- **Tech Stack**: React 18, Vite 5, TypeScript, TailwindCSS, WebAudio API, WebGL/WebGPU.
- **Monorepo Structure**:
  - `apps/web`: Frontend video editor interface.
  - `packages/core`: Video rendering, WebAudio graph processing (`AudioEngine`, `RealtimeAudioGraph`), timeline management, and media import service.
- **Git Repositories & Remotes**:
  - `origin`: `https://github.com/Augani/openreel-video.git` (DO NOT push to this remote; disconnected per user instructions).
  - `deploy`: `https://github.com/yasirraheel/reel2reel.git` (Primary active remote for main & production branches).

### B. Stock Media Platform (`stock_haqi_ali`)
- **Local Path**: `D:\Git Work\Web\stock_haqi_ali`
- **Tech Stack**: Laravel 10 PHP Framework, MySQL, REST API.
- **Git Repository**: `https://github.com/yasirraheel/stock_haqi_ali.git` (`main` branch).
- **Public API Base**: `https://stock.cineworm.org/api/public/`
  - Active endpoints: `/audios_list`, `/videos_list`, `/photos_list`, `/all_content`.
  - Authentication: `CUSTOM_API_KEY=com.cineworm.tv` (passed via query parameter `?api_key=com.cineworm.tv` or header `X-API-KEY`).

---

## 2. Server Infrastructure & Environment

- **Host Provider**: Hostinger
- **SSH Server Details**:
  - Server IP: `82.25.96.181`
  - SSH Port: `65002`
  - SSH User: `u273790872`
  - Master Script: `D:\Git Work\Web\hostinger_combine_servers.bat`
- **Domain Server Paths**:
  - **Reel2Reel Web App**: `~/domains/cineworm.org/public_html/reel2reel`
    - Live URL: `https://reel2reel.cineworm.org/`
  - **Stock Media API**: `~/domains/cineworm.org/public_html/stock`
    - Live URL: `https://stock.cineworm.org/`

---

## 3. Git Branching & Deployment Strategy

### A. Reel2Reel Deployment Workflow
The `openreel-video` project maintains two key branches on `https://github.com/yasirraheel/reel2reel.git`:

1. **`main` Branch**:
   - Contains all uncompiled source code (`apps/web/src`, `packages/core/src`, etc.).
   - Used for active feature development, bug fixes, and source history.

2. **`production` Branch**:
   - Contains the **compiled static distribution bundle** (`index.html` and assets in `assets/`).
   - Served directly by Hostinger Apache web server at `~/domains/cineworm.org/public_html/reel2reel`.

#### Step-by-Step PowerShell Command Sequence for Reel2Reel Deployment:
Run the following commands inside `D:\Git Work\Web\openreel-video`:

```powershell
# 1. Build the local web application
pnpm --filter web build

# 2. Commit and push source changes to main branch
git add .
git commit -m "Feat: description of source changes"
git push deploy main

# 3. Deploy build output to production branch
$newIndex = Get-Content "apps\web\dist\index.html" -Raw
git checkout production -f
$newIndex | Set-Content "index.html" -Encoding UTF8
Copy-Item -Path "apps\web\dist\assets\*" -Destination "assets\" -Recurse -Force
git add index.html assets/
git commit -m "Deploy: description of production build"
git push deploy production
git checkout main -f

# 4. Pull production branch on Hostinger Server 2 via SSH
ssh -p 65002 -o ConnectTimeout=20 u273790872@82.25.96.181 "cd ~/domains/cineworm.org/public_html/reel2reel && git pull origin production"
```

---

### B. Stock Media Platform Deployment Workflow
Run the following commands inside `D:\Git Work\Web\stock_haqi_ali`:

```powershell
# 1. Commit and push Laravel API changes to main branch
git add .
git commit -m "Feat: API enhancements or route updates"
git push origin main

# 2. Pull latest code on Hostinger Server 2 via SSH
ssh -p 65002 -o ConnectTimeout=20 u273790872@82.25.96.181 "cd ~/domains/cineworm.org/public_html/stock && git pull origin main"
```

---

## 4. Key Feature Implementation Standards

### A. In-Memory Direct Media Import Pattern
- When importing assets from the Stock API (`StockAudiosTab.tsx`), audio files must **NEVER** trigger browser disk download prompts or write to the user's Downloads folder.
- **Pattern**:
  1. Fetch file as Blob via `fetch(item.audio_url)`.
  2. Create an in-memory `File` instance: `new File([blob], fileName, { type: mimeType })`.
  3. Call `await importMedia(file)` in `useProjectStore`.
  4. `importMedia` saves the Blob into IndexedDB (`saveMediaBlob`) and adds the item to `project.mediaLibrary.items`.

### B. WebAudio & Timeline Audio Playback Architecture
- **Audio Context Management**: Browsers require a user interaction gesture to un-suspend `AudioContext`.
- **Pre-Decoding Sync**: `PlaybackController.play()` pre-loads and decodes all timeline audio buffers before advancing the master clock.
- **IndexedDB Blob Resolution**: `PlaybackController` uses `setBlobLoader(loadMediaBlob)` to load missing Blobs from IndexedDB when projects are restored.
- **Live Decode Auto-Refresh**: If an audio buffer finishes decoding while playback is active, `decodeAudioBuffer` calls `this.realtimeAudioGraph.seekTo(currentTime)` to immediately schedule the audio.
- **CapCut Bar Spectrum & Interactive Volume Line**:
  - Audio clips render dense vertical amplitude bars (`generateCapcutSpectrumBars`) in CapCut cyan (`#38bdf8`) with red/orange peak caps (`#ef4444`) for high volume peaks on a dark slate background (`#0c213d`).
  - Across the audio clip, a crisp white horizontal volume level line is rendered at a vertical position corresponding to `clip.volume` (where `100%` volume sits at center).
  - Users can click and drag UP/DOWN on the volume line to adjust `clip.volume` in real time with a live floating tooltip display (`Volume: 100% (0.0 dB)`).
  - Left and Right circular handle dots on the volume line allow interactive dragging to adjust `clip.fade.fadeIn` and `clip.fade.fadeOut`.

### C. UI Space Optimization Standards
- Keep header controls ultra-compact (single row, 32px height) in the left panel (`AssetsPanel.tsx` & `StockAudiosTab.tsx`).
- Combine sub-tabs (`[ Project Media | Stock Audios ]`), search inputs, view mode icons, and genre selectors into single-line flex headers to maximize the vertical viewport height for media content.

---

## 5. Quick Verification & Testing Checklist

Before pushing any changes:
1. Run local build test: `pnpm --filter web build` (Ensure 0 TypeScript or bundling errors).
2. Verify live API response: `curl.exe -s "https://stock.cineworm.org/api/public/audios_list?api_key=com.cineworm.tv"`.
3. Verify SSH server pull: Ensure `git pull origin production` completes cleanly on Hostinger Server 2.
