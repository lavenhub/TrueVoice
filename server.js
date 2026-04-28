import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import Groq from 'groq-sdk';
import { initDb } from './db.js'; // Ensure your new db.js is saved!
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors()); // Added cors() call to prevent frontend issues
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'truevoice_super_secret_key_123';

const startServer = async () => {
  try {
    // 1. Initialize DB (better-sqlite3 is sync)
    const db = initDb();
    console.log("✅ Database initialized (Synchronous)");

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

    app.post('/api/gemini-live-call', authenticateToken, async (req, res) => {
      const { userMessage, history } = req.body;
      if (!groq) return res.status(500).json({ error: 'Groq not configured' });

      try {
        const historyText = (history || [])
          .map(h => `${h.role === 'clone' ? 'Ramesh' : 'Caller'}: ${h.text}`)
          .join('\n');

        const prompt = `You are Ramesh... (your full prompt logic here)`;

        const result = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
        
        let text = result.choices[0]?.message?.content || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        
        parsed.scamScore = Number(parsed.scamScore) || 0;

        // 2. better-sqlite3: No 'await', use .prepare().run()
        db.prepare(`
          INSERT INTO threat_logs (user_id, type, city, severity, scam_score, transcript) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          req.user.id, 
          'Live Call Scam Detection', 
          'Delhi, IN',
          parsed.scamScore > 70 ? 'high' : parsed.scamScore > 40 ? 'warn' : 'info',
          parsed.scamScore, 
          userMessage
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

// --- GLOBAL DEPLOYMENT LOGIC (HEALTH CHECK FIX) ---
const cloudPort = process.env.PORT || 8080;

app.listen(cloudPort, "0.0.0.0", () => {
    console.log(`🚀 PORT ACTIVE: TrueVoice listening on ${cloudPort}`);
});

// Trigger background loading
startServer();

// 1. Point to the "dist" folder where Vite builds your frontend
const distPath = path.join(__dirname, 'dist');

// 2. Serve the static files
app.use(express.static(distPath));

// 3. For any route that isn't an API, send the index.html (Handles React Routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});