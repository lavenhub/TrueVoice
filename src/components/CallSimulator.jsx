import { useState, useRef, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import CallWaveform from './CallWaveform';

// ─── Pulse ring ────────────────────────────────────────────────────────────────
const PulseRing = ({ color = '#06b6d4', size = 120, active = false }) => (
  <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {active && [0, 1, 2].map(i => (
      <div key={i} style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `2px solid ${color}`,
        animation: `simPulse 2s ease-out ${i * 0.65}s infinite`,
        opacity: 0,
      }} />
    ))}
    <div style={{
      width: 80, height: 80, borderRadius: '50%',
      background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
      boxShadow: active ? `0 0 30px ${color}88` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2, transition: 'all 0.3s ease'
    }}>
       <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>R</span>
    </div>
    <style>{`@keyframes simPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}`}</style>
  </div>
);

const CallSimulator = ({ setCallsAnalyzed, setThreatsBlocked }) => {
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callError, setCallError] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [interimText, setInterimText] = useState('');

  // Scam
  const [scamScore, setScamScore] = useState(null);

  // Refs
  const [analyser, setAnalyser] = useState(null);
  const mediaStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const chatHistoryRef = useRef([]);
  const transcriptEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // CallActive ref to avoid stale closures in recognition events
  const callActiveRef = useRef(false);
  const callStatusRef = useRef('idle');

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript, interimText]);

  useEffect(() => {
    callActiveRef.current = callActive;
    callStatusRef.current = callStatus;
  }, [callActive, callStatus]);

  const addTranscript = useCallback((role, text) => {
    setTranscript(prev => [...prev, { role, text }]);
    chatHistoryRef.current.push({ role, text });
  }, []);

  const startCall = async () => {
    try {
      // Get audio stream for the visual waveform
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      setCallActive(true);
      setCallDuration(0);
      setTranscript([]);
      setInterimText('');
      setScamScore(null);
      chatHistoryRef.current = [];
      
      setCallStatus('user_speaking');
      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);

      startListening();

    } catch (error) {
      setCallError('Microphone access is required.');
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      setCallError('Speech recognition is not supported in this browser. Please use Google Chrome.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false; // Stop after a pause
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Good for Ramesh persona

    recognition.onresult = (event) => {
      let finalStr = '';
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }
      
      setInterimText(interimStr);
      
      if (finalStr) {
        setInterimText('');
        handleVoiceTurnDetected(finalStr);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'network') {
        if (callActiveRef.current && callStatusRef.current === 'user_speaking') {
          setTimeout(startListening, 500);
        }
      } else if (event.error === 'aborted') {
        // user clicked end call or manually aborted
      } else {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      // If recognition ends without a final result (e.g. timeout), restart if still active and waiting for user
      if (callActiveRef.current && callStatusRef.current === 'user_speaking') {
         startListening();
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch(e) {}
  };

  const handleVoiceTurnDetected = async (text) => {
    if (!text.trim()) {
      startListening();
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    setCallStatus('connecting');
    addTranscript('user', text);
    
    try {
      // Use the geminiLiveCall endpoint which expects transcribed text
      // Pass history excluding the message we just added
      const res = await api.geminiLiveCall(text, chatHistoryRef.current.slice(0, -1));
      
      if (typeof res.scamScore === 'number') {
        setScamScore(res.scamScore);
      }
      
      const aiReply = res.reply || "I didn't quite understand that.";
      addAiTextResponse(aiReply);

    } catch (error) {
      console.error("API error", error);
      addTranscript('clone', "Sorry, I encountered a network error.");
      setCallStatus('user_speaking');
      startListening();
    }
  };

  const addAiTextResponse = (text) => {
    addTranscript('clone', text);
    setCallStatus('ai_responding');
    
    if (synthRef.current && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN'; 
      
      const voices = synthRef.current.getVoices();
      const voice = voices.find(v => v.lang.includes('en') && v.name.includes('Male')) || voices[0];
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        if (callActiveRef.current) {
            setCallStatus('user_speaking');
            startListening();
        }
      };
      
      utterance.onerror = () => {
        if (callActiveRef.current) {
            setCallStatus('user_speaking');
            startListening();
        }
      };

      synthRef.current.cancel(); // Fix stuck voices in Chrome
      synthRef.current.speak(utterance);
    } else {
      setTimeout(() => {
        if (callActiveRef.current) {
            setCallStatus('user_speaking');
            startListening();
        }
      }, 2000);
    }
  };

  const endCall = () => {
    setCallActive(false);
    setCallStatus('idle');
    clearInterval(callTimerRef.current);
    
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch(e) {}
    }
    if (synthRef.current) synthRef.current.cancel();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    setAnalyser(null);
    
    if (setCallsAnalyzed) setCallsAnalyzed(p => p + 1);
    if (scamScore > 70 && setThreatsBlocked) setThreatsBlocked(p => p + 1);
  };

  const formatTime = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const getStatusColor = () => {
    if (scamScore === null) return '#64748b';
    if (scamScore > 70) return '#ef4444';
    if (scamScore > 40) return '#f97316';
    return '#10b981';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', color: '#fff' }}>
      {!callActive ? (
        <div style={{ textAlign: 'center', maxWidth: 450 }}>
          {callError && <div style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 'bold' }}>{callError}</div>}
          <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
            <PulseRing active={false} size={100} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>Call Ramesh</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Experience a secure, AI-monitored phone call. Speak naturally, and TrueVoice will transcribe and analyze your conversation for scam intent in real-time.
          </p>
          <button onClick={startCall} style={{
            background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)', border: 'none', padding: '1rem 3rem',
            borderRadius: 99, color: '#fff', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(6,182,212,0.3)', transition: 'transform 0.2s'
          }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
            Start Secure Call
          </button>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>LIVE CALL: {formatTime(callDuration)}</span>
             </div>
             <div style={{ 
               padding: '4px 12px', borderRadius: 99, background: `${getStatusColor()}20`, 
               border: `1px solid ${getStatusColor()}40`, color: getStatusColor(), fontSize: '0.75rem', fontWeight: 800,
               display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.3s ease'
             }}>
               {scamScore > 70 ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />} 
               SECURITY: {scamScore === null ? 'ANALYZING' : scamScore > 70 ? 'SCAM FLAGGED' : 'SECURE'}
             </div>
          </div>

          {/* Central Call Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <PulseRing active={callActive} color={scamScore > 70 ? '#ef4444' : '#06b6d4'} />
             <h3 style={{ marginTop: '1.5rem', fontSize: '1.5rem', fontWeight: 800 }}>Ramesh</h3>
             <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                {callStatus === 'ai_responding' ? 'Ramesh is speaking...' : callStatus === 'connecting' ? 'Processing...' : 'Listening...'}
             </p>
             
             <div style={{ width: '100%', height: 60, marginTop: '2rem' }}>
                <CallWaveform analyserNode={analyser} isActive={callStatus === 'user_speaking'} color={scamScore > 70 ? '#ef4444' : '#06b6d4'} />
             </div>
          </div>

          {/* Conversation Log (Subtitles Style) */}
          <div style={{ 
            height: 140, overflowY: 'auto', padding: '1rem', background: 'rgba(0,0,0,0.2)', 
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', marginBottom: '2rem',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
             {transcript.map((msg, i) => (
               <div key={i} style={{ fontSize: '0.85rem', color: msg.role === 'user' ? '#06b6d4' : '#c4b5fd', fontWeight: 500 }}>
                 <span style={{ opacity: 0.6 }}>{msg.role === 'user' ? 'You: ' : 'Ramesh: '}</span>{msg.text}
               </div>
             ))}
             {interimText && <div style={{ fontSize: '0.85rem', color: '#06b6d4', opacity: 0.5, fontStyle: 'italic' }}>{interimText}</div>}
             <div ref={transcriptEndRef} />
          </div>

          {/* Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', paddingBottom: '2rem' }}>
             <button onClick={() => {
               setIsMuted(!isMuted);
               if (!isMuted && recognitionRef.current) {
                 try { recognitionRef.current.abort(); } catch(e) {}
               } else if (isMuted && callStatus === 'user_speaking') {
                 startListening();
               }
             }} style={{ 
               width: 60, height: 60, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', 
               color: isMuted ? '#ef4444' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
             }}>
               {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
             </button>
             <button onClick={endCall} style={{ 
               width: 60, height: 60, borderRadius: '50%', border: 'none', background: '#ef4444', 
               color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
               boxShadow: '0 8px 20px rgba(239,68,68,0.3)'
             }}>
               <PhoneOff size={24} />
             </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default CallSimulator;

