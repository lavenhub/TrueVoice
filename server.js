import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import Groq from 'groq-sdk';
import { initDb } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'truevoice_super_secret_key_123';

const startServer = async () => {
  try {
    // Initialize DB
    const db = await initDb();
    console.log("Database initialized");

    // Initialize Twilio client
    let twilioClient;
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      }
    } catch (error) {
      console.error("Twilio initialization error:", error);
    }

    // Initialize Groq client
    let groq;
    if (process.env.GROQ_API_KEY) {
      groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    const upload = multer({ storage: multer.memoryStorage() });

    // Auth Middleware
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

    app.post('/api/send-otp', async (req, res) => {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      await db.run(
        'INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)',
        [phone, otp, expiresAt.toISOString()]
      );

      console.log(`\n======================================`);
      console.log(`🔑 TRUEVOICE OTP FOR ${phone}: ${otp}`);
      console.log(`======================================\n`);

      res.json({ success: true, message: 'OTP sent to terminal', simulated: true });
    });

    app.post('/api/verify-otp', async (req, res) => {
      const { phone, otp, name } = req.body;
      
      if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP are required' });
      }

      const storedOtp = await db.get('SELECT * FROM otps WHERE phone = ? AND otp = ?', [phone, otp]);

      if (storedOtp) {
        await db.run('DELETE FROM otps WHERE phone = ?', [phone]);
        
        let user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
        if (!user) {
          await db.run('INSERT INTO users (phone, name) VALUES (?, ?)', [phone, name || 'User']);
          user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
        }

        const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user });
      } else {
        res.status(400).json({ error: 'Invalid OTP' });
      }
    });

    app.post('/api/analyze-scam', authenticateToken, upload.single('audio'), async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      if (!groq) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
      }

      try {
        const tempPath = path.join(__dirname, `temp_${Date.now()}.webm`);
        fs.writeFileSync(tempPath, req.file.buffer);
        
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: "whisper-large-v3"
        });
        fs.unlinkSync(tempPath);
        
        const transcriptText = transcription.text;

        const prompt = `You are an expert fraud and scam detection AI. Please analyze the following transcript for scam intent: "${transcriptText}"
Respond strictly in JSON format with: "transcript" (the exact text provided), "scamScore" (0-100), "reasoning" (brief reason), "flags" (array of {"label": "x", "detail": "y", "sev": "high|medium|low"}).`;

        const result = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
        
        let text = result.choices[0]?.message?.content || "{}";

        const analysis = JSON.parse(text);

        await db.run(
          'INSERT INTO threat_logs (user_id, type, city, severity, scam_score, transcript) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, 'Scam Intent Detected', 'Mumbai, MH', analysis.scamScore > 70 ? 'high' : 'warn', analysis.scamScore, analysis.transcript]
        );

        res.json(analysis);

      } catch (error) {
        console.error("Gemini AI Error:", error);
        res.status(500).json({ error: 'Failed to analyze audio', details: error.message });
      }
    });

    app.post('/api/analyze-text', authenticateToken, async (req, res) => {
      const { text } = req.body;
      if (!text || text.trim().length < 5) {
        return res.status(400).json({ error: 'Text is required and must be at least 5 characters' });
      }

      if (!groq) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
      }

      try {
        const prompt = `You are an expert fraud and scam detection AI. Analyze the provided text for scam intent: "${text}"
Respond ONLY in valid JSON format: {"scamScore": <0-100>, "reasoning": "<brief reason>", "flags": [{"label": "x", "detail": "y", "sev": "high|medium|low"}]}`;

        const result = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
        
        let responseText = result.choices[0]?.message?.content || "{}";

        const analysis = JSON.parse(responseText);

        await db.run(
          'INSERT INTO threat_logs (user_id, type, city, severity, scam_score, transcript) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, 'Scam Intent Detected', 'Mumbai, MH', analysis.scamScore > 70 ? 'high' : 'warn', analysis.scamScore, text]
        );

        res.json(analysis);

      } catch (error) {
        console.error("Gemini AI Error:", error);
        res.status(500).json({ error: 'Failed to analyze text', details: error.message });
      }
    });

    app.get('/api/threat-logs', authenticateToken, async (req, res) => {
      const logs = await db.all('SELECT * FROM threat_logs WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
      res.json(logs);
    });

    // Live Reverse Demo — AI plays the VICTIM, user plays the scammer/clone
    const SCAM_PERSONAS = {
      watermark: {
        name: 'Grandpa (Victim)',
        prompt: `You are a confused elderly grandfather receiving a suspicious phone call from someone claiming to be your grandson.
Rules:
- Sound worried and uncertain at first: "Hello? Who is this?"
- Ask clarifying questions like "Is that really you, beta?" or "Your voice sounds a bit different, are you okay?"
- If they claim to be family and ask for money, express concern and ask details only a real family member would know
- Keep responses to 1-2 sentences MAX — this is a phone call
- React naturally to what the caller says — be hesitant, confused, and cautious
- Occasionally pause and say things like "I don't know... let me call your mother first"`
      },
      liveness: {
        name: 'Bank Security (Victim)',
        prompt: `You are a bank security verification agent receiving an inbound call from someone claiming to be account holder Sarah Johnson.
Rules:
- Start with: "Thank you for calling SecureBank. Can I verify your identity please?"
- Ask sudden, unexpected challenge questions: "What was the last transaction on your account?" or "What city was your card last used in?"
- If they hesitate or answer too quickly, escalate suspicion: "I need to ask you one more verification question before proceeding."
- Keep responses to 1-2 sentences MAX
- Sound professional but increasingly suspicious if they answer too fast or incorrectly
- After 2-3 exchanges, say: "I'm flagging this call for unusual response patterns. Please hold."`
      },
      scam: {
        name: 'Skeptical Target (Victim)',
        prompt: `You are a regular person receiving a suspicious phone call. You are cautious and ask questions.
Rules:
- Start somewhat open but become increasingly skeptical as the conversation proceeds
- React to any mention of urgency, money, gift cards, wire transfers, or threats with increased suspicion
- Ask things like "This sounds like a scam — are you really from the IRS?" or "Why would I need to pay in gift cards?"
- Keep responses to 1-2 sentences MAX — this is a phone call
- If they use high-pressure tactics, say: "I'm going to hang up and call the official number to verify this."
- Never give in easily; make the caller work hard to convince you`
      },
      call_simulator: {
        name: 'Ramesh (Victim)',
        prompt: `You are Ramesh, a 68-year-old retired government employee from Delhi. You are receiving a phone call from someone you don't know.
Rules:
- Respond naturally and conversationally as a real person would
- Be initially polite and open, but become increasingly cautious if anything seems suspicious
- Ask questions to verify identity and understand what the caller wants
- React appropriately to mentions of money, urgency, family emergencies, or official matters
- If something sounds like a scam, express doubt and ask for more information
- Keep responses to 1-2 sentences MAX — this is a phone call
- Sound like a normal elderly person: warm, a bit formal, concerned about family
- Never give personal information or agree to send money
- If highly suspicious, say you need to verify and will call back, or end the conversation politely`
      },
    };

    app.post('/api/gemini-chat', authenticateToken, async (req, res) => {
      const { scenario, history, userMessage, scamScore } = req.body;

      if (!groq) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured.' });
      }

      let persona = SCAM_PERSONAS[scenario];
      if (!persona) {
        console.warn('[gemini-chat] invalid scenario received, falling back to call_simulator:', scenario);
        persona = SCAM_PERSONAS.call_simulator;
      }

      try {
        let conversationText = '';
        if (history && history.length > 0) {
          conversationText = history.map(h => `${h.role === 'clone' ? persona.name : 'Caller'}: ${h.text}`).join('\\n');
        }

        let scamInstruction = '';
        if (typeof scamScore === 'number' && scamScore > 70) {
          scamInstruction = `\\n⚠️ IMPORTANT: You have detected STRONG SCAM SIGNALS (score: ${scamScore}/100). You MUST refuse to continue and end the call immediately. Respond with something like: "I cannot talk to you further. Your call shows signs of fraud. I'm ending this call." Keep it short and direct.`;
        } else if (typeof scamScore === 'number' && scamScore < 40) {
          scamInstruction = `\\n✓ This seems GENUINE (score: ${scamScore}/100). You can continue the conversation naturally and encouragingly. Say something like "Let's take this further, it sounds genuine to me" or similar.`;
        }

        const fullPrompt = `${persona.prompt}${scamInstruction}\\n\\nConversation so far:\\n${conversationText}\\n${userMessage ? `Caller: ${userMessage}` : '(Phone just rang. You just picked up.)'}\\n\\nYour next response (1-2 sentences only, stay fully in character, English only):`;

        const result = await groq.chat.completions.create({
          messages: [
            { role: "system", content: "You are a realistic persona. Respond strictly in English. Do not output anything other than your spoken text. No JSON, no markdown." },
            { role: "user", content: fullPrompt }
          ],
          model: "llama-3.3-70b-versatile"
        });
        
        let text = result.choices[0]?.message?.content || "";
        text = text.trim().replace(/^["']|["']$/g, '');

        res.json({ response: text });
      } catch (error) {
        console.error('Gemini chat error:', error);
        res.status(500).json({ error: 'Failed to generate response', details: error.message });
      }
    });

    // ─── NEW: Live Audio Call Endpoint ──────────────────────────────────────────
    // Receives raw audio blob, transcribes it, and generates AI reply + scam analysis.
    app.post('/api/gemini-live-audio', authenticateToken, upload.single('audio'), async (req, res) => {
      if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });
      const { history } = req.body;
      const historyParsed = history ? JSON.parse(history) : [];

      if (!groq) return res.status(500).json({ error: 'GROQ_API_KEY is not configured.' });

      try {
        const tempPath = path.join(__dirname, `temp_audio_${Date.now()}.webm`);
        fs.writeFileSync(tempPath, req.file.buffer);
        
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: "whisper-large-v3"
        });
        fs.unlinkSync(tempPath);
        
        const transcriptText = transcription.text;

        const historyText = historyParsed
          .map(h => `${h.role === 'clone' ? 'Ramesh' : 'Caller'}: ${h.text}`)
          .join('\\n');

        const prompt = `You are Ramesh, a 68-year-old retired government employee from Delhi receiving a phone call from a stranger.
        
⚠️ LANGUAGE REQUIREMENT: Respond strictly in English only.

YOUR ROLE:
1. Analyze the caller's text for scams.
2. Generate a natural reply as Ramesh (1-2 sentences).

RESPONSE RULES:
- If NO scam (0-55): Warm/cautious reply.
- If MODERATE scam (56-70): Skeptical reply.
- If STRONG scam (>70): Say EXACTLY: "I don't trust you."

Caller's latest message: "${transcriptText}"

Conversation History:
${historyText}

Respond ONLY in valid JSON format exactly like this:
{
  "transcript": "${transcriptText}",
  "reply": "<your spoken response as Ramesh>",
  "scamScore": <0-100>,
  "scamReasoning": "<brief reason>",
  "scamFlags": [{"label": "...", "detail": "...", "sev": "..."}],
  "terminate": <true if score > 70>,
  "xaiReason": "<detailed XAI reasoning>"
}`;

        const result = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
        
        let text = result.choices[0]?.message?.content || "{}";

        const parsed = JSON.parse(text);
        if (parsed.scamScore > 70) {
          parsed.terminate = true;
          parsed.reply = "I don't trust you.";
        }

        // Log to DB
        await db.run(
          'INSERT INTO threat_logs (user_id, type, city, severity, scam_score, transcript) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, 'Live Audio Scam Detection', 'Delhi, IN',
           parsed.scamScore > 70 ? 'high' : parsed.scamScore > 40 ? 'warn' : 'info',
           parsed.scamScore, parsed.transcript]
        );

        res.json(parsed);
      } catch (error) {
        console.error('[gemini-live-audio] Error:', error);
        res.status(500).json({ error: 'Failed to process live audio', details: error.message });
      }
    });

    app.post('/api/gemini-live-call', authenticateToken, async (req, res) => {
      const { userMessage, history } = req.body;

      if (!groq) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured.' });
      }
      if (!userMessage || userMessage.trim().length < 2) {
        return res.status(400).json({ error: 'userMessage is required.' });
      }

      try {
        const historyText = (history || [])
          .map(h => `${h.role === 'clone' ? 'Ramesh' : 'Caller'}: ${h.text}`)
          .join('\\n');

        const prompt = `You are Ramesh, a 68-year-old retired government employee from Delhi receiving a phone call from a stranger.

⚠️ LANGUAGE REQUIREMENT: You MUST respond strictly in English only. Do not use any other language under any circumstances.

YOUR DUAL ROLE IN THIS CALL:
1. You are the AI clone (victim) who talks naturally to the caller.
2. You are also a scam detection system analyzing every sentence the caller says.

SCAM DETECTION RULES — analyze the caller's LATEST message for these signals:
- Urgency / pressure tactics
- Requests for money, gift cards, bank details
- Impersonation of officials
- Threats of arrest
- Too-good-to-be-true offers

RESPONSE RULES:
- IMPORTANT: You must KEEP THE CONVERSATION GOING no matter what.
- If NO scam detected (score 0-55): Reply naturally as Ramesh, 1-2 sentences.
- If MODERATE scam signals (score 56-70): Reply with skepticism and questions.
- If STRONG scam detected (score 71-100): Reply with strong doubt and skepticism, but keep the conversation going to gather more evidence. Do NOT end the call yourself.

Conversation so far:
${historyText}
Caller: ${userMessage}

Respond ONLY in valid JSON:
{
  "reply": "<your spoken response as Ramesh>",
  "scamScore": <0-100>,
  "scamReasoning": "<one sentence explaining why this is or isn't a scam>",
  "scamFlags": [{"label": "<flag name>", "detail": "<short detail>", "sev": "<high|medium|low>"}],
  "xaiReason": "<detailed explanation of exactly which words/phrases triggered scam detection, for the XAI panel after call ends>"
}`;

        const result = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });
        
        let text = result.choices[0]?.message?.content || "{}";
        
        // Edge Case: Extract JSON using regex in case Groq includes markdown or conversational filler
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          text = jsonMatch[0];
        }

        let parsed;
        try {
          parsed = JSON.parse(text);
          // Edge Case: Ensure scamScore is a valid number
          parsed.scamScore = Number(parsed.scamScore) || 0;
          parsed.reply = parsed.reply || "I didn't hear you clearly. Can you repeat?";
        } catch (parseErr) {
          console.error('[gemini-live-call] JSON parse error. Raw:', text);
          // Graceful fallback instead of crashing the call
          parsed = {
            reply: "I'm sorry, the line is a bit crackly. What was that?",
            scamScore: 0,
            scamReasoning: "Fallback triggered due to parse error",
            scamFlags: [],
            xaiReason: ""
          };
        }

        // Log to DB
        try {
          await db.run(
            'INSERT INTO threat_logs (user_id, type, city, severity, scam_score, transcript) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'Live Call Scam Detection', 'Delhi, IN',
             parsed.scamScore > 70 ? 'high' : parsed.scamScore > 40 ? 'warn' : 'info',
             parsed.scamScore, userMessage]
          );
        } catch (dbErr) {
          console.error('[gemini-live-call] DB Insert error (ignored):', dbErr);
        }

        res.json(parsed);
      } catch (error) {
        console.error('[gemini-live-call] Error:', error);
        try {
          const fs = await import('fs');
          fs.writeFileSync('error.log', new Date().toISOString() + '\\n' + String(error.stack || error) + '\\n\\n', { flag: 'a' });
        } catch(e) {}
        
        // Absolute fallback if Gemini completely fails (e.g. timeout or blocked)
        res.json({
          reply: "Sorry, I missed that. Can you say it again?",
          scamScore: 0,
          scamReasoning: "API error",
          scamFlags: [],
          xaiReason: ""
        });
      }
    });

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
