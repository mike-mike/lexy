# Lexy

English conversation MVP – speak, get AI response in text + voice.

## Stack

- **Frontend**: Angular 19 (mobile-first, phone-style layout)
- **Backend**: Node.js + Express + TypeScript
- **AI**: OpenAI Chat + TTS + Whisper APIs
- **STT**: MediaRecorder → Whisper (works in all browsers)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `api/.env.example` to `api/.env` and add your OpenAI API key.

3. Run API and web in separate terminals:
   ```bash
   npm run api    # http://localhost:3001
   npm run web    # http://localhost:4200 (proxies /api to 3001)
   ```

4. Open http://localhost:4200 on your phone or in dev tools mobile view.

## Flow

1. Choose level (Beginner / Intermediate / Advanced).
2. Tap mic → speak in English → tap again to send.
3. Audio → Whisper (transcribe) → OpenAI Chat → TTS.
4. Response is shown as text and played via OpenAI TTS.
5. Text stays visible so you can read if needed.
