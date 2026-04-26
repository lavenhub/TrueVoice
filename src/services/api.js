const BASE_URL = 'http://localhost:3002/api';

const getHeaders = () => {
  const token = localStorage.getItem('tv_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  sendOtp: async (phone) => {
    const res = await fetch(`${BASE_URL}/send-otp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone }),
    });
    return res.json();
  },

  verifyOtp: async (phone, otp, name) => {
    const res = await fetch(`${BASE_URL}/verify-otp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, otp, name }),
    });
    return res.json();
  },

  analyzeScam: async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'capture.webm');

    const res = await fetch(`${BASE_URL}/analyze-scam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('tv_token')}`,
      },
      body: formData,
    });
    return res.json();
  },

  analyzeText: async (text) => {
    const res = await fetch(`${BASE_URL}/analyze-text`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    return res.json();
  },

  getThreatLogs: async () => {
    const res = await fetch(`${BASE_URL}/threat-logs`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // Unified live audio endpoint — sends raw audio to be transcribed and analyzed by Gemini
  geminiLiveAudio: async (audioBlob, history) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'capture.webm');
    formData.append('history', JSON.stringify(history || []));

    const res = await fetch(`${BASE_URL}/gemini-live-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('tv_token')}`,
      },
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'geminiLiveAudio API failed');
    return json;
  },

  // New unified live call endpoint — scam detection + AI reply in one shot
  geminiLiveCall: async (userMessage, history) => {
    const res = await fetch(`${BASE_URL}/gemini-live-call`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userMessage, history }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'geminiLiveCall API failed');
    return json;
  },

  geminiChat: async (scenario, history, userMessage, scamScore) => {
    const res = await fetch(`${BASE_URL}/gemini-chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ scenario, history, userMessage, scamScore }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || 'Gemini chat API failed');
    }
    if (json.error) {
      throw new Error(json.error);
    }
    return json;
  },
};
