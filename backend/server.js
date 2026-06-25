import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import Groq, { toFile } from 'groq-sdk';
import { initDb } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config({ path: new URL('.env', import.meta.url).pathname });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors()); // Added cors() call to prevent frontend issues
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'truevoice_super_secret_key_123';

const startServer = async () => {
  try {
    // 1. Initialize DB (sql.js is async — must await)
    const db = await initDb();
    console.log("✅ Database initialized (sql.js)");

    // Initialize Twilio
    let twilioClient;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }

    // Initialize Groq
    let groq;
    if (process.env.GROQ_API_KEY) {
      groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    // Initialize Gemini
    let genAI, geminiModel;
    if (process.env.GEMINI_API_KEY) {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    const performGoogleSecurityAudit = async (transcript) => {
      if (!geminiModel) return "Deep Audit unavailable: Check API Key.";
      try {
        const prompt = `Perform a deep psychological security audit on this transcript: "${transcript}"`;
        const result = await geminiModel.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        console.error("Gemini Audit Error:", err);
        return "Audit scan failed.";
      }
    };

    const upload = multer({ storage: multer.memoryStorage() });

    const authenticateToken = (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.sendStatus(401);
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
      });
    };

    // --- ROUTES ---

    // ── Auth: Send OTP ──────────────────────────────────────────────────────
    app.post('/api/send-otp', async (req, res) => {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: 'Phone is required' });

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      db.prepare(`
        INSERT INTO otps (phone, otp, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET otp=excluded.otp, expires_at=excluded.expires_at
      `).run(phone, otp, expiresAt);

      // If Twilio is configured, send real SMS; otherwise just log it
      if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        try {
          await twilioClient.messages.create({
            body: `Your TrueVoice verification code is: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
          });
        } catch (err) {
          console.error('Twilio SMS error:', err.message);
        }
      }

      console.log(`🔑 OTP for ${phone}: ${otp}`); // visible in server terminal for dev
      res.json({ success: true });
    });

    // ── Auth: Verify OTP ────────────────────────────────────────────────────
    app.post('/api/verify-otp', async (req, res) => {
      const { phone, otp, name } = req.body;
      if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

      // Demo mode: any OTP is accepted
      // (remove this block and uncomment below for production)
      /*
      const record = db.prepare(`SELECT * FROM otps WHERE phone = ?`).get(phone);
      if (!record) return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
      if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
      if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired' });
      */

      // Upsert user
      db.prepare(`
        INSERT INTO users (phone, name) VALUES (?, ?)
        ON CONFLICT(phone) DO UPDATE SET name=excluded.name
      `).run(phone, name || '');

      const user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);

      // Clean up used OTP
      db.prepare(`DELETE FROM otps WHERE phone = ?`).run(phone);

      const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, user: { id: user.id, name: user.name, phone: user.phone } });
    });

    // ── Transcribe: Audio → Text via Groq Whisper ──────────────────────────
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
        console.error('[transcribe] Error:', err?.message || err);
        res.status(500).json({ error: 'Transcription failed', detail: err?.message });
      }
    });

    app.post('/api/gemini-live-call', authenticateToken, async (req, res) => {
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
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
        
        let text = result.choices[0]?.message?.content || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        
        parsed.scamScore = Number(parsed.scamScore) || 0;

        // sql.js uses the same synchronous-style API via the wrapper
        db.prepare(`
          INSERT INTO threat_logs (user_id, type, city, severity, scam_score, transcript) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          req.user.id || 0,
          'Live Call Scam Detection', 
          'Delhi, IN',
          parsed.scamScore > 70 ? 'high' : parsed.scamScore > 40 ? 'warn' : 'info',
          parsed.scamScore || 0, 
          userMessage || ''
        );

        res.json(parsed);
      } catch (error) {
        console.error('[gemini-live-call] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

  } catch (err) {
    console.error("❌ Critical Startup Error:", err);
  }
};

// --- GLOBAL DEPLOYMENT LOGIC ---
const cloudPort = process.env.PORT || 8080;

// Kick off DB init and route registration first
startServer().then(() => {
  // dist/ is at project root (one level above backend/)
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
});

app.listen(cloudPort, '0.0.0.0', () => {
  console.log(`🚀 PORT ACTIVE: TrueVoice listening on ${cloudPort}`);
});