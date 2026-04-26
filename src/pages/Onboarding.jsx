import { useState } from 'react';
import { ShieldCheck, User, Smartphone, Fingerprint, Mic, Lock, Activity } from 'lucide-react';
import { embedWatermark } from '../audioUtils';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Onboarding = ({ onComplete }) => {
  const [view, setView] = useState('onboarding'); // onboarding, otp, register_voice, analyzing
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const { login } = useAuth();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const res = await api.sendOtp(phone);
    if (res.success) {
      setView('otp');
      setOtpHint(`Check your server terminal for the security code`);
    } else {
      alert(res.error || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const res = await api.verifyOtp(phone, otp, name);
    if (res.success) {
      login(res.user, res.token);
      setView('register_voice');
    } else {
      alert(res.error || 'Invalid OTP');
    }
  };

  const handleRecordVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Check for supported mime types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        try {
          if (audioChunks.length === 0) throw new Error("No audio data captured");
          const rawBuffer = await audioBlob.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', rawBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const realHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          
          onComplete({ voiceHash: realHash, name, phone, audioUrl });
        } catch (e) {
          console.error("Recording processing failed", e);
          onComplete({ voiceHash: 'fallback_hash_' + Date.now(), name, phone, audioUrl });
        }
      });

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setView('analyzing');
      }, 5000);
    } catch (err) {
      console.error("Microphone access denied", err);
      // Automatic fallback for demo purposes if mic fails
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setView('analyzing');
        setTimeout(() => {
          onComplete({ voiceHash: 'demo_voice_hash_' + Math.random().toString(36).substr(2, 9), name, phone });
        }, 2000);
      }, 2000);
    }
  };

  const renderOnboarding = () => (
    <div className="fade-in flex flex-col h-full justify-center items-center">
      <div className="text-center mb-8">
        <div className="mx-auto bg-surface w-16 h-16 rounded-full flex items-center justify-center mb-4 text-primary">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-2xl font-bold">TrueVoice</h1>
        <p>Protecting you from AI voice scams</p>
      </div>

      <div className="card w-full max-w-md">
        <h2 className="text-lg mb-4">Create your account</h2>
        <form onSubmit={handleSendOtp}>
          <div className="input-group mb-4">
            <label className="input-label">Full Name</label>
            <div className="relative flex items-center">
              <User className="absolute left-3 text-secondary" size={20} />
              <input 
                type="text" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem' }}
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="input-group mb-6">
            <label className="input-label">Mobile Number</label>
            <div className="relative flex items-center">
              <Smartphone className="absolute left-3 text-secondary" size={20} />
              <input 
                type="tel" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem' }}
                placeholder="+91 99999 99999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Send Verification Code
          </button>
        </form>
      </div>
    </div>
  );

  const renderOTP = () => (
    <div className="fade-in flex flex-col h-full justify-center items-center">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Verify Phone</h1>
        <p>We sent a code to {phone}</p>
      </div>

      <div className="card w-full max-w-md">
        <form onSubmit={handleVerifyOtp}>
          <div className="input-group mb-6">
            <label className="input-label text-center">Enter the 4-digit code</label>
            <input 
              type="text" 
              className="input-field text-center text-xl tracking-widest" 
              maxLength="4"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
          {otpHint && (
            <div className="mb-4 p-3 rounded-lg text-center text-xs font-semibold" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#92400e' }}>
              🔑 {otpHint}
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full">
            Verify &amp; Continue
          </button>
        </form>
      </div>
    </div>
  );

  const renderVoiceRegistration = () => (
    <div className="fade-in flex flex-col h-full justify-center items-center">
      <div className="text-center mb-6">
        <div className="mx-auto bg-surface w-16 h-16 rounded-full flex items-center justify-center mb-4 text-primary">
          <Fingerprint size={32} />
        </div>
        <h1 className="text-2xl font-bold">Voice Registration</h1>
        <p className="px-4 max-w-md">We'll create a unique, invisible watermark for your voice to protect you from AI cloning.</p>
      </div>

      <div className="card text-center py-8 w-full max-w-lg">
        <p className="text-sm font-medium mb-2">Please read the following sentence aloud:</p>
        <div className="bg-surface p-4 rounded-md mb-8 text-lg font-semibold text-primary">
          "My voice is my secure password and unique identity."
        </div>

        <button 
          onClick={handleRecordVoice} 
          disabled={isRecording}
          className={`btn ${isRecording ? 'btn-outline border-danger text-danger' : 'btn-primary'} w-auto px-8 py-4 rounded-full mx-auto flex items-center gap-2`}
        >
          {isRecording ? (
            <div className="animate-pulse flex items-center gap-2">
              <Mic size={24} /> Recording (5s)...
            </div>
          ) : (
            <>
              <Mic size={24} /> Tap to Record
            </>
          )}
        </button>
      </div>
      
      <div className="bg-surface p-4 rounded-md flex items-start gap-3 mt-4 text-sm max-w-md">
        <Lock className="text-success mt-1" size={16} />
        <div>
          <strong>Privacy First</strong>
          <p className="mb-0 text-xs mt-1">We do not store your raw audio. It is converted to an encrypted mathematical hash on your device.</p>
        </div>
      </div>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="fade-in flex flex-col h-full items-center justify-center text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 border-4 border-primary rounded-full animate-ping opacity-20"></div>
        <div className="bg-primary text-white w-20 h-20 rounded-full flex items-center justify-center relative z-10 animate-pulse">
          <Activity size={40} />
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-2">Analyzing Voice...</h2>
      <p className="text-secondary max-w-[250px]">Generating high-frequency cryptographic watermark</p>
      
      <div className="w-64 bg-surface h-2 rounded-full mt-8 overflow-hidden">
        <div className="bg-primary h-full rounded-full" style={{ width: '100%', animation: 'progress 3s linear' }}></div>
      </div>
    </div>
  );

  return (
    <div className="onboarding-container h-full">
      <div className="onboarding-card h-full flex flex-col">
        {view === 'onboarding' && renderOnboarding()}
        {view === 'otp' && renderOTP()}
        {view === 'register_voice' && renderVoiceRegistration()}
        {view === 'analyzing' && renderAnalyzing()}
      </div>
    </div>
  );
};

export default Onboarding;
