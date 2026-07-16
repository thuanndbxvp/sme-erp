# V-CLONE: Video Reverse-Engineering & Recreation Studio

**Plan tổng hợp — Version 1.0**
**Ngày tạo**: 14/07/2026
**Trạng thái**: Chốt scope, sẵn sàng triển khai
**Loại dự án**: Personal desktop tool (Electron + Python hybrid)

---

## 1. Product Vision

Một phần mềm **"Kỹ thuật đảo ngược & Tái tạo Video" (Reverse-Engineering & Recreation Video Studio)**. Người dùng chỉ cần "nhét" 1 video quảng cáo/viral TikTok đang thịnh hành vào, phần mềm sẽ tự động "nội soi", mổ xẻ từng khung hình, âm thanh, sau đó **"tái sinh"** ra một (hoặc nhiều) video mới mang phong cách tương tự nhưng sáng tạo hơn, tự động hóa từ khâu lên kịch bản đến khi render ra file MP4 hoàn chỉnh.

**Khác biệt cốt lõi**: Không chỉ gọi API tạo video — điểm "ăn tiền" nhất là:

1. **Phase 1 (Nội soi)** — phân tích video tham chiếu chi tiết đến từng shot
2. **Phase 3 (Storyboard Timeline)** — UI review trước khi render, tiết kiệm 5-10x chi phí API

---

## 2. Chốt quyết định (đã confirm với user)

| Decision | Value |
|---|---|
| Platform | **Desktop app (Electron)** |
| Scope | **Full 5 phases** |
| Backend | **Python + Node hybrid** |
| Image provider | **Imagen 3** (Google AI Studio) |
| Video provider | **Google Veo 3** |
| Analyze engine | **Gemini 2.5 Pro** |
| Scripter | **Claude Sonnet 4** |
| TTS | **ElevenLabs** |
| Music | **Suno** |
| Voice cloning | User upload audio của chính họ HOẶC thiết kế giọng mới từ mô tả |
| Target user | Personal use |
| Output | MP4 + SRT + project JSON |
| Timeline MVP | Lite MVP 2-3 tuần (Phase 1+2+3) → iterate thêm Phase 4+5 |

---

## 3. Tech Stack chốt

### Desktop Shell (Node.js + Electron)

- **Electron 32+** — multi-OS desktop framework
- **React 18+** + **TypeScript 5.6+** — UI layer
- **Vite 5+** — build tool, HMR
- **TailwindCSS** + **Shadcn UI** + **Framer Motion**
- **Zustand** — state management
- **@dnd-kit** — drag & drop cho Timeline editor

### Backend (Python 3.11+)

- **FastAPI** — async REST API framework
- **SQLite** — local DB
- **ffmpeg-python** — video processing wrapper
- **opencv-python** — frame extraction, color analysis
- **Whisper (medium)** — speech-to-text
- **Demucs (htdemucs)** — audio source separation
- **librosa** — BPM, key detection
- **Pydantic** — schema validation
- **asyncio** — parallel job execution

### AI Services

| Service | Purpose | Model |
|---|---|---|
| Google Gemini 2.5 Pro | Video understanding + analysis | gemini-2.5-pro |
| Google Imagen 3 | Image generation | imagen-3.0-generate-002 |
| Google Veo 3 | Video generation | veo-3.0-generate-001 |
| Anthropic Claude Sonnet 4 | Script generation, prompt optimization | claude-sonnet-4-20250514 |
| ElevenLabs | TTS + voice cloning (user's own voice) | eleven_multilingual_v2 |
| Suno | Music generation | Suno public API hoặc Udio fallback |

### Tools (system binaries)

- **yt-dlp** — download video từ URL
- **ffmpeg** — system binary, composite final video
- **node-fluent-ffmpeg** — Node.js wrapper cho ffmpeg

---

## 4. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                     DESKTOP SHELL (Electron)                     │
│  Renderer: React + TS + Vite + Tailwind + Shadcn UI             │
│  - Video Input UI                                               │
│  - Analysis Dashboard                                           │
│  - Script Editor                                                │
│  - Storyboard Grid                                              │
│  - Timeline Editor (drag-drop)                                  │
│  - Asset Gallery                                                │
│  - Render Queue                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │ IPC (typed contracts)
┌─────────────────────────────┴───────────────────────────────────┐
│              NODE.JS MAIN PROCESS (Electron main)               │
│  - Lifecycle management                                         │
│  - File system access (sandboxed)                               │
│  - yt-dlp child_process wrapper                                 │
│  - ffmpeg wrapper                                               │
│  - SQLite for project metadata                                  │
│  - HTTP client → Python backend (localhost:5678)                │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP REST + WebSocket for progress
┌─────────────────────────────┴───────────────────────────────────┐
│                PYTHON BACKEND (FastAPI on :5678)                 │
│  - AI orchestration (Gemini, Claude, Veo, ElevenLabs, Suno)     │
│  - Video processing (OpenCV, ffmpeg-python)                     │
│  - Audio analysis (Whisper, Demucs, librosa)                    │
│  - Pipeline state machine                                       │
│  - In-process async job queue (asyncio.Semaphore concurrency)   │
│  - Pydantic schema validation                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS API calls
┌─────────────────────────────┴───────────────────────────────────┐
│                       EXTERNAL SERVICES                          │
│  Google: Gemini 2.5 Pro + Imagen 3 + Veo 3                      │
│  Anthropic: Claude Sonnet 4                                     │
│  ElevenLabs: TTS + voice cloning                                │
│  Suno: Music generation                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Storage Layout** (local filesystem):
```
data/
├── v-clone.db                   # SQLite (Node) - metadata, settings
├── v-clone-py.db                # SQLite (Python) - analysis cache
└── projects/<uuid>/
    ├── source.mp4               # Original video
    ├── audio.wav                # Extracted audio
    ├── vocals.wav               # Demucs vocals
    ├── instrumentals.wav        # Demucs background
    ├── frames/                  # Extracted key frames (jpg)
    ├── analysis.json            # Phase 1 output (cached)
    ├── script.json              # Phase 2 output
    ├── storyboard.json          # Phase 3 output
    ├── assets/
    │   ├── characters/
    │   ├── scenes/
    │   ├── videos/              # Veo 3 output
    │   ├── tts/                 # ElevenLabs output
    │   └── music/               # Suno output
    ├── subtitles.srt
    └── final.mp4                # Phase 5 output
```

---

## 5. Cấu trúc thư mục

```
v-clone/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── requirements.txt
├── pyproject.toml
├── .env.example
├── .gitignore
├── README.md
├── LICENSE                             # MIT
│
├── electron/                          # Electron main process (Node.js + TS)
│   ├── main.ts                        # Entry point
│   ├── preload.ts                     # IPC bridge (contextIsolation)
│   ├── tsconfig.json
│   └── modules/
│       ├── ipc/
│       │   ├── project.ts             # project:create, project:list, ...
│       │   ├── ingest.ts              # ingest:url, ingest:file
│       │   ├── analyze.ts             # analyze:start, analyze:status
│       │   ├── script.ts              # script:generate, script:update
│       │   ├── storyboard.ts          # storyboard:generate, storyboard:regenerate
│       │   ├── generate.ts            # generate:start, generate:status
│       │   ├── composite.ts           # composite:render
│       │   └── files.ts               # file:read, file:write, project:export
│       ├── services/
│       │   ├── python-bridge.ts       # HTTP client to Python backend
│       │   ├── ingest-service.ts      # yt-dlp + ffmpeg orchestration
│       │   ├── store.ts               # electron-store for settings
│       │   └── db.ts                  # SQLite (better-sqlite3)
│       └── utils/
│           ├── logger.ts
│           └── errors.ts
│
├── renderer/                          # React UI (TS + Vite)
│   ├── index.html
│   ├── package.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── router.tsx                 # React Router v6
│   │   ├── components/
│   │   │   ├── layout/                # Sidebar, TopBar, StatusBar
│   │   │   ├── video-input/           # UrlInput, FileDrop, VideoPreview
│   │   │   ├── analysis/              # Dashboard, ShotBreakdown, ColorPalette, CharacterList
│   │   │   ├── script/                # ScriptEditor, ScriptVariantPicker, BriefInput
│   │   │   ├── storyboard/            # StoryboardGrid, ShotCard, ShotRegenerateModal, PromptInspector
│   │   │   ├── timeline/              # TimelineEditor, Track, Clip, TimeRuler, TimelineToolbar
│   │   │   ├── generate/              # ProviderSelector, JobQueue, JobCard, ProgressBar
│   │   │   ├── composite/             # CompositeControls, SubtitleStyle, ExportPanel
│   │   │   └── common/                # Button, Modal, Toast, Skeleton
│   │   ├── hooks/
│   │   │   ├── useProject.ts
│   │   │   ├── useAnalysis.ts
│   │   │   ├── useScript.ts
│   │   │   ├── useStoryboard.ts
│   │   │   ├── useGeneration.ts
│   │   │   └── useWebSocket.ts
│   │   ├── stores/                    # Zustand stores
│   │   │   ├── projectStore.ts
│   │   │   ├── settingsStore.ts
│   │   │   └── uiStore.ts
│   │   ├── api/
│   │   │   └── client.ts              # Wraps IPC bridge
│   │   ├── types/
│   │   │   └── index.ts               # Mirrors shared types
│   │   └── styles/
│   │       └── globals.css
│
├── backend/                           # Python FastAPI backend
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── alembic.ini                    # DB migrations (optional)
│   ├── main.py                        # FastAPI entry
│   ├── api/
│   │   ├── __init__.py
│   │   ├── projects.py                # /api/projects
│   │   ├── analyze.py                 # /api/analyze
│   │   ├── script.py                  # /api/script
│   │   ├── storyboard.py              # /api/storyboard
│   │   ├── generate.py                # /api/generate
│   │   └── composite.py               # /api/composite
│   ├── services/
│   │   ├── __init__.py
│   │   ├── gemini_client.py           # Vision + Imagen 3
│   │   ├── claude_client.py           # Claude Sonnet 4
│   │   ├── veo_client.py              # Veo 3
│   │   ├── elevenlabs_client.py       # TTS + voice cloning
│   │   ├── suno_client.py             # Music
│   │   ├── ffmpeg_service.py          # Video processing
│   │   ├── audio_analyzer.py          # Whisper + Demucs + librosa
│   │   ├── frame_extractor.py         # Key frame extraction
│   │   ├── color_analyzer.py          # Color palette extraction
│   │   ├── prompt_optimizer.py        # Per-provider prompt
│   │   ├── pipeline.py                # Orchestrator
│   │   └── compositor.py              # Final assembly
│   ├── models/                        # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── analysis.py
│   │   ├── script.py
│   │   ├── storyboard.py
│   │   └── job.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── sqlite.py
│   │   ├── migrations.py
│   │   └── repositories.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── logger.py
│   │   ├── retry.py
│   │   └── cache.py
│   └── tests/
│       ├── test_audio_analyzer.py
│       ├── test_gemini_client.py
│       └── test_pipeline.py
│
├── shared/                            # Shared TS types + Python schemas
│   ├── types.ts
│   └── schemas.py                     # Pydantic (re-exported)
│
├── scripts/
│   ├── dev.sh                         # Start Node + Python concurrently
│   ├── dev.bat                        # Windows version
│   ├── install.sh                     # Setup script
│   ├── seed.py                        # Test data
│   └── cleanup.py                     # Clean cache
│
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    ├── PROVIDERS.md
    └── TROUBLESHOOTING.md
```

---

## 6. Core Workflow Pipeline (5 Phases)

### Phase 1: Phân tích & Nội soi Video (Tuần 1-2)

**Input**: URL (YouTube, TikTok) hoặc file MP4 upload trực tiếp.

**Xử lý song song 3 luồng**:
- **Vision**: OpenCV + Gemini 2.5 Pro
- **Audio**: Whisper + Demucs + librosa
- **Color**: OpenCV + KMeans

**Output** (`analysis.json`):
```json
{
  "summary": "Nike Air Max ad showing athlete running through urban city at sunset",
  "genre": "commercial-sportswear",
  "mood": "energetic, aspirational",
  "targetAudience": "young adults 18-35",
  "durationSec": 30,
  "visual": {
    "colorPalette": [
      {"name": "Sunset Orange", "hex": "#FF6B35", "percent": 0.32},
      {"name": "Deep Black", "hex": "#1A1A1A", "percent": 0.28}
    ],
    "cameraStyles": ["tracking-shot", "low-angle", "slow-motion"],
    "visualStyle": "cinematic commercial",
    "aspectRatio": "16:9"
  },
  "audio": {
    "bpm": 128,
    "musicalKey": "C minor",
    "transcription": "Just do it. Feel the speed. Own the moment."
  },
  "characters": [
    {"name": "Hero Athlete", "role": "protagonist", "description": "..."}
  ],
  "scenes": [...],
  "shots": [
    {"idx": 0, "startSec": 0, "endSec": 3, "type": "wide", "content": "..."}
  ],
  "narrativeArc": {
    "setup": "...", "development": "...", "climax": "...", "resolution": "..."
  },
  "keyTakeaways": [
    "Strong hook: action in first 3 seconds",
    "Brand integration via product close-ups"
  ]
}
```

### Phase 2: Sáng tạo Kịch bản & Biến thể (Tuần 2-3)

**Input**: `analysis.json` + user brief
**Engine**: Claude Sonnet 4
**3 modes**: `similar` / `creative` / `inspired`
**Output** (`script.json`):
```json
{
  "title": "30-Second Sneaker Drop",
  "logline": "Young hustler sprints through Saigon streets to catch the limited drop",
  "durationTargetSec": 30,
  "characters": [{
    "name": "Minh",
    "visualDescription": "Vietnamese male, 22, short black hair, slim build, wearing vintage white tee and the new sneaker",
    "referenceImagePrompt": "Vietnamese young man 22..."
  }],
  "scenes": [{
    "idx": 0,
    "location": "Saigon backpacker street, golden hour",
    "shots": [{
      "idx": 0,
      "type": "wide",
      "cameraMovement": "slow dolly-in",
      "action": "Minh running toward camera, sunset behind him",
      "voiceover": "Mỗi bước chân, một câu chuyện.",
      "durationSec": 3,
      "imagePrompt": "...",
      "videoPrompt": "..."
    }]
  }],
  "musicDirection": {
    "mood": "energetic, hopeful, urban",
    "tempo": "128 BPM",
    "sunoPrompt": "Modern Vietnamese hip-hop trap beat, 128 BPM..."
  }
}
```

### Phase 3: Storyboard & Timeline Editor (Tuần 3-4)

**Components**:
- `StoryboardGrid`: Grid 3-4 cột, first-frame image cho mỗi shot
- `ShotCard`: Ảnh + prompt + Regenerate button + Approve
- `TimelineEditor`: Drag-drop (5 tracks: Video, Dialogue, VO, Music, SFX)
- `PromptInspector`: Hiển thị prompt đã tối ưu, cho phép chỉnh tay

**Output** (`storyboard.json`):
```json
{
  "projectId": "uuid",
  "scriptId": "uuid",
  "shots": [{
    "idx": 0,
    "imagePrompt": {"imagen": "...", "referenceImageUrl": null, "status": "pending"},
    "videoPrompt": {"veo": "..."},
    "ttsSegments": [{
      "type": "voiceover",
      "text": "Mỗi bước chân, một câu chuyện.",
      "voiceId": "user-cloned-voice-id",
      "emotion": "determined"
    }]
  }],
  "jobs": {"image": [...], "video": [...], "tts": [...], "music": [...]}
}
```

### Phase 4: Asset Generation (Tuần 4-6)

**Parallel execution** với asyncio.gather + Semaphore(5):
```python
async def generate_all_assets(project_id: str):
    # 1. Image generation (Imagen 3) - all shots + chars + props
    image_jobs = [...]  # 8 shots + 3 chars + 3 props
    images = await asyncio.gather(*image_jobs)

    # 2. Video generation (Veo 3) - với first-frame image làm input
    video_jobs = [generate_veo(prompt, ref_image=images[shot.idx]) for shot in shots]
    videos = await asyncio.gather(*video_jobs, return_exceptions=True)

    # 3. TTS (ElevenLabs) - parallel
    tts_jobs = [generate_elevenlabs(seg) for seg in tts_segments]
    audio = await asyncio.gather(*tts_jobs)

    # 4. Music (Suno) - single
    music = await generate_suno(music_direction)
```

**Provider Adapters**:
- `gemini_client.py`: Gemini 2.5 Pro + Imagen 3
- `claude_client.py`: Claude Sonnet 4
- `veo_client.py`: Veo 3 (long-running ops + polling)
- `elevenlabs_client.py`: TTS + voice clone
- `suno_client.py`: Music gen

### Phase 5: Composite & Export (Tuần 6-8)

**Assembly pipeline** (`ffmpeg_service.py`):
```python
async def assemble(project_id: str) -> str:
    # 1. Concat video clips
    # 2. Mix audio (dialogue + VO + music with ducking)
    # 3. Generate subtitles (SRT from TTS word-level timestamps)
    # 4. Burn-in subtitles (TikTok/Hormozi style)
    # 5. Export final MP4
```

---

## 7. Database Schema (SQLite)

### Node.js side (`electron/modules/services/db.ts`)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT CHECK(source_type IN ('url', 'upload')),
  source_url TEXT,
  source_path TEXT,
  duration_sec REAL,
  status TEXT DEFAULT 'created',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE
);
```

### Python side (`backend/db/sqlite.py`)

```sql
CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  summary TEXT,
  genre TEXT,
  mood TEXT,
  duration_sec REAL,
  visual_json TEXT,        -- colorPalette, cameraStyles, etc.
  audio_json TEXT,         -- BPM, key, transcription, segments
  characters_json TEXT,
  scenes_json TEXT,
  shots_json TEXT,
  narrative_arc_json TEXT,
  key_takeaways_json TEXT,
  model_used TEXT,
  tokens_used INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  mode TEXT CHECK(mode IN ('similar', 'creative', 'inspired')),
  user_brief TEXT,
  title TEXT,
  logline TEXT,
  duration_target_sec INTEGER,
  characters_json TEXT,
  scenes_json TEXT,
  music_direction_json TEXT,
  props_json TEXT,
  model_used TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE storyboards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  script_id TEXT NOT NULL,
  shots_json TEXT,
  estimated_cost_json TEXT,
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  storyboard_id TEXT,
  type TEXT CHECK(type IN ('image', 'video', 'tts', 'music', 'composite')),
  provider TEXT,
  status TEXT CHECK(status IN ('pending', 'queued', 'running', 'done', 'failed')),
  input_json TEXT,
  output_path TEXT,
  cost_estimate REAL,
  started_at DATETIME,
  finished_at DATETIME,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  type TEXT,
  provider TEXT,
  path TEXT NOT NULL,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. IPC Contracts (Electron ↔ Renderer)

```typescript
// shared/types.ts
export interface IPCContract {
  // Project management
  'project:create': (input: { name: string; sourceType: 'url' | 'upload' }) => Promise<Project>;
  'project:list': () => Promise<Project[]>;
  'project:get': (projectId: string) => Promise<Project>;
  'project:delete': (projectId: string) => Promise<void>;
  'project:export': (projectId: string) => Promise<string>;

  // Video ingest
  'ingest:from-url': (projectId: string, url: string) => Promise<{ durationSec: number }>;
  'ingest:from-file': (projectId: string, filePath: string) => Promise<{ durationSec: number }>;
  'ingest:cancel': (projectId: string) => Promise<void>;

  // Phase 1: Analysis
  'analyze:start': (projectId: string) => Promise<{ jobId: string }>;
  'analyze:status': (projectId: string) => Promise<AnalysisProgress>;
  'analyze:get': (projectId: string) => Promise<VideoAnalysis>;

  // Phase 2: Script
  'script:generate': (projectId: string, options: { mode: ScriptMode; userBrief: string; userProduct: string }) => Promise<GeneratedScript>;
  'script:get': (projectId: string) => Promise<GeneratedScript>;
  'script:update': (projectId: string, script: GeneratedScript) => Promise<void>;

  // Phase 3: Storyboard
  'storyboard:generate': (projectId: string) => Promise<Storyboard>;
  'storyboard:get': (projectId: string) => Promise<Storyboard>;
  'storyboard:regenerate-shot': (projectId: string, shotIdx: number) => Promise<StoryboardShot>;

  // Phase 4: Asset Generation
  'generate:start': (projectId: string, options: { providers: ProviderSelection }) => Promise<{ batchId: string }>;
  'generate:status': (projectId: string) => Promise<GenerationProgress>;
  'generate:cancel': (projectId: string, jobId?: string) => Promise<void>;
  'generate:retry': (projectId: string, jobId: string) => Promise<void>;

  // Voice
  'voice:clone': (name: string, audioPath: string) => Promise<{ voiceId: string }>;
  'voice:design': (description: string) => Promise<{ voiceId: string; previewUrl: string }>;
  'voice:list': () => Promise<Voice[]>;
  'voice:preview': (voiceId: string, text: string) => Promise<string>;

  // Phase 5: Composite
  'composite:render': (projectId: string, options: CompositeOptions) => Promise<{ outputPath: string }>;
  'composite:progress': (projectId: string) => Promise<CompositeProgress>;

  // Settings
  'settings:get': (key: string) => Promise<string | null>;
  'settings:set': (key: string, value: string, encrypted?: boolean) => Promise<void>;

  // Progress events (main → renderer push)
  'event:progress': (event: ProgressEvent) => void;
  'event:log': (event: LogEvent) => void;
}
```

---

## 9. Implementation Timeline (Realistic)

| Giai đoạn | Tuần | Effort |
|---|---|---|
| Phase 1: Video Analysis | Tuần 1-2 | Low-Medium |
| Phase 2: Script Generation | Tuần 2-3 | Medium |
| Phase 3: Storyboard + Timeline Editor | Tuần 3-4 | Medium-High |
| Phase 4: Asset Generation | Tuần 4-6 | High |
| Phase 5: Composite & Export | Tuần 6-8 | Medium |
| **Total** | **8 tuần full-time** / **4-6 tháng part-time** | |

---

## 10. Cost Estimate per Video (30s)

| Bước | Provider | Cost (USD) |
|---|---|---|
| Video analyze (5min) | Gemini 2.5 Pro | ~$0.15-0.40 |
| Script generation | Claude Sonnet 4 | ~$0.15-0.30 |
| Image gen (14 images) | Imagen 3 | ~$0.30-0.70 |
| Video gen (8 shots × 5s) | Veo 3 | ~$5-8 |
| TTS (60s dialogue + 60s VO) | ElevenLabs | ~$0.50-1.00 |
| Music (30s) | Suno | ~$0.50-1.00 |
| Composite (compute) | Local | $0 |
| **TOTAL** | | **~$6.60-11.40 per video** |

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Analysis accuracy (vs human rating) | > 75% |
| Script coherence score | > 7/10 |
| Character consistency (same face across shots) | > 80% via reference image |
| Pipeline success rate | > 90% |
| Time per video (analyze → final) | < 30 min |
| App startup | < 5s |
| Cost per video | < $12 |
| Test coverage | > 70% |

---

## 12. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Veo 3 quota exhausted** | High | Fallback to Veo 2 + Imagen 3 animation |
| **ElevenLabs voice clone legal** | Medium | Chỉ clone voice của user; design voice mới từ description |
| **Python + Node version mismatch** | Medium | Pin versions trong requirements.txt + package.json |
| **Long video > 5min Gemini limit** | Medium | Slice + analyze chunks + merge |
| **Whisper slow on CPU** | Medium | Dùng Whisper.cpp hoặc faster-whisper |
| **Demucs GPU required** | Low | Fallback model hoặc skip separation |
| **ffmpeg composite phức tạp** | Medium | Unit test cho từng filter, edge cases |
| **2 tuần không đủ** | High | Cut scope: Phase 1+2+3 trước, Phase 4+5 sau |
| **User mất dữ liệu project** | High | Auto-save mỗi 30s, export/import ZIP |
| **API key bị lộ** | High | Lưu key qua electron-store encrypted, không log key |
| **Veo 3 reference image style mismatch** | Medium | Let user chọn character reference manually |

---

## 13. Out of Scope

❌ Multi-user / authentication
❌ Cloud sync / collaboration
❌ Custom model training / fine-tuning
❌ Mobile app version
❌ Web deployment (chỉ desktop)
❌ SaaS monetization (personal tool only)
❌ Custom voice clone từ video reference (legal risk)
❌ Real-time collaboration
❌ Auto-post lên social media
❌ A/B testing framework

---

## 14. Next Steps (sau khi plan chốt)

### Bước 1: Setup môi trường (1 ngày)
```bash
# Cài Python 3.11+, Node 20+, ffmpeg, yt-dlp
brew install python@3.11 node ffmpeg yt-dlp  # macOS
# hoặc
choco install python311 nodejs ffmpeg yt-dlp  # Windows

# Verify
python --version   # 3.11+
node --version     # 20+
ffmpeg -version
yt-dlp --version
```

### Bước 2: Tạo thư mục + initial commit (30 phút)
```bash
cd d:/sme-erp
mkdir v-clone
cd v-clone
git init
# Tạo cấu trúc thư mục như trên
# Initial commit: scaffold
```

### Bước 3: Setup API keys (15 phút)
- Google AI Studio: https://aistudio.google.com/apikey
- Anthropic Console: https://console.anthropic.com/
- ElevenLabs: https://elevenlabs.io/app/settings/api-keys

### Bước 4: Bắt đầu code Day 1
- Setup Electron + React skeleton
- Setup Python FastAPI
- Verify 2 processes communicate được

---

## 15. Đã chốt (Decisions Made)

1. **Repository location**: Đặt tại `D:\V-Clone` (tách biệt khỏi SME ERP).
2. **GitHub visibility**: **Private** (bảo vệ mã nguồn core logic).
3. **License**: Proprietary (không open source).
4. **Multi-language UI**: **EN + VN (i18n)** (tiếng Anh chuẩn form, tiếng Việt để thao tác nhanh).
5. **Cloud sync option**: Bỏ qua trong MVP. User tự quản lý file local.
6. **Project export format**: MP4 + Project JSON archive (hỗ trợ chia sẻ/chỉnh sửa sau).
7. **User upload custom font cho subtitle**: **Có support** (để tối ưu font chữ động cho quảng cáo Tiktok/Reels).

---

## 16. Kết luận

**Plan tổng thể**:
- ✅ **Khả thi về mặt kỹ thuật** — concept đúng trend thị trường
- ✅ **Tech stack proven** — Electron + Python + Google AI stack đã mature
- ✅ **Architecture đúng best practices** — IPC + async pipeline + caching
- ✅ **Risk đã được identify + mitigation** — Veo 3 fallback, voice clone legal safe
- ✅ **Scope đã được chốt rõ ràng** — 5 phases, MVP Lite 2-3 tuần
- ⚠️ **Timeline thực tế** — full 5 phases = 8 tuần full-time / 4-6 tháng part-time
- ⚠️ **Cost per video** — $6-12, cần approval flow trước render

**Top 3 khuyến nghị**:
1. Bắt đầu với **Lite MVP** (Phase 1+2+3) để validate idea
2. **Lite MVP dùng Imagen 3 + Gemini 2.5 Pro** trước (đã chốt)
3. **Sau khi MVP chạy tốt**, iterate thêm Phase 4 (Veo 3) và Phase 5 (composite)

**Sẵn sàng triển khai** khi bạn confirm. Khi sẵn sàng, tôi sẽ chuyển sang agent mode để bắt đầu code từng phase.
