import { Activity } from 'lucide-react';
import LiveScamMap from '../components/LiveScamMap';

const MapPage = ({ threatsBlocked, callsAnalyzed, onSimulateThreat }) => {
  return (
    <div className="fade-in flex flex-col h-full">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Live Threat Map</h2>
          <p className="text-sm mb-0">Real-time AI voice clone interceptions and social engineering attempts across India.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="animate-pulse w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-xs font-bold" style={{ color: 'var(--danger)' }}>LIVE</span>
        </div>
      </div>

      <LiveScamMap onSimulateThreat={onSimulateThreat} />

      <div className="card mt-4 mb-0" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.04), rgba(139,92,246,0.04))', borderColor: 'rgba(37,99,235,0.12)' }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
          <Activity size={16} /> TrueVoice Network Statistics
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>{(threatsBlocked + 12069).toLocaleString()}</div>
            <div className="text-xs font-semibold mt-1" style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threats Blocked (Network)</div>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.1)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{(callsAnalyzed + 48920).toLocaleString()}</div>
            <div className="text-xs font-semibold mt-1" style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calls Analyzed</div>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>99.3%</div>
            <div className="text-xs font-semibold mt-1" style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detection Accuracy</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPage;
