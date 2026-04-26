import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Bot } from 'lucide-react';
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

const VoiceAssistant = () => {
  const [messages, setMessages] = useState([
    { message: "Hello! I am Ramesh. How can I help you today?", sender: "Ramesh", direction: "incoming" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  
  const recognitionRef = useRef(null);

  // Initialize Web Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError('');
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
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
      };

      recognition.onend = () => setIsListening(false);
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
      // Map back to our backend payload format
      const historyPayload = newMessages.slice(0, -1).map(m => ({
        role: m.direction === 'incoming' ? 'clone' : 'user',
        text: m.message
      }));

      const res = await api.geminiLiveCall(textToSend, historyPayload);
      const aiReply = res.reply || "I didn't quite catch that.";
      setMessages(prev => [...prev, { message: aiReply, sender: "Ramesh", direction: "incoming" }]);
    } catch (error) {
      console.error("API error", error);
      setMessages(prev => [...prev, { message: "Sorry, I encountered an error connecting to the AI.", sender: "System", direction: "incoming" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ height: '100%', maxWidth: '800px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
      {recognitionError && (
        <div style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 'bold', textAlign: 'center' }}>
          {recognitionError}
        </div>
      )}
      
      <div style={{ flex: 1, overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <MainContainer>
          <ChatContainer>
            <ConversationHeader style={{ backgroundColor: '#f8fafc' }}>
              <Avatar src="https://ui-avatars.com/api/?name=Ramesh&background=8b5cf6&color=fff" name="Ramesh" />
              <ConversationHeader.Content userName="Ramesh" info="Active now" />
            </ConversationHeader>
            
            <MessageList 
              typingIndicator={isTyping ? <TypingIndicator content="Ramesh is typing" /> : null}
              style={{ backgroundColor: '#ffffff' }}
            >
              {messages.map((m, i) => (
                <Message key={i} model={{
                  message: m.message,
                  sender: m.sender,
                  direction: m.direction,
                  position: "single"
                }} />
              ))}
            </MessageList>
            
            <div as="MessageInput" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px' }}>
              <button 
                onClick={toggleListening}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: isListening ? '#ef4444' : '#e2e8f0',
                  color: isListening ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', marginRight: '10px', flexShrink: 0,
                  transition: 'all 0.2s ease', animation: isListening ? 'pulse 1.5s infinite' : 'none'
                }}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              
              <MessageInput 
                placeholder="Type message or click mic to voice-type..." 
                value={inputText}
                onChange={(val) => setInputText(val)}
                onSend={handleSend}
                attachButton={false}
                style={{ flex: 1, border: 'none', backgroundColor: 'transparent' }}
              />
            </div>
          </ChatContainer>
        </MainContainer>
      </div>

      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }
        /* Make sure ChatScope doesn't look weird inside our dark UI */
        .cs-message-input__content-editor { background: #fff !important; color: #333 !important; }
        .cs-message--incoming .cs-message__content { background-color: #f1f5f9 !important; color: #1e293b !important; }
        .cs-message--outgoing .cs-message__content { background-color: #2563eb !important; color: #ffffff !important; }
      `}</style>
    </div>
  );
};

export default VoiceAssistant;
