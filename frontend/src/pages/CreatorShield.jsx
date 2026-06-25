import { useState } from 'react';
import { ShieldCheck, UploadCloud, FileAudio, CheckCircle2 } from 'lucide-react';
import WaveformVisualizer from '../components/WaveformVisualizer';
import MatrixHash from '../components/MatrixHash';
import { injectCreatorShield } from '../audioUtils';

const CreatorShield = () => {
  const [shieldState, setShieldState] = useState('idle'); // idle, processing, done
  const [shieldFile, setShieldFile] = useState(null);
  const [shieldStep, setShieldStep] = useState('');
  const [shieldProgress, setShieldProgress] = useState(0);
  const [shieldHash, setShieldHash] = useState('');
  const [protectedAudioUrl, setProtectedAudioUrl] = useState(null);

  const handleShieldUpload = async () => {
    if (!shieldFile) return;
    setShieldState('processing');
    setShieldProgress(0);
    
    try {
      setShieldStep('Calculating HMAC-SHA256 Fingerprint...');
      await new Promise(r => setTimeout(r, 2000));
      
      setShieldStep('Injecting High-Frequency Poison Pill...');
      
      const interval = setInterval(() => {
        setShieldProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 100);

      const { blob: watermarkedBlob, hash: realHash } = await injectCreatorShield(shieldFile);
      const url = URL.createObjectURL(watermarkedBlob);
      setProtectedAudioUrl(url);
      setShieldHash(realHash);

      setTimeout(() => {
        setShieldState('done');
        setShieldStep('Immunization Complete');
      }, 3000);
      
    } catch (e) {
      console.error(e);
      setShieldState('idle');
    }
  };

  return (
    <div className="fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-primary" /> Creator Shield
          </h2>
          <p className="text-sm mb-0">Embed an invisible poison pill in your content.</p>
        </div>
      </div>

      <div className="card mb-6" style={{ borderColor: 'var(--purple)' }}>
        <p className="text-sm mb-4 text-secondary">
          Upload your Reel, TikTok, or YouTube Short before posting. Our engine injects an 18kHz cryptographic signature into the audio track. AI cloning tools like VALL-E naturally destroy frequencies above 8kHz. If an AI clones your voice, the clone will lack your digital passport—immediately exposing it to our detection layer.
        </p>

        {shieldState === 'idle' && (
          <div className="text-center flex flex-col items-center p-6 border-2 border-dashed rounded-lg bg-surface" style={{ borderColor: 'var(--purple)' }}>
            <UploadCloud size={36} style={{ color: 'var(--purple)', marginBottom: '0.5rem' }} />
            <p className="text-sm font-semibold mb-1">Select Media File</p>
            <p className="text-xs text-secondary mb-4">Supports .wav, .mp3, .mp4</p>
            
            <input 
              type="file" 
              accept="audio/*,video/*" 
              onChange={e => { if(e.target.files?.[0]) setShieldFile(e.target.files[0]); }} 
              style={{display:'none'}} 
              id="shield-upload" 
            />
            <label htmlFor="shield-upload" className="btn btn-outline mb-3 cursor-pointer" style={{ borderColor: 'var(--purple)', color: 'var(--purple)' }}>
              {shieldFile ? shieldFile.name : 'Browse Files'}
            </label>
            
            <button
              className="btn w-full"
              style={{ background: 'var(--purple)', color: 'white', opacity: shieldFile ? 1 : 0.5, cursor: shieldFile ? 'pointer' : 'not-allowed' }}
              onClick={handleShieldUpload}
              disabled={!shieldFile}
            >
              Immunize Content
            </button>
          </div>
        )}

        {shieldState === 'processing' && (
          <div className="p-6 border rounded-lg bg-surface text-center" style={{ borderColor: 'var(--purple)' }}>
            <div className="mb-4">
              <WaveformVisualizer audioFile={shieldFile} isInjecting={shieldStep.includes('Injecting')} />
            </div>
            
            <h3 className="text-md font-bold mb-1">{shieldStep}</h3>
            
            {shieldStep.includes('HMAC') ? (
              <MatrixHash targetHash={null} isHashing={true} />
            ) : (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-4 mb-2 overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${shieldProgress}%`, background: 'var(--purple)' }}></div>
                </div>
                <p className="text-xs text-secondary text-right">{shieldProgress}%</p>
              </>
            )}
          </div>
        )}

        {shieldState === 'done' && (
          <div className="p-6 border-2 border-success rounded-lg bg-success bg-opacity-10 text-center">
            <CheckCircle2 size={48} className="text-success mx-auto mb-3" />
            <h3 className="text-lg font-bold text-success mb-2">Content Secured</h3>
            <p className="text-sm mb-4">Your media has been immunized with an invisible 18kHz signature.</p>
            
            <div className="bg-white p-3 rounded text-left mb-4 shadow-sm border border-border">
              <div className="text-xs text-secondary mb-1">Cryptographic Hash (HMAC-SHA256)</div>
              <MatrixHash targetHash={shieldHash} isHashing={false} />
            </div>

            <a 
              href={protectedAudioUrl} 
              download={`shielded_${shieldFile?.name || 'media.wav'}`}
              className="btn btn-primary w-full mb-3 flex items-center justify-center gap-2"
              onClick={() => {
                setTimeout(() => {
                  setShieldState('idle');
                  setShieldFile(null);
                  setShieldProgress(0);
                }, 1000);
              }}
            >
              <FileAudio size={18} /> Download Protected File
            </a>
            <p className="text-xs text-secondary mt-2" style={{ lineHeight: '1.4' }}>
              Note: For this browser demo, the output is processed as a standard .wav audio file. Full video remuxing operates on our backend pipelines.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorShield;
