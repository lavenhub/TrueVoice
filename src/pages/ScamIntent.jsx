import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, AlertTriangle, ShieldCheck, ShieldAlert, Info, Send } from 'lucide-react';
import { api } from '../services/api';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { 
  MainContainer, 
  ChatContainer, 
  MessageList, 
  Message, 
  MessageInput, 
  TypingIndicator,
  ConversationHeader,
  Avatar
} from '@chatscope/chat-ui-kit-react';

const ScamIntent = ({ setCallsAnalyzed, setThreatsBlocked }) => {
  const [messages, setMessages] = useState([
    { message: "Hello! I am Ramesh. How can I help you today?", sender: "Ramesh", direction: "incoming" }
  ]);
  const [inputText, setInputText] = useState('');
  const [interimText, setInterimText] = useState(''); // NEW: Real-time speech preview
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  
  // Scam visualization state
  const [scamScore, setScamScore] = useState(0);
  const [scamReasoning, setScamReasoning] = useState('');
  const [scamFlags, setScamFlags] = useState([]);
  
  const recognitionRef = useRef(null);

  // Initialize Web Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Using Indian English to match Ramesh persona

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError('');
        setInterimText('');
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let currentInterim = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        
        // Update the real-time preview instantly
        setInterimText(currentInterim);

        if (finalTranscript) {
          setInputText(prev => (prev + ' ' + finalTranscript).trim());
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== 'aborted') {
          setRecognitionError('Microphone error: ' + event.error);
        }
        setIsListening(false);
        setInterimText('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setRecognitionError('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Could not start recognition:", e);
      }
    }
  };

  const handleSend = async (textContent) => {
    const textToSend = textContent.trim();
    if (!textToSend) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Add user message to UI
    const newMessages = [...messages, { message: textToSend, sender: "You", direction: "outgoing" }];
    setMessages(newMessages);
    setInputText('');
    setIsTyping(true);

    try {
      const historyPayload = newMessages.slice(0, -1).map(m => ({
        role: m.direction === 'incoming' ? 'clone' : 'user',
        text: m.message
      }));

      const res = await api.geminiLiveCall(textToSend, historyPayload);
      
      const aiReply = res.reply || "I didn't quite catch that.";
      setMessages(prev => [...prev, { message: aiReply, sender: "Ramesh", direction: "incoming" }]);
      
      // NEW: Voice Out Loud (TTS)
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(aiReply);
        const voices = window.speechSynthesis.getVoices();
        // Try to find a male Indian English voice to match Ramesh
        const preferredVoice = voices.find(v => v.lang.includes('IN') && v.name.includes('Male')) || 
                               voices.find(v => v.lang.includes('IN')) ||
                               voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 0.9; // Slightly slower for an elderly persona
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
      setMessages(prev => [...prev, { message: "Sorry, I encountered an error connecting to the AI.", sender: "System", direction: "incoming" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const [tempKey, setTempKey] = useState('');
  const [isKeyEntered, setIsKeyEntered] = useState(false);

  const getScoreColor = () => {
    if (scamScore > 70) return '#ef4444'; // Red
    if (scamScore > 40) return '#f97316'; // Orange
    return '#10b981'; // Green
  };

  if (!isKeyEntered) {
    return (
      <div className="fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fff', padding: '2.5rem', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
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
          {recognitionError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '8px', fontSize: '0.85rem', textAlign: 'center', fontWeight: 'bold', zIndex: 10 }}>
              {recognitionError}
            </div>
          )}
          
          {/* Custom Premium Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 5 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1rem', marginRight: '12px' }}>
              RA
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.2 }}>Ramesh</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>Victim Persona Active</div>
            </div>
          </div>
          
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

            {/* Input Bar moved INSIDE the scrollable area so it follows the last reply */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '30px', marginTop: '10px' }}>
              <button 
                onClick={toggleListening}
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none',
                  background: isListening ? '#ef4444' : '#e2e8f0',
                  color: isListening ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', marginRight: '12px', flexShrink: 0,
                  transition: 'all 0.2s ease', animation: isListening ? 'pulse 1.5s infinite' : 'none'
                }}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              
              <input 
                type="text"
                placeholder={isListening ? "Listening..." : "Type message..."}
                value={inputText + (interimText ? (inputText ? ' ' : '') + interimText : '')}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const fullText = (inputText + (interimText ? ' ' + interimText : '')).trim();
                    if (fullText) { handleSend(fullText); setInterimText(''); }
                  }
                }}
                style={{ flex: 1, height: '40px', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem' }}
              />
              
              <button 
                onClick={() => {
                  const fullText = (inputText + (interimText ? ' ' + interimText : '')).trim();
                  if (fullText) { handleSend(fullText); setInterimText(''); }
                }}
                disabled={!inputText.trim() && !interimText.trim()}
                style={{ marginLeft: '12px', color: '#2563eb', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Scam Detection Visualizer */}
        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
            <ShieldAlert size={20} color={getScoreColor()} /> Live Analysis
          </h3>

          {/* Speedometer / Score */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Simple CSS ring */}
              <svg width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle cx="70" cy="70" r="60" fill="none" stroke={getScoreColor()} strokeWidth="12" strokeDasharray={`${(scamScore / 100) * 377} 377`} style={{ transition: 'stroke-dasharray 1s ease-out, stroke 0.5s ease' }} />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: getScoreColor() }}>{scamScore}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6, letterSpacing: '0.05em', color: '#fff' }}>THREAT SCORE</span>
              </div>
            </div>
            <div style={{ marginTop: '1rem', fontWeight: 700, color: getScoreColor() }}>
              {scamScore > 70 ? 'CRITICAL THREAT' : scamScore > 40 ? 'SUSPICIOUS' : 'SAFE'}
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
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: flag.sev === 'high' ? '#fca5a5' : '#fdba74' }}>{flag.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#fff', opacity: 0.8, marginTop: '0.25rem' }}>{flag.detail}</div>
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

