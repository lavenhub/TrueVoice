/**
 * Vercel Serverless Entry Point
 * All /api/* requests are handled here.
 * Uses in-memory store (resets on cold start) — fine for hackathon demo.
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import Groq, { toFile } from 'groq-sdk';

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'truevoice_super_secret_key_123';
const upload = multer({ storage: multer.memoryStorage() });

// ── In-memory store (survives within a warm function instance) ───────────────
const db = {
  users:  new Map(), // phone → { id, phone, name }
  otps:   new Map(), // phone → { otp, expiresAt }
  nextId: 1,
};

// ── Groq ─────────────────────────────────────────────────────────────────────
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// ── Auth middleware ───────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ── POST /api/send-otp ────────────────────────────────────────────────────────
app.post('/api/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone is required' });
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  db.otps.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  console.log(`🔑 OTP for ${phone}: ${otp}`);
  res.json({ success: true });
});

// ── POST /api/verify-otp ──────────────────────────────────────────────────────
app.post('/api/verify-otp', (req, res) => {
  const { phone, otp, name } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

  // Demo mode — any OTP accepted
  if (!db.users.has(phone)) {
    db.users.set(phone, { id: db.nextId++, phone, name: name || '' });
  } else {
    db.users.get(phone).name = name || db.users.get(phone).name;
  }
  db.otps.delete(phone);

  const user = db.users.get(phone);
  const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, name: user.name, phone: user.phone } });
});

// ── POST /api/transcribe ──────────────────────────────────────────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!groq) return res.status(500).json({ error: 'Groq not configured' });
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  try {
    const audioFile = await toFile(req.file.buffer, 'audio.webm', { type: req.file.mimetype });
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      language: 'en',
      response_format: 'json',
    });
    const text = (transcription.text || '').trim();
    console.log(`🎤 Transcribed: "${text}"`);
    res.json({ text });
  } catch (err) {
    console.error('[transcribe]', err?.message);
    res.status(500).json({ error: 'Transcription failed', detail: err?.message });
  }
});

// ── POST /api/gemini-live-call ────────────────────────────────────────────────
app.post('/api/gemini-live-call', auth, async (req, res) => {
  const { userMessage, history } = req.body;
  if (!groq) return res.status(500).json({ error: 'Groq not configured' });

  try {
    const historyText = (history || [])
      .map(h => `${h.role === 'clone' ? 'Ramesh' : 'Caller'}: ${h.text}`)
      .join('\n');

    const prompt = `You are a scam detection AI. Analyze the following phone call transcript and conversation history for signs of fraud, impersonation, or social engineering.

Conversation history:
${historyText || '(no history)'}

Latest message from caller: "${userMessage}"

Respond with a JSON object containing:
- "reply": a short response the victim might say to keep the scammer talking
- "scamScore": a number 0-100 indicating likelihood this is a scam (0=safe, 100=definite scam)
- "scamReasoning": one sentence explaining the score
- "scamFlags": an array of objects with "label", "detail", and "sev" (info/warn/high) for each red flag detected

Return only valid JSON.`;

    const result = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
    });

    let text = result.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text);
    parsed.scamScore = Number(parsed.scamScore) || 0;
    res.json(parsed);
  } catch (err) {
    console.error('[gemini-live-call]', err?.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Export for Vercel ─────────────────────────────────────────────────────────
export default app;
