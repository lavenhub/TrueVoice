# 🛡️ TrueVoice 

> **Insert your dashboard screenshot below:**
> 
> ![TrueVoice Dashboard UI](https://placehold.co/800x400/1e293b/06b6d4?text=Upload+Your+App+Screenshot+Here)

## Overview
**TrueVoice** is an AI-powered security platform designed to intercept and prevent AI voice-cloning scams. Built as a full-stack web application, it acts as an intelligent firewall for phone calls, analyzing conversational dynamics and audio signatures to determine whether a caller is a real human or a synthetic clone.

---

## 🔒 The Three-Layer Defense Strategy

TrueVoice relies on a multi-layered security architecture to guarantee authenticity:

### 1. Layer 1: Watermark Engine (Audio DSP)
During onboarding, users record a master voice clip which is injected with an imperceptible **18kHz cryptographic audio watermark**. The system scans incoming audio for this frequency band. If the signature is missing, the voice is immediately flagged as a synthetic clone.

### 2. Layer 2: Liveness Checker
If an AI clone manages to spoof the watermark, this layer measures conversational latency. By issuing sudden, unexpected challenge questions, it tracks the **time-to-first-response**. If the caller responds unnaturally fast (e.g., under 1.2 seconds) or fails the challenge, it is flagged as an AI clone.

### 3. Layer 3: Scam Intent Analyzer
Using the **Gemini 1.5/2.5 API**, this layer analyzes the transcript of the call in real-time. It scores the conversation's intent (0-100), actively flagging high-pressure tactics, requests for money, or suspicious keywords typical of modern social engineering fraud.

---

## 🛠️ Technology Stack

- **Frontend:** React 19 (Vite), Tailwind CSS, Framer Motion, Web Audio API
- **Backend:** Node.js, Express.js
- **Database:** SQLite (sqlite3)
- **Authentication:** JWT, Twilio OTP (with Dev Fallback)
- **AI/ML:** Google Generative AI (Gemini Flash), On-device DSP Filtering

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/TrueVoice.git
   cd TrueVoice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory and add the following variables:
   ```env
   # Server Configuration
   PORT=3001
   JWT_SECRET=your_super_secret_key_here

   # Gemini AI Configuration (Required for Layer 3 Scam Analysis)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Twilio Configuration (Optional - will use '1234' as dev OTP if omitted)
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   ```

4. **Run the Application**
   Start both the Vite frontend server and the Express backend concurrently:
   ```bash
   npm run dev
   ```
   *The frontend will be available at `http://localhost:5180` and the backend on `http://localhost:3001`.*

---

## 📖 How It Works (User Flow)

1. **Onboarding & OTP:** Secure login using mobile OTP verification.
2. **Voice Registration:** The user records a master clip ("My voice is my secure password...") which is hashed and watermarked locally via the Web Audio API.
3. **The Dashboard:** The user accesses the main hub to view threat logs, manage their "Family Vault," and run forensic audio scans.
4. **Analysis Modules:** Users can upload audio files directly into the Watermark, Liveness, or Scam Intent modules to receive detailed, explainable forensic breakdowns of the audio.

---

## 📝 License
This project is licensed under the MIT License.
