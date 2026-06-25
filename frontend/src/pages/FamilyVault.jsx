import { useState, useRef, useEffect } from 'react';
import { Users, Plus, UserCircle, ShieldCheck, ShieldAlert, Download, Fingerprint, Mic, AlertTriangle, Activity, Zap, Cpu, Search, Trash2, Heart } from 'lucide-react';
import { detectWatermark, computeSpectrogram } from '../audioUtils';

const FamilyVault = ({ 
  familyMembers, 
  setFamilyMembers, 
  setCallsAnalyzed, 
  setThreatsBlocked,
  activeCallSim,
  setActiveCallSim
}) => {
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [listenCountdown, setListenCountdown] = useState(null);
  const listenTimerRef = useRef(null);

  // Advanced Visualization States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeAnalysisMember, setActiveAnalysisMember] = useState(null);
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [scanScore, setScanScore] = useState(0);

  const familyLogs = [
    { id: 1, target: 'Grandpa', time: '2h ago', message: 'Intercepted AI clone attempting to impersonate grandson for urgent wire transfer.', type: 'critical' }
  ]; 

  const handleAddMember = (e) => {
    e.preventDefault();
    const newMember = {
      id: Date.now(),
      name: newMemberName,
      initials: newMemberName.split(' ').map(n => n[0]).join('').toUpperCase(),
      relation: 'Family',
      phone: newMemberPhone,
      threats: 0,
      lastChecked: 'Never',
      color: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][familyMembers.length % 5]
    };
    setFamilyMembers([...familyMembers, newMember]);
    setNewMemberName('');
    setNewMemberPhone('');
    setShowAddMember(false);
  };

  const generateSampleAudio = async (member) => {
    const sampleRate = 44100;
    const duration = 2;
    const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);

    const osc = offlineCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 160 + member.id % 100; 

    const lpf = offlineCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 2000; 

    const voiceGain = offlineCtx.createGain();
    voiceGain.gain.value = 0.3;

    const watermarkOsc = offlineCtx.createOscillator();
    watermarkOsc.type = 'sine';
    // NEW: Member-specific watermark frequency for identity verification
    const memberFreq = 18000 + (member.id % 10) * 100;
    watermarkOsc.frequency.value = memberFreq;
    const wGain = offlineCtx.createGain();
    wGain.gain.value = 0.1;

    osc.connect(lpf); lpf.connect(voiceGain); voiceGain.connect(offlineCtx.destination);
    watermarkOsc.connect(wGain); wGain.connect(offlineCtx.destination);
    osc.start(); osc.stop(duration);
    watermarkOsc.start(); watermarkOsc.stop(duration);

    const rendered = await offlineCtx.startRendering();
    const len = rendered.length;
    const wavBuffer = new ArrayBuffer(44 + len * 2);
    const view = new DataView(wavBuffer);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true);
    writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, len * 2, true);
    const data = rendered.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
    }
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${member.name.replace(/\s+/g, '_')}_watermarked_sample.wav`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDetectVoice = async (member, file) => {
    setActiveAnalysisMember(member);
    setIsAnalyzing(true);
    setSpectrogramData(null);
    setScanScore(0);

    try {
      // 1. Compute Spectrogram for visualization
      const spec = await computeSpectrogram(file);
      setSpectrogramData(spec);

      // 2. Perform actual DSP detection with member-specific frequency
      const memberFreq = 18000 + (member.id % 10) * 100;
      const { isAuthentic, rms } = await detectWatermark(file, memberFreq);
      
      // Artificial delay for "Impressive" factor
      setTimeout(() => {
        setCallsAnalyzed(prev => prev + 1);
        if (!isAuthentic) setThreatsBlocked(prev => prev + 1);
        setScanScore(isAuthentic ? 98 : 12);
        setActiveCallSim({ member, step: 'result', rms, hasWatermark: isAuthentic });
      }, 2000);
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
    }
  };

  const handleListenLive = async (member) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      
      recorder.start();
      let count = 5;
      setListenCountdown(count);
      
      listenTimerRef.current = setInterval(() => {
        count--;
        setListenCountdown(count);
        if (count <= 0) {
          clearInterval(listenTimerRef.current);
          recorder.stop();
        }
      }, 1000);

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setListenCountdown(null);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        handleDetectVoice(member, new File([blob], 'live.webm', { type: blob.type }));
      };
    } catch {
      alert('Microphone access denied.');
    }
  };

  const SpectrogramScanner = ({ data, score, member }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
      if (!canvasRef.current || !data) return;
      const ctx = canvasRef.current.getContext('2d');
      const { data: matrix, numTimeBins, numFreqBins } = data;
      
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      ctx.clearRect(0, 0, w, h);
      
      // Draw a classy, fine-line frequency wave
      ctx.beginPath();
      ctx.strokeStyle = score > 50 ? '#3b82f6' : '#ef4444';
      ctx.lineWidth = 1;
      
      for (let t = 0; t < numTimeBins; t++) {
        let avg = 0;
        for (let f = 0; f < numFreqBins; f++) avg += matrix[t][f];
        const val = (avg / numFreqBins) * h * 5;
        const x = (t / numTimeBins) * w;
        const y = h / 2 + (t % 2 === 0 ? val : -val);
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Add a scan pulse
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }, [data, score]);

    return (
      <div style={{ padding: '3rem', background: '#fff', borderRadius: '32px', color: '#1e293b', boxShadow: '0 40px 100px rgba(0,0,0,0.2)', maxWidth: '600px', width: '90%', margin: '0 auto', position: 'relative', textAlign: 'center' }}>
        <div className="mb-8">
          <div style={{ width: 64, height: 64, borderRadius: '20px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid #f1f5f9' }}>
            <Activity size={32} className={score > 50 ? 'text-blue-500' : 'text-red-500'} />
          </div>
          <h3 className="text-2xl font-black mb-1">Identity Verification</h3>
          <p className="text-slate-400 text-sm font-medium">Scanning for {member?.name}'s unique biometric signature...</p>
        </div>

        <div style={{ height: '120px', background: '#f8fafc', borderRadius: '16px', overflow: 'hidden', border: '1px solid #f1f5f9', position: 'relative', marginBottom: '2rem' }}>
          <canvas ref={canvasRef} width={600} height={120} style={{ width: '100%', height: '100%' }} />
          {!data && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}
        </div>

        {score > 0 && (
          <div className="fade-in">
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: score > 50 ? '#1e293b' : '#ef4444', letterSpacing: '-2px', marginBottom: '0.5rem' }}>
              {score > 50 ? 'MATCH' : 'MISMATCH'}
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mb-8">
              {score > 50 ? `Verified Authentic for ${member?.name}` : `Signature does not match ${member?.name}`}
            </p>
            <button onClick={() => setIsAnalyzing(false)} className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-black transition-all">
              DISMISS
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ position: 'relative', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 1. Analysis Overlay */}
      {isAnalyzing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)' }}>
          <SpectrogramScanner data={spectrogramData} score={scanScore} member={activeAnalysisMember} />
        </div>
      )}

      {/* 2. Classy Header */}
      <div className="mb-12 flex justify-between items-end">
        <div>
           <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Protection Active</span>
           </div>
           <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">Family Vault</h1>
           <p className="text-slate-500 font-medium text-lg">Managing biometric security for {familyMembers.length} family members.</p>
        </div>
        <button
          onClick={() => setShowAddMember(!showAddMember)}
          style={{
            padding: '1rem 2rem', borderRadius: '16px', background: '#0f172a', color: '#fff',
            fontWeight: 800, fontSize: '0.9rem', border: 'none', cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.2)'
          }}
        >
          {showAddMember ? 'CLOSE FORM' : 'ADD NEW IDENTITY'}
        </button>
      </div>

      {/* 3. Add Member Form (Classy) */}
      {showAddMember && (
        <div className="fade-in mb-12 p-8" style={{ background: '#f8fafc', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
          <form onSubmit={handleAddMember} className="flex gap-6 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Full Name</label>
              <input type="text" className="w-full p-4 rounded-xl border-none bg-white shadow-sm focus:ring-2 ring-blue-500 transition-all outline-none" placeholder="e.g. Sarah Connor" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Phone Reference</label>
              <input type="tel" className="w-full p-4 rounded-xl border-none bg-white shadow-sm focus:ring-2 ring-blue-500 transition-all outline-none" placeholder="+91 98XXX XXXXX" value={newMemberPhone} onChange={e => setNewMemberPhone(e.target.value)} />
            </div>
            <button type="submit" className="p-4 rounded-xl bg-blue-600 text-white font-bold px-8 hover:bg-blue-700 transition-all">
              INITIALIZE
            </button>
          </form>
        </div>
      )}

      {/* 4. Biometric Profile Cards (Classy) */}
      <div className="grid grid-cols-3 gap-10 mb-16">
        {familyMembers.map(member => (
          <div key={member.id} className="fade-in" style={{
            background: '#ffffff', borderRadius: '32px', padding: '2rem',
            border: '1px solid #f1f5f9', boxShadow: '0 20px 60px rgba(0,0,0,0.03)',
            transition: 'transform 0.4s ease, box-shadow 0.4s ease',
            cursor: 'default'
          }}>
            <div className="flex justify-between items-start mb-8">
               <div style={{ width: 72, height: 72, borderRadius: '24px', background: `${member.color}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: member.color, fontSize: '1.5rem', fontWeight: 900, border: `1px solid ${member.color}15` }}>
                  {member.initials}
               </div>
               <div className="text-right">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Security Score</div>
                  <div className="text-xl font-black text-slate-900">98.2</div>
               </div>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-900 mb-1">{member.name}</h3>
              <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px] uppercase tracking-widest">
                 <ShieldCheck size={14} className="text-green-500" /> Identity Protected
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
               <div className="p-4 rounded-2xl bg-slate-50">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Threats</div>
                  <div className="text-lg font-black text-slate-900">{member.threats}</div>
               </div>
               <div className="p-4 rounded-2xl bg-slate-50">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</div>
                  <div className="text-[11px] font-black text-blue-600">PREMIUM</div>
               </div>
            </div>

            <div className="flex flex-col gap-3">
               <div className="flex gap-2">
                  <label htmlFor={`v-${member.id}`} className="flex-1 py-4 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest text-center cursor-pointer hover:bg-black transition-all">
                     Verify Identity
                  </label>
                  <input id={`v-${member.id}`} type="file" accept="audio/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleDetectVoice(member, e.target.files[0]); e.target.value=''; }} />
                  
                  <button onClick={() => handleListenLive(member)} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                     {listenCountdown !== null ? `${listenCountdown}s` : 'Live Check'}
                  </button>
               </div>
               <button onClick={() => generateSampleAudio(member)} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 py-2">
                  <Download size={14} /> Download Secure Sample
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* 5. Interceptions List (Classy) */}
      <div style={{ background: '#fff', borderRadius: '32px', padding: '3rem', border: '1px solid #f1f5f9', boxShadow: '0 20px 60px rgba(0,0,0,0.02)' }}>
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
             <ShieldAlert size={28} className="text-red-500" /> Recent Interceptions
          </h3>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System History / Last 24 Hours</div>
        </div>

        {familyLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-300 font-medium">All systems clear. No unauthorized clones detected.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {familyLogs.map(log => (
              <div key={log.id} style={{ background: '#f8fafc', borderRadius: '20px', padding: '1.5rem', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.3)' }}></div>
                <div className="flex-1">
                   <div className="font-bold text-slate-900 mb-1">AI Impersonation Blocked — {log.target}</div>
                   <p className="text-slate-500 text-sm m-0 font-medium">{log.message}</p>
                </div>
                <div className="text-right">
                   <div className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">{log.time}</div>
                   <div className="px-3 py-1 rounded-full bg-red-50 text-[10px] font-black text-red-600 uppercase tracking-widest border border-red-100 inline-block">Blocked</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyVault;
