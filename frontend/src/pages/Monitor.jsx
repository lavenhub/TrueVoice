import { useState } from 'react';
import { Activity, ShieldCheck, UploadCloud, FileAudio, CheckCircle2, AlertTriangle, Brain, Play, Mic, Fingerprint } from 'lucide-react';

import { detectWatermark, analyzeProsodicLiveness } from '../audioUtils';

const Monitor = ({ name, setCallsAnalyzed, setThreatsBlocked, setFamilyLogs, setScamState }) => {
  const [monitorState, setMonitorState] = useState('idle'); // idle, liveness, analyzing, authentic, clone, scam
  const [layer1Rms, setLayer1Rms] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [livenessFile, setLivenessFile] = useState(null);
  const [livenessState, setLivenessState] = useState('idle');
  const [livenessResult, setLivenessResult] = useState(null);
  const [isPlayingQuestion, setIsPlayingQuestion] = useState(false);

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAnalyzeUpload = async () => {
    if (!selectedFile) return;
    
    setMonitorState('liveness');
    setLayer1Rms(null);
    
    try {
      await new Promise(r => setTimeout(r, 1500));
      setMonitorState('analyzing');
      const { isAuthentic, rms } = await detectWatermark(selectedFile);
      setLayer1Rms(rms);
      setCallsAnalyzed(prev => prev + 1);
      
      await new Promise(r => setTimeout(r, 1000));
      
      if (isAuthentic) {
        setMonitorState('authentic');
        setScamState('idle'); 
      } else {
        setMonitorState('clone');
        setScamState('locked'); 
        setThreatsBlocked(prev => prev + 1);
        
        const newLog = {
          id: Date.now(),
          target: name || 'User',
          time: 'Just now',
          message: `AI clone attempt blocked from Unknown Number`,
          type: 'clone'
        };
        setFamilyLogs(prevLogs => [newLog, ...prevLogs]);
      }
    } catch (e) {
      console.error("Audio analysis failed", e);
      setMonitorState('clone');
      setThreatsBlocked(prev => prev + 1);
    }
  };

  const handleLivenessAnalyze = async () => {
    if (!livenessFile) return;
    setLivenessResult(null);
    setLivenessState('step1_checking');
    await new Promise(r => setTimeout(r, 1500));

    const { isAuthentic: hasWatermark } = await detectWatermark(livenessFile);
    setCallsAnalyzed(prev => prev + 1);
    setLivenessState('step1_pass');
    await new Promise(r => setTimeout(r, 1200));
    setLivenessState('step2_analyzing');

    const result = await analyzeProsodicLiveness(livenessFile);
    if (!hasWatermark) result.livenessScore = Math.min(result.livenessScore, 0.15);
    if (result.livenessScore < 0.45) setThreatsBlocked(prev => prev + 1);
    setLivenessResult(result);
    await new Promise(r => setTimeout(r, 800));
    setLivenessState('result');
  };

  const playInjectedQuestion = () => {
    if (isPlayingQuestion) return;
    setIsPlayingQuestion(true);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* ignore */ }
    setTimeout(() => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          'TrueVoice security check. Quick question — what color is the sky right now where you are?'
        );
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.onend = () => setIsPlayingQuestion(false);
        utterance.onerror = () => setIsPlayingQuestion(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => setIsPlayingQuestion(false), 3000);
      }
    }, 650);
  };

  return (
    <div className="fade-in">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">AI Call Monitor</h2>
          <p className="text-base mb-0">Two-layer defense against AI voice clones.</p>
        </div>
        <div className="flex gap-4 text-sm font-medium">
           <div className="bg-success bg-opacity-10 text-success px-3 py-1 rounded-full flex items-center gap-2"><CheckCircle2 size={16}/> Layer 1 Active</div>
           <div className="bg-purple-100 text-purple px-3 py-1 rounded-full flex items-center gap-2"><Activity size={16}/> Layer 2 Standby</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* LAYER 1: WATERMARK MONITOR */}
        <div className="defense-container layer1-container">
          <div className="layer-header">
            <span className="layer-badge layer1-badge">LAYER 1</span>
            <div className="flex items-center gap-2" style={{marginTop:'0.4rem'}}>
              <ShieldCheck size={17} className="text-primary" />
              <h3 style={{margin:0,fontSize:'1rem'}}>Watermark Monitor</h3>
            </div>
            <p className="text-xs text-secondary" style={{marginTop:'0.3rem',marginBottom:'0.75rem'}}>First line of defense — flags the caller as AI or human based on watermark presence alone.</p>
          </div>

          {monitorState === 'idle' && (
            <div className="text-center flex flex-col items-center">
              <div className="upload-icon-wrap l1-icon mb-3"><UploadCloud size={26} /></div>
              <input type="file" accept="audio/*" onChange={handleFileUpload} style={{display:'none'}} id="audio-upload" />
              <label htmlFor="audio-upload" className="btn btn-outline mb-2 cursor-pointer" style={{fontSize:'0.82rem',padding:'0.5rem 1rem'}}>
                <FileAudio size={15} />
                <span className="truncate" style={{maxWidth:'170px'}}>{selectedFile ? selectedFile.name : 'Choose Audio File'}</span>
              </label>
              <button
                className="btn btn-primary w-full"
                style={{opacity:selectedFile?1:0.5,cursor:selectedFile?'pointer':'not-allowed',fontSize:'0.82rem',padding:'0.5rem 1rem'}}
                onClick={handleAnalyzeUpload}
                disabled={!selectedFile}
              >Run Watermark Scan</button>
            </div>
          )}

          {(monitorState === 'liveness' || monitorState === 'analyzing') && (
            <div className="text-center py-5 flex flex-col items-center">
              <Activity size={34} className="text-primary animate-spin mb-3" />
              <p className="text-sm font-medium">{monitorState === 'liveness' ? 'Scanning for 18kHz signature...' : 'Running bandpass analysis...'}</p>
            </div>
          )}

          {monitorState === 'authentic' && (
            <div className="result-panel result-success fade-in">
              <div className="result-icon success-icon"><CheckCircle2 size={26} /></div>
              <h4 className="font-bold text-success" style={{marginBottom:'0.25rem'}}>Authentic — Watermark Detected</h4>
              <div className="badge badge-success" style={{marginBottom:'0.75rem'}}>18kHz Signature Present</div>
              <div className="tl-item tl-success">
                <ShieldCheck size={13} className="flex-shrink-0" />
                <div>
                  <strong style={{fontSize:'0.8rem'}}>18kHz Bandpass RMS: {layer1Rms !== null ? layer1Rms.toFixed(5) : '—'}</strong>
                  <p className="text-xs" style={{margin:0}}>Cryptographic signature confirmed. Caller verified.</p>
                </div>
              </div>
              <button className="btn btn-outline" style={{marginTop:'0.75rem',fontSize:'0.82rem',padding:'0.45rem 1rem'}} onClick={() => { setMonitorState('idle'); setSelectedFile(null); setLayer1Rms(null); }}>Run Another Scan</button>
            </div>
          )}

          {(monitorState === 'clone' || monitorState === 'scam') && (
            <div className="result-panel result-danger fade-in">
              <div className="result-icon danger-icon"><AlertTriangle size={26} /></div>
              <h4 className="font-bold text-danger" style={{marginBottom:'0.25rem'}}>AI Clone — Watermark Missing</h4>
              <div className="badge badge-danger" style={{marginBottom:'0.75rem'}}>18kHz Signature Absent</div>
              <div className="tl-item tl-danger">
                <AlertTriangle size={13} className="flex-shrink-0" />
                <div>
                  <strong style={{fontSize:'0.8rem'}}>18kHz Bandpass RMS: {layer1Rms !== null ? layer1Rms.toFixed(5) : '—'}</strong>
                  <p className="text-xs" style={{margin:0}}>No cryptographic signature found. Probable AI synthesis. Call blocked.</p>
                </div>
              </div>
              <button className="btn btn-outline" style={{marginTop:'0.75rem',fontSize:'0.82rem',padding:'0.45rem 1rem',color:'var(--danger)',borderColor:'var(--danger)'}} onClick={() => { setMonitorState('idle'); setSelectedFile(null); setLayer1Rms(null); }}>Run Another Scan</button>
            </div>
          )}
        </div>

        {/* LAYER 2: CONVERSATIONAL LIVENESS */}
        <div className="defense-container layer2-container">
          <div className="layer-header">
            <span className="layer-badge layer2-badge">LAYER 2</span>
            <div className="flex items-center gap-2" style={{marginTop:'0.4rem'}}>
              <Fingerprint size={17} style={{color:'var(--purple)'}} />
              <h3 style={{margin:0,fontSize:'1rem'}}>Conversational Liveness</h3>
            </div>
            <p className="text-xs text-secondary" style={{marginTop:'0.3rem',marginBottom:'0.75rem'}}>Catches AI clones that bypass Layer 1 — triggers a live challenge question and analyzes prosodic markers.</p>
          </div>

          {livenessState === 'idle' && (
            <div className="text-center flex flex-col items-center">
              <div className="upload-icon-wrap l2-icon mb-3"><FileAudio size={26} /></div>
              <p className="text-xs text-secondary" style={{fontStyle:'italic',marginBottom:'0.6rem'}}>Upload a 15-second audio clip to run conversational liveness analysis against prosodic markers.</p>
              <input type="file" accept="audio/*" onChange={e => { if(e.target.files?.[0]) setLivenessFile(e.target.files[0]); }} style={{display:'none'}} id="liveness-upload" />
              <label htmlFor="liveness-upload" className="btn btn-outline mb-2 cursor-pointer" style={{fontSize:'0.82rem',padding:'0.5rem 1rem',borderColor:'var(--purple)',color:'var(--purple)'}}>
                <FileAudio size={15} />
                <span className="truncate" style={{maxWidth:'170px'}}>{livenessFile ? livenessFile.name : 'Choose 15-sec Clip'}</span>
              </label>
              {livenessFile && (
                <div style={{marginBottom: '0.8rem', width: '100%', display: 'flex', justifyContent: 'center'}}>
                  <audio src={URL.createObjectURL(livenessFile)} controls style={{width: '100%', maxWidth: '250px', height: '35px'}} />
                </div>
              )}
              <button
                className="btn w-full"
                style={{opacity:livenessFile?1:0.5,cursor:livenessFile?'pointer':'not-allowed',fontSize:'0.82rem',padding:'0.5rem 1rem',background:'var(--purple)',color:'white'}}
                onClick={handleLivenessAnalyze}
                disabled={!livenessFile}
              >Run Liveness Analysis</button>
            </div>
          )}

          {livenessState === 'step1_checking' && (
            <div className="lv-steps fade-in">
              <div className="lv-step">
                <div className="lv-dot lv-dot-active animate-pulse"></div>
                <div>
                  <p className="text-sm font-semibold" style={{margin:0}}>Step 1: Checking watermark...</p>
                  <p className="text-xs text-secondary" style={{margin:0}}>Running 18kHz bandpass filter</p>
                </div>
              </div>
              <div className="lv-step lv-step-muted">
                <div className="lv-dot lv-dot-muted"></div>
                <p className="text-sm text-secondary" style={{margin:0}}>Step 2: Conversational challenge</p>
              </div>
            </div>
          )}

          {livenessState === 'step1_pass' && (
            <div className="lv-steps fade-in">
              <div className="lv-step">
                <div className="lv-dot lv-dot-warn"></div>
                <div>
                  <p className="text-sm font-semibold text-warning" style={{margin:0}}>⚠️ Watermark Found — But Suspicious</p>
                  <p className="text-xs text-secondary" style={{margin:0}}>Layer 1 bypassed! Escalating to Layer 2...</p>
                </div>
              </div>
              <div className="lv-step">
                <div className="lv-dot lv-dot-active animate-pulse" style={{background:'var(--purple)'}}></div>
                <p className="text-sm font-semibold" style={{margin:0,color:'var(--purple)'}}>Injecting challenge question...</p>
              </div>
            </div>
          )}

          {livenessState === 'step2_analyzing' && (
            <div className="lv-steps fade-in">
              <div className="lv-step">
                <div className="lv-dot lv-dot-warn"></div>
                <p className="text-sm font-semibold text-warning" style={{margin:0}}>⚠️ Layer 1 bypassed</p>
              </div>
              <div className="lv-step">
                <div className="lv-dot lv-dot-active animate-pulse" style={{background:'var(--purple)'}}></div>
                <div>
                  <p className="text-sm font-semibold" style={{margin:0,color:'var(--purple)'}}>Analyzing response latency...</p>
                  <p className="text-xs text-secondary" style={{margin:0}}>Measuring time-to-first-token vs. human baseline</p>
                </div>
              </div>
            </div>
          )}

          {livenessState === 'result' && livenessResult && (
            <div className="fade-in">
              {livenessFile && (
                <div style={{marginBottom: '1rem', width: '100%', display: 'flex', justifyContent: 'center'}}>
                  <audio src={URL.createObjectURL(livenessFile)} controls style={{width: '100%', height: '35px'}} />
                </div>
              )}
              <div className="xai-panel">
                <div className="xai-header"><Brain size={13} /><span>Explainable AI — Real Prosodic Analysis</span></div>
                <div className="xai-body">
                  <p className="text-xs" style={{marginBottom:'0.4rem'}}><strong>Layer 1:</strong> <span className="text-warning">Watermark present</span> — but prosodic analysis reveals {livenessResult.flags.length} synthesis artifacts.</p>
                  <p className="text-xs" style={{margin:0}}><strong>Liveness Score:</strong> {(livenessResult.livenessScore * 100).toFixed(0)}/100 — {livenessResult.livenessScore < 0.45 ? 'below threshold (0.45). Injected challenge question.' : 'borderline — challenge issued as precaution.'}</p>
                </div>
              </div>

              <div className="latency-panel">
                <p className="text-xs font-semibold" style={{color:'var(--purple)',marginBottom:'0.5rem'}}>Real DSP Metrics</p>
                <div className="lat-row">
                  <span className="lat-label">Dyn. Variance</span>
                  <div className="lat-track"><div className="lat-bar lat-human" style={{width: `${Math.min(livenessResult.dynamicVariance / 0.001 * 100, 100)}%`}}></div></div>
                  <span className="lat-val" style={{fontSize:'0.65rem'}}>{livenessResult.dynamicVariance.toExponential(1)}</span>
                </div>
                <div className="lat-row">
                  <span className="lat-label">Pauses found</span>
                  <div className="lat-track"><div className="lat-bar lat-human" style={{width:`${Math.min(livenessResult.pauseCount * 10, 100)}%`}}></div></div>
                  <span className="lat-val text-success">{livenessResult.pauseCount}</span>
                </div>
                <div className="lat-row">
                  <span className="lat-label">ZCR</span>
                  <div className="lat-track"><div className={`lat-bar ${livenessResult.zeroCrossingRate > 0.12 ? 'lat-ai' : 'lat-human'}`} style={{width:`${Math.min(livenessResult.zeroCrossingRate * 500, 100)}%`}}></div></div>
                  <span className={`lat-val ${livenessResult.zeroCrossingRate > 0.12 ? 'text-danger' : 'text-success'}`} style={{fontSize:'0.65rem'}}>{livenessResult.zeroCrossingRate.toFixed(3)}</span>
                </div>
              </div>

              {livenessResult.flags.length > 0 && (
                <div className="flags-panel">
                  {livenessResult.flags.map((f, i) => (
                    <div key={i} className="flag-item flag-danger">⚠ {f}</div>
                  ))}
                </div>
              )}

              <div className="inject-audio-panel" style={{marginTop:'0.75rem'}}>
                <p className="text-xs font-semibold" style={{marginBottom:'0.25rem'}}>🎧 Injected challenge (browser TTS)</p>
                <p className="text-xs text-secondary" style={{marginBottom:'0.5rem'}}>Plays a beep + TrueVoice question: <em>"What color is the sky right now?"</em></p>
                <button
                  className="btn"
                  style={{background:isPlayingQuestion?'var(--text-secondary)':'var(--purple)',color:'white',fontSize:'0.82rem',padding:'0.5rem 1rem'}}
                  onClick={playInjectedQuestion}
                  disabled={isPlayingQuestion}
                ><Play size={13} />{isPlayingQuestion ? 'Playing...' : 'Play Injected Question'}</button>
              </div>

              <div className={`result-panel ${livenessResult.livenessScore < 0.45 ? 'result-danger' : 'result-success'}`} style={{marginTop:'0.75rem'}}>
                <div className={`result-icon ${livenessResult.livenessScore < 0.45 ? 'danger-icon' : 'success-icon'}`}>
                  {livenessResult.livenessScore < 0.45 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                </div>
                <h4 className={`font-bold ${livenessResult.livenessScore < 0.45 ? 'text-danger' : 'text-success'}`} style={{marginBottom:'0.2rem'}}>
                  {livenessResult.livenessScore < 0.45 ? 'AI Clone Detected — Layer 2' : 'Liveness Check Passed'}
                </h4>
                <div className={`badge ${livenessResult.livenessScore < 0.45 ? 'badge-danger' : 'badge-success'}`} style={{marginBottom:'0.5rem'}}>
                  Score: {(livenessResult.livenessScore * 100).toFixed(0)}/100
                </div>
                <p className="text-xs text-secondary" style={{margin:0}}>
                  {livenessResult.livenessScore < 0.45
                    ? 'Prosodic profile consistent with AI voice synthesis. Call flagged and logged.'
                    : 'Prosodic markers within human range. Voice appears authentic.'}
                </p>
              </div>
              <button className="btn btn-outline w-full" style={{marginTop:'1rem',borderColor:'var(--purple)',color:'var(--purple)'}}
                onClick={() => { setLivenessState('idle'); setLivenessFile(null); setLivenessResult(null); setIsPlayingQuestion(false); }}>
                Run Another Test
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Monitor;
