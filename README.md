# TrueVoice — AI Voice Scam Detection Platform

> Protecting you from AI voice clones, vishing attacks, and real-time scam calls.

[![Vercel Deploy](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://truevoice.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-lavenhub%2FTrueVoice-blue?logo=github)](https://github.com/lavenhub/TrueVoice)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What is TrueVoice?

TrueVoice is a full-stack AI-powered platform that detects and blocks AI voice scams in real time using three independent layers of defense:

- **Layer 1 — Cryptographic Watermark:** Embeds an inaudible 18kHz ultrasonic signature into registered voices. AI cloning tools destroy frequencies above 8kHz, so a missing watermark instantly flags an AI clone.
- **Layer 2 — Prosodic Liveness Analysis:** Measures dynamic variance, zero-crossing rate, and pause patterns in audio. AI-synthesized speech is unnaturally flat — these DSP metrics expose it.
- **Layer 3 — Scam Intent Detection:** A Groq-powered LLM (Llama 3.3 70B) analyzes live conversation transcripts in real time, scoring every message 0–100 for psychological manipulation, urgency tactics, and identity theft patterns.

---

## Features

| Feature | Description |
|---|---|
| **AI Call Monitor** | Upload audio → Layer 1 watermark scan + Layer 2 liveness analysis with real DSP metrics |
| **Scam Intent Chat** | Live roleplay simulator — type or speak, get real-time threat scores with animated gauge |
| **Voice Call Mode** | Hands-free voice conversation — MediaRecorder + Groq Whisper STT → auto-sends on silence |
| **Family Vault** | Register family members' voice biometrics, run live 5-second identity checks |
| **Creator Shield** | Watermark your audio/video content before publishing to prevent AI cloning |
| **Live Map** | Real-time scam activity heatmap across India with threat simulation |
| **Profile** | Voice hash display, master clip playback, dewatermark tool |

---

## Tech Stack

**Frontend**
- React 19 + Vite 8
- Tailwind CSS v4
- React Router v7
- Leaflet / React-Leaflet (maps)
- Web Audio API (DSP analysis, watermarking)
- MediaRecorder API (voice recording)
- Web Speech Synthesis API (TTS)

**Backend**
- Node.js + Express 5
- Groq SDK — Llama 3.3 70B (scam detection) + Whisper Large v3 Turbo (STT)
- Google Generative AI (Gemini 1.5 Flash)
- sql.js (SQLite in-memory/file)
- JWT authentication
- Multer (audio file handling)

**Deployment**
- Vercel (frontend static + serverless API functions)

---

## Project Structure

```
TrueVoice/
├── frontend/          # React app (Vite)
│   ├── src/
│   │   ├── pages/     # Dashboard, ScamIntent, Monitor, FamilyVault, etc.
│   │   ├── components/# Layout, Sidebar, Spectrogram, Waveform, etc.
│   │   ├── services/  # api.js — all backend calls
│   │   └── audioUtils.js  # DSP: watermark embed/detect, liveness analysis
│   └── vite.config.js
├── backend/           # Express server (local dev)
│   ├── server.js
│   └── db.js          # sql.js wrapper
├── api/
│   └── index.js       # Vercel serverless handler (all /api/* routes)
├── vercel.json        # Vercel routing config
├── package.json
└── .npmrc             # legacy-peer-deps for React 19 compat
```

---

## Getting Started (Local)

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free)

### Setup

```bash
git clone https://github.com/lavenhub/TrueVoice.git
cd TrueVoice
npm install --legacy-peer-deps
```

Create `backend/.env`:
```env
GROQ_API_KEY=your_groq_key_here
JWT_SECRET=your_jwt_secret_here
PORT=8080
```

### Run

```bash
npm run dev
```

- Frontend → http://localhost:5180
- Backend → http://localhost:8080

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/send-otp` | — | Send OTP to phone (demo: logs to terminal) |
| POST | `/api/verify-otp` | — | Verify OTP, returns JWT (demo: any code works) |
| POST | `/api/transcribe` | — | Audio → text via Groq Whisper |
| POST | `/api/gemini-live-call` | JWT | Scam detection + AI reply via Groq Llama |

---

## Deployment (Vercel)

1. Fork or clone this repo to your GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import `TrueVoice`
3. Set these settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install --legacy-peer-deps`
4. Add Environment Variables:
   - `GROQ_API_KEY` — your Groq key
   - `JWT_SECRET` — any random string
5. Click **Deploy**

---

## How the Watermark Works

1. During voice registration, TrueVoice records your voice and mixes a **18kHz sine wave** at low amplitude into the audio track
2. The SHA-256 hash of this watermarked audio becomes your **voice fingerprint**
3. When analyzing a call, TrueVoice applies an **18kHz bandpass filter** and measures the RMS energy
4. If RMS < threshold → watermark destroyed → **AI clone detected**
5. All processing runs in the browser via **Web Audio API** — no raw audio is ever sent to servers

---

## Demo Mode

- OTP verification accepts **any 4-digit code** — no SMS needed
- Scam Intent chat works with **any Groq API key** or just type in the key field to proceed

---

## Built at Hackathon

TrueVoice was built as a hackathon project to demonstrate that real-time AI voice scam detection is technically feasible today using only open-source models and browser APIs — no specialized hardware required.
