import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, AlertTriangle, ShieldCheck, ShieldAlert, Info, Send, Phone, PhoneOff, Radio } from 'lucide-react';
import { api } from '../services/api';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

const BASE_URL = '/api';

const ScamIntent = ({ setCallsAnalyzed, setThreatsBlocked }) => {
  // Animate score counter toward target
  useEffect(() => {
    clearInterval(scoreAnimRef.current);
    scoreAnimRef.current = setInterval(() => {
      setDisplayScore(prev => {
        if (prev === scamScore) { clearInterval(scoreAnimRef.current); return prev; }
        const step = Math.ceil(Math.abs(scamScore - prev) / 8); // faster when far, slower near target
        return prev < scamScore ? Math.min(prev + step, scamScore) : Math.max(prev - step, scamScore);
      });
    }, 30); // ~33fps
    return () => clearInterval(scoreAnimRef.current);
  }, [scamScore]);
  const messagesRef = useRef([
    { message: "Hello! I am Ramesh. How can I help you today?", sender: "Ramesh", direction: "incoming" }
  ]);

  const [messages, setMessages] = useState(messagesRef.current);

  const addMessage = (msg) => {
    messagesRef.current = [...messagesRef.current, msg];
    setMessages([...messagesRef.current]);
  };
  const [inputText, setInputText]   = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping]     = useState(false);
  const [voiceError, setVoiceError] = useState('');

  // Scam panel state
  const [scamScore, setScamScore]       = useState(0);
  const [displayScore, setDisplayScore] = useState(0); // animated display value
  const scoreAnimRef                    = useRef(null);
  const [scamReasoning, setScamReasoning] = useState('');
  const [scamFlags, setScamFlags]       = useState([]);

  // Voice mode: off | listening | processing | speaking
  const [voiceMode, setVoiceMode]   = useState('off');
  const voiceModeRef                = useRef('off');
  const setVoiceModeSync = (m) => { voiceModeRef.current = m; setVoiceMode(m); };

  // MediaRecorder refs
  const mediaStreamRef    = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const audioCtxRef       = useRef(null);
  const analyserRef       = useRef(null);
  const silenceTimerRef   = useRef(null);
  const rafRef            = useRef(null);
  const isSpeakingRef     = useRef(false); // track if user was speaking

  const SILENCE_MS        = 1800;  // send after 1.8s of silence
  const SILENCE_THRESHOLD = 12;    // RMS below this = silence (raised from 8)

  // ── MediaRecorder-based voice input ─────────────────────────────────────────

  const stopMic = () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  };

  const transcribeAndSend = async (blob) => {
    // Don't send if user never actually spoke or blob is too small
    if (!blob || blob.size < 3000 || !isSpeakingRef.current) {
      if (voiceModeRef.current === 'listening') startMic();
      else { setIsListening(false); setInterimText(''); }
      return;
    }
    setVoiceModeSync('processing');
    setInterimText('Transcribing…');
    try {
      const token = localStorage.getItem('tv_token');
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      const res = await fetch(`${BASE_URL}/transcribe`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      const text = (data.text || '').trim();
      setInterimText('');
      if (text && text !== '.') {
        handleSend(text, voiceModeRef.current !== 'off');
      } else {
        // Nothing meaningful heard — go back to listening
        if (voiceModeRef.current !== 'off') {
          setVoiceModeSync('listening');
          startMic();
        } else {
          setIsListening(false);
        }
      }
    } catch (err) {
      console.error('Transcribe error:', err);
      setVoiceError('Transcription failed. Check server is running.');
      setTimeout(() => setVoiceError(''), 3000);
      if (voiceModeRef.current !== 'off') { setVoiceModeSync('listening'); startMic(); }
      else setIsListening(false);
    }
  };

  const startMic = async () => {
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      // Set up AudioContext for RMS silence detection
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      isSpeakingRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        transcribeAndSend(blob);
      };

      recorder.start(100); // collect chunks every 100ms
      setIsListening(true);
      setVoiceModeSync('listening');

      // RMS loop — detect silence and auto-stop
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const checkSilence = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArr);
        const rms = Math.sqrt(dataArr.reduce((s, v) => s + v * v, 0) / dataArr.length);

        if (rms > SILENCE_THRESHOLD) {
          // User is speaking
          isSpeakingRef.current = true;
          setInterimText('🎤 Listening…');
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        } else if (isSpeakingRef.current && !silenceTimerRef.current) {
          // Silence after speech — start countdown
          silenceTimerRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state !== 'inactive') {
              mediaRecorderRef.current.stop();
              setIsListening(false);
              setInterimText('');
            }
          }, SILENCE_MS);
        }
        rafRef.current = requestAnimationFrame(checkSilence);
      };
      rafRef.current = requestAnimationFrame(checkSilence);

    } catch (err) {
      console.error('Mic error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone blocked. Click the 🔒 icon in Chrome\'s address bar → allow microphone → retry.');
      } else if (err.name === 'NotFoundError') {
        setVoiceError('No microphone found. Plug in a mic and try again.');
      } else {
        setVoiceError('Could not start microphone: ' + err.message);
      }
      setVoiceModeSync('off');
      setIsListening(false);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      stopMic();
    } else {
      await startMic();
    }
  };

  const toggleVoiceMode = async () => {
    if (voiceModeRef.current !== 'off') {
      window.speechSynthesis.cancel();
      stopMic();
      setVoiceModeSync('off');
      setInputText('');
      setInterimText('');
    } else {
      await startMic();
    }
  };

  const handleSend = async (textContent, fromVoice = false) => {
    const textToSend = textContent.trim();
    if (!textToSend) return;

    // Add user message — use ref so voice async callbacks never see stale state
    addMessage({ message: textToSend, sender: "You", direction: "outgoing" });
    setInputText('');
    setIsTyping(true);

    const historyPayload = messagesRef.current.slice(0, -1).map(m => ({
      role: m.direction === 'incoming' ? 'clone' : 'user',
      text: m.message
    }));

    try {

      const res = await api.geminiLiveCall(textToSend, historyPayload);
      
      const aiReply = res.reply || "I didn't quite catch that.";
      addMessage({ message: aiReply, sender: "Ramesh", direction: "incoming" });
      
      // TTS — speak Ramesh's reply
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(aiReply);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name === 'Google English (India)') ||
                               voices.find(v => v.name.includes('Google') && v.lang === 'en-IN') ||
                               voices.find(v => v.name === 'Google UK English Female') ||
                               voices.find(v => v.name === 'Google US English') ||
                               voices.find(v => v.name.includes('Premium') && v.lang.startsWith('en')) ||
                               voices.find(v => v.lang === 'en-IN') ||
                               voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        if (fromVoice) {
          // Voice mode: mark as "speaking", restart mic when done
          setVoiceModeSync('speaking');
          utterance.onend = () => {
            if (voiceModeRef.current !== 'off') {
              setVoiceModeSync('listening');
              startMic();
            }
          };
          utterance.onerror = () => {
            if (voiceModeRef.current !== 'off') {
              setVoiceModeSync('listening');
              startMic();
            }
          };
        }

        window.speechSynthesis.speak(utterance);
      }
      
      // Update Scam Panel
      if (typeof res.scamScore === 'number') {
        setScamScore(res.scamScore);
        if (res.scamScore > 70 && setThreatsBlocked) setThreatsBlocked(p => p + 1);
      }
      if (res.scamReasoning) setScamReasoning(res.scamReasoning);
      if (res.scamFlags) setScamFlags(res.scamFlags);
      if (setCallsAnalyzed) setCallsAnalyzed(p => p + 1);

    } catch (error) {
      console.error("API error", error);
      addMessage({ message: "Sorry, I encountered an error connecting to the AI.", sender: "System", direction: "incoming" });
      // If voice mode, go back to listening even on error
      if (fromVoice && voiceModeRef.current !== 'off') {
        setVoiceModeSync('listening');
        startMic();
      }
    } finally {
      setIsTyping(false);
    }
  };

  const [tempKey, setTempKey] = useState('');
  const [isKeyEntered, setIsKeyEntered] = useState(false);

  const getScoreColor = () => {
    if (displayScore > 70) return '#ef4444';
    if (displayScore > 40) return '#f97316';
    return '#10b981';
  };

  if (!isKeyEntered) {
    return (
      <div className="fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fff', padding: '2.5rem', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%', textAlign: 'center', marginTop: '-25vh' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={30} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1e293b' }}>Gemini Authentication</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Please enter your Gemini API key to activate the live threat analysis engine.</p>
          
          <input 
            type="password"
            placeholder="AIzaSy..."
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && tempKey.trim()) setIsKeyEntered(true); }}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '1.5rem', outline: 'none', fontSize: '1rem', textAlign: 'center', letterSpacing: '2px' }}
          />
          
          <button 
            onClick={() => setIsKeyEntered(true)}
            disabled={!tempKey.trim()}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: tempKey.trim() ? '#10b981' : '#e2e8f0', color: tempKey.trim() ? '#fff' : '#94a3b8', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: tempKey.trim() ? 'pointer' : 'default', transition: 'all 0.2s ease' }}
          >
            Authenticate & Proceed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Scam Intent Chat Simulator</h2>
          <p className="text-base mb-0">Roleplay as a caller and test the AI's real-time threat detection.</p>
        </div>
        <div className="badge" style={{backgroundColor: 'var(--orange)', color: '#ffffff', boxShadow: '0 4px 10px rgba(249,115,22,0.4)', padding: '0.4rem 1rem', fontSize: '0.85rem'}}>
           <AlertTriangle size={16}/> Gemini Analyzer
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '1.5rem', minHeight: 0 }}>
        
        {/* Left Side: Chat UI */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', backgroundColor: '#fff' }}>
          {voiceError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '8px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 'bold', zIndex: 10 }}>
              {voiceError}
            </div>
          )}
          
          {/* Custom Premium Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 5, gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1rem', flexShrink: 0 }}>
              RA
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.2 }}>Ramesh</div>
              {/* Voice mode status indicator */}
              <div style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px',
                color: voiceMode === 'listening' ? '#10b981' : voiceMode === 'speaking' ? '#8b5cf6' : voiceMode === 'processing' ? '#f97316' : '#64748b' }}>
                {voiceMode === 'off'        && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} /> Victim Persona Active</>}
                {voiceMode === 'listening'  && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1s infinite' }} /> Listening — speak now…</>}
                {voiceMode === 'processing' && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f97316', display: 'inline-block', animation: 'pulse 1s infinite' }} /> Analyzing…</>}
                {voiceMode === 'speaking'   && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block', animation: 'pulse 1s infinite' }} /> Ramesh is speaking…</>}
              </div>
            </div>

            {/* Voice Mode Toggle Button */}
            <button
              onClick={toggleVoiceMode}
              title={voiceMode !== 'off' ? 'End voice call' : 'Start hands-free voice mode'}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s ease',
                background: voiceMode !== 'off'
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                boxShadow: voiceMode !== 'off'
                  ? '0 4px 12px rgba(239,68,68,0.4)'
                  : '0 4px 12px rgba(16,185,129,0.35)',
              }}
            >
              {voiceMode !== 'off'
                ? <><PhoneOff size={15} /> End Call</>
                : <><Phone size={15} /> Voice Call</>
              }
            </button>
          </div>

          {/* Voice mode full-width status banner */}
          {voiceMode !== 'off' && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '8px 16px',
              background: voiceMode === 'listening'  ? 'rgba(16,185,129,0.08)'
                        : voiceMode === 'speaking'   ? 'rgba(139,92,246,0.08)'
                        : 'rgba(249,115,22,0.08)',
              borderBottom: '1px solid',
              borderColor: voiceMode === 'listening'  ? 'rgba(16,185,129,0.2)'
                         : voiceMode === 'speaking'   ? 'rgba(139,92,246,0.2)'
                         : 'rgba(249,115,22,0.2)',
            }}>
              <Radio size={14} style={{
                color: voiceMode === 'listening' ? '#10b981' : voiceMode === 'speaking' ? '#8b5cf6' : '#f97316',
                animation: 'pulse 1s infinite'
              }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700,
                color: voiceMode === 'listening' ? '#065f46' : voiceMode === 'speaking' ? '#4c1d95' : '#7c2d12'
              }}>
                {voiceMode === 'listening'  && 'VOICE MODE ACTIVE — Speak your message. Ramesh will reply automatically.'}
                {voiceMode === 'processing' && 'PROCESSING — Sending your message to AI…'}
                {voiceMode === 'speaking'   && 'RAMESH SPEAKING — Mic is muted to prevent feedback. It will reopen automatically.'}
              </span>
            </div>
          )}
          
          {/* Custom Message List - Now includes the input bar at the bottom */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#ffffff' }}>
            {messages.map((m, i) => {
              const isOutgoing = m.direction === 'outgoing';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isOutgoing ? 'flex-end' : 'flex-start', width: '100%' }}>
                  <div style={{
                    maxWidth: '80%', padding: '12px 18px',
                    backgroundColor: isOutgoing ? '#2563eb' : '#f1f5f9',
                    color: isOutgoing ? '#ffffff' : '#1e293b',
                    borderRadius: '20px',
                    borderBottomRightRadius: isOutgoing ? '4px' : '20px',
                    borderBottomLeftRadius: isOutgoing ? '20px' : '4px',
                    fontSize: '0.95rem', lineHeight: '1.5',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                  }}>
                    {m.message}
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{
                  padding: '12px 18px', backgroundColor: '#f1f5f9', color: '#64748b',
                  borderRadius: '20px', borderBottomLeftRadius: '4px',
                  fontSize: '0.9rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <div className="typing-dot" style={{ width: 6, height: 6, backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></div>
                  <div className="typing-dot" style={{ width: 6, height: 6, backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
                  <div className="typing-dot" style={{ width: 6, height: 6, backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: voiceMode !== 'off' ? 'rgba(0,0,0,0.03)' : '#f8fafc', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '30px', marginTop: '10px', opacity: voiceMode === 'processing' || voiceMode === 'speaking' ? 0.5 : 1, transition: 'opacity 0.2s' }}>
              <button 
                onClick={voiceMode !== 'off' ? toggleVoiceMode : toggleListening}
                disabled={voiceMode === 'processing' || voiceMode === 'speaking'}
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none',
                  background: isListening || voiceMode === 'listening' ? '#ef4444' : '#e2e8f0',
                  color: isListening || voiceMode === 'listening' ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: voiceMode === 'processing' || voiceMode === 'speaking' ? 'not-allowed' : 'pointer',
                  marginRight: '12px', flexShrink: 0,
                  transition: 'all 0.2s ease',
                  animation: isListening || voiceMode === 'listening' ? 'pulse 1.5s infinite' : 'none'
                }}
              >
                {isListening || voiceMode === 'listening' ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              
              <input 
                type="text"
                placeholder={
                  voiceMode === 'listening'  ? '🎤 Listening… speak now' :
                  voiceMode === 'speaking'   ? '🔇 Mic muted — Ramesh is speaking' :
                  voiceMode === 'processing' ? '⏳ Processing…' :
                  isListening                ? 'Listening...' :
                  'Type message or click 📞 for voice call…'
                }
                value={inputText + (interimText ? (inputText ? ' ' : '') + interimText : '')}
                onChange={(e) => { if (voiceMode === 'off') setInputText(e.target.value); }}
                disabled={voiceMode !== 'off'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && voiceMode === 'off') {
                    e.preventDefault();
                    const fullText = (inputText + (interimText ? ' ' + interimText : '')).trim();
                    if (fullText) { handleSend(fullText); setInterimText(''); }
                  }
                }}
                style={{ flex: 1, height: '40px', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem', cursor: voiceMode !== 'off' ? 'default' : 'text' }}
              />
              
              <button 
                onClick={() => {
                  if (voiceMode !== 'off') return;
                  const fullText = (inputText + (interimText ? ' ' + interimText : '')).trim();
                  if (fullText) { handleSend(fullText); setInterimText(''); }
                }}
                disabled={voiceMode !== 'off' || (!inputText.trim() && !interimText.trim())}
                style={{ marginLeft: '12px', color: '#2563eb', border: 'none', background: 'none', cursor: 'pointer', opacity: voiceMode !== 'off' ? 0.3 : 1 }}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Scam Detection Visualizer */}
        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#000' }}>
            <ShieldAlert size={20} color={getScoreColor()} /> Live Analysis
          </h3>

          {/* Speedometer / Score */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Simple CSS ring */}
              <svg width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle cx="70" cy="70" r="60" fill="none" stroke={getScoreColor()} strokeWidth="12" strokeDasharray={`${(displayScore / 100) * 377} 377`} style={{ transition: 'stroke 0.5s ease' }} />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: getScoreColor() }}>{displayScore}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8, letterSpacing: '0.05em', color: '#000' }}>THREAT SCORE</span>
              </div>
            </div>
            <div style={{ marginTop: '1rem', fontWeight: 700, color: getScoreColor() }}>
              {displayScore > 70 ? 'CRITICAL THREAT' : displayScore > 40 ? 'SUSPICIOUS' : 'SAFE'}
            </div>
          </div>

          {/* Reasoning */}
          <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Info size={14} /> AI REASONING
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: 0, color: scamReasoning ? '#fff' : '#64748b' }}>
              {scamReasoning || 'Start chatting to see real-time AI analysis.'}
            </p>
          </div>

          {/* Flags */}
          {scamFlags && scamFlags.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.75rem' }}>DETECTED FLAGS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scamFlags.map((flag, idx) => (
                  <div key={idx} style={{ 
                    backgroundColor: flag.sev === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                    borderLeft: `3px solid ${flag.sev === 'high' ? '#ef4444' : '#f97316'}`,
                    padding: '0.75rem', borderRadius: '0 8px 8px 0'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: flag.sev === 'high' ? '#b91c1c' : '#c2410c' }}>{flag.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#000', opacity: 0.8, marginTop: '0.25rem' }}>{flag.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }
        /* ChatScope overrides for clean integration */
        .cs-message-input__content-editor { background: transparent !important; color: #333 !important; }
        .cs-message-input__content-editor-wrapper { background: transparent !important; }
        .cs-message--incoming .cs-message__content { background-color: #f1f5f9 !important; color: #1e293b !important; }
        .cs-message--outgoing .cs-message__content { background-color: #2563eb !important; color: #ffffff !important; }
      `}</style>
    </div>
  );
};

export default ScamIntent;

