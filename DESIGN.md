# MindShift — Design Document

## Vision
A luxurious, voice-first CBT thought record app. Users describe their feelings through a conversational chat interface, and AI extracts structured thought records. Beautiful dashboard shows patterns over time.

## Core Features (MVP)
1. **Voice + Text Chat Interface** — Conversational Q&A guided by AI
2. **CBT Thought Record Extraction** — AI maps conversation to the 5 columns (Situation, Emotions, Physical Sensations, Thoughts/Beliefs, Behaviors)
3. **Dashboard/Journal** — Calendar view + list view of all records by date
4. **Insight Cards** — Cognitive distortion detection + reframing

## Design Language
- **Theme:** Dark luxurious (deep navy/charcoal background, warm gold accents, emerald highlights)
- **Typography:** Elegant serif for headings (Playfair Display), clean sans for body (Inter)
- **Feel:** Like a premium journal — leather & gold, not clinical
- **Animations:** Smooth, subtle — gentle transitions, not flashy
- **Voice:** Web Speech API for input, Venice TTS for AI responses

## Tech Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Framer Motion
- **Database:** Railway Postgres (Prisma ORM)
- **AI:** Venice API (chat completions + TTS + transcription)
- **Auth:** Simple magic link or passcode (no heavy auth for MVP)
- **Deployment:** Railway (same as DB)

## Data Model

### User
- id, email, name, created_at

### ThoughtRecord
- id, user_id, date, situation, emotions, physical_sensations, thoughts, behaviors
- cognitive_distortions (JSON), reframed_thoughts (JSON)
- ai_analysis (JSON), created_at

### ChatMessage
- id, user_id, session_id, role (user/assistant), content, audio_url
- created_at

## Architecture
```
User → Chat/Voice → Venice API (chat completion) → Extract CBT fields → Save to Postgres → Dashboard display
```

## CBT Question Flow (AI-guided)
1. "What happened? Tell me about the situation."
2. "What emotions came up? How intense were they (0-100%)?"
3. "What physical sensations did you notice?"
4. "What thoughts went through your mind?"
5. "What did you do? Did you avoid anything?"
6. [AI analyzes] → Identifies distortions, suggests reframes

## API Routes
- POST /api/chat — Send message, get AI response
- POST /api/transcribe — Convert audio to text (Venice ASR)
- POST /api/tts — Convert AI response to speech (Venice TTS)
- GET /api/records — List thought records
- GET /api/records/[id] — Single record detail
- GET /api/dashboard — Stats + patterns