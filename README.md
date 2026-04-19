# 🧠 MindShift — AI-Powered CBT Thought Records

A luxurious, voice-first CBT (Cognitive Behavioral Therapy) thought record app. Describe your feelings through a conversational chat interface, and AI guides you through identifying situations, emotions, physical sensations, thoughts, and behaviors — then spots cognitive distortions and offers reframes.

## Features

- **Voice + Text Chat** — Talk or type, MindShift listens
- **AI-Guided CBT Flow** — Gentle Q&A through the 5 thought record columns
- **Cognitive Distortion Detection** — Identifies patterns like catastrophizing, mind-reading, etc.
- **Reframing** — Suggests healthier alternative perspectives
- **Dashboard/Journal** — Beautiful calendar view of all your records by date
- **Voice Responses** — AI speaks back (toggle on/off)
- **Luxurious Dark UI** — Navy & gold design, not clinical

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, Framer Motion
- **AI:** Venice API (chat completions, TTS, transcription)
- **Database:** Railway Postgres (Prisma ORM)
- **Deployment:** Railway

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local with your Venice API key and database URL
```

### 3. Set up the database
```bash
npx prisma db push
```

### 4. Run development server
```bash
npm run dev
```

## Deployment to Railway

1. Push this repo to GitHub
2. Create a new Railway project
3. Add a Postgres service
4. Link your GitHub repo as a deploy source
5. Set environment variables:
   - `VENICE_API_KEY` — Your Venice API key
   - `DATABASE_URL` — Auto-provided by Railway Postgres
6. Railway will auto-deploy on push

## Architecture

```
User → Chat/Voice → Venice API (chat) → Extract CBT fields → Postgres → Dashboard
                  → Venice API (ASR)  ← Voice transcription
                  → Venice API (TTS)  ← AI voice responses
```

## The 5 CBT Columns

| Column | Question |
|--------|----------|
| Situation | What happened? What were you doing? |
| Emotions | What did you feel? How intense (0-100%)? |
| Physical Sensations | What did you notice in your body? |
| Thoughts/Beliefs | What went through your mind? |
| Behaviors | What did you do? What did you avoid? |

Built with ✨ by Kriya for Vivek