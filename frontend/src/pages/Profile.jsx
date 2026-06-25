import { useState } from 'react';
import { Fingerprint, AlertTriangle, Activity, Eraser, Upload, ShieldCheck, Download, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = ({ name, phone, voiceHash, audioUrl }) => {
  const { logout } = useAuth();
  const [dewatermarkState, setDewatermarkState] = useState('idle'); // idle, processing, done, error
  const [dewatermarkUrl, setDewatermarkUrl] = useState(null);
  const [dewatermarkFilename, setDewatermarkFilename] = useState('');

  const handleDewatermark = async (audioFile) => {
    setDewatermarkState('processing');
    setDewatermarkUrl(null);
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      const notch = offlineCtx.createBiquadFilter();
      notch.type = 'notch';
      notch.frequency.value = 18000;
      notch.Q.value = 100;

      source.connect(notch);
      notch.connect(offlineCtx.destination);
      source.start();

      const rendered = await offlineCtx.startRendering();

      // Simple WAV export logic
      const numCh = rendered.numberOfChannels;
      const len = rendered.length;
      const wavBuffer = new ArrayBuffer(44 + len * numCh * 2);
      const view = new DataView(wavBuffer);
      const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
      writeStr(0, 'RIFF'); view.setUint32(4, 36 + len * numCh * 2, true);
      writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, numCh, true); view.setUint32(24, rendered.sampleRate, true);
      view.setUint32(28, rendered.sampleRate * numCh * 2, true);
      view.setUint16(32, numCh * 2, true); view.setUint16(34, 16, true);
      writeStr(36, 'data'); view.setUint32(40, len * numCh * 2, true);
      let offset = 44;
      const channels = Array.from({ length: numCh }, (_, i) => rendered.getChannelData(i));
      for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < numCh; ch++) {
          const s = Math.max(-1, Math.min(1, channels[ch][i]));
          view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
          offset += 2;
        }
      }
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const baseName = audioFile.name.replace(/\.[^.]+$/, '');
      setDewatermarkFilename(`${baseName}_clean.wav`);
      setDewatermarkUrl(url);
      setDewatermarkState('done');
    } catch (err) {
      console.error(err);
      setDewatermarkState('error');
    }
  };

  return (
    <div className="fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">My Profile</h2>
          <p className="text-sm">Manage your TrueVoice identity.</p>
        </div>
        <button 
          onClick={() => {
            logout();
            localStorage.removeItem('tv_profile');
            window.location.href = '/';
          }}
          className="btn btn-outline"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary bg-opacity-10 flex items-center justify-center text-primary font-bold text-2xl">
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h3 className="font-bold text-lg">{name || 'User'}</h3>
            <p className="text-sm text-secondary mb-0">{phone || 'No phone added'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-md font-bold mb-2 flex items-center gap-2">
          <Fingerprint size={20} className="text-primary" /> Master Voice Clip
        </h3>
        <p className="text-sm text-secondary mb-4">
          This clip contains your high-frequency cryptographic watermark.
        </p>

        {audioUrl ? (
          <div className="bg-surface p-4 rounded-md">
            <audio controls src={audioUrl} className="w-full mb-2" />
            <div className="badge badge-success mt-2">Hash: {voiceHash}</div>
          </div>
        ) : (
          <div className="bg-warning bg-opacity-10 text-warning p-4 rounded-md text-sm text-center">
            <AlertTriangle size={24} className="mx-auto mb-2" />
            <p>No master voice recorded yet. Please register your voice.</p>
          </div>
        )}
      </div>

      <div className="card" style={{ borderLeft: '4px solid #8b5cf6', background: 'linear-gradient(135deg, rgba(139,92,246,0.03), rgba(99,102,241,0.05))' }}>
        <h3 className="font-bold mb-1 flex items-center gap-2" style={{ color: '#7c3aed' }}>
          <Eraser size={18} /> Dewatermark Voice Clip
        </h3>
        <p className="text-sm text-secondary mb-4">
          Upload a watermarked audio file. TrueVoice applies a real <strong>18kHz notch filter</strong> to strip the cryptographic signature.
        </p>
        <label htmlFor="dewatermark-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '0.75rem 1.5rem', borderRadius: 12, cursor: 'pointer', marginBottom: '1rem', background: dewatermarkState === 'processing' ? '#f1f5f9' : 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: dewatermarkState === 'processing' ? '#94a3b8' : '#fff', fontWeight: 700, fontSize: '0.9rem', pointerEvents: dewatermarkState === 'processing' ? 'none' : 'auto', boxShadow: dewatermarkState === 'processing' ? 'none' : '0 4px 16px rgba(124,58,237,0.3)' }}>
          {dewatermarkState === 'processing' ? <><Activity size={16} /> Processing…</> : <><Upload size={16} /> Upload Audio to Dewatermark</>}
        </label>
        <input id="dewatermark-input" type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleDewatermark(e.target.files[0]); e.target.value = ''; } }} />
        {dewatermarkState === 'done' && dewatermarkUrl && (
          <div style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#065f46', marginBottom: '0.5rem' }}><ShieldCheck size={15} style={{ display: 'inline', marginRight: 6 }} />Watermark Removed — {dewatermarkFilename}</div>
            <a href={dewatermarkUrl} download={dewatermarkFilename} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', borderRadius: 10, textDecoration: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              <Download size={15} /> Download Clean Audio
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
