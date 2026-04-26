import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, ShieldCheck, Users, Map, User, Mic, Phone } from 'lucide-react';
import Layout from '../components/Layout';
import Monitor from './Monitor';
import ScamIntent from './ScamIntent';
import CreatorShield from './CreatorShield';
import FamilyVault from './FamilyVault';
import MapPage from './Map';
import Profile from './Profile';

const Dashboard = ({ userProfile }) => {
  const [activeTab, setActiveTab] = useState('monitor');
  const [callsAnalyzed, setCallsAnalyzed] = useState(0);
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [scamState, setScamState] = useState('locked'); // locked, idle, analyzing, result
  
  const [familyMembers, setFamilyMembers] = useState([
    { id: 1, name: 'Aditi Sharma', initials: 'AS', relation: 'Sister', phone: '+91 98765 43210', threats: 1, lastChecked: '2h ago', color: '#2563eb' },
    { id: 2, name: 'Rajesh Kumar', initials: 'RK', relation: 'Father', phone: '+91 99887 76655', threats: 0, lastChecked: '5h ago', color: '#10b981' },
  ]);
  const [activeCallSim, setActiveCallSim] = useState(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simulatedScam, setSimulatedScam] = useState(null);
  const [familyLogs, setFamilyLogs] = useState([]);

  const navItems = [
    { id: 'monitor',        label: 'AI Call Monitor', icon: <Activity size={20} />, color: '#2563eb' },
    { id: 'scam_intent',    label: 'Scam Intent',     icon: <AlertTriangle size={20} />, color: '#f97316' },
    { id: 'creator_shield', label: 'Creator Shield',  icon: <ShieldCheck size={20} />, color: '#8b5cf6' },
    { id: 'family',         label: 'Family Vault',    icon: <Users size={20} />, color: '#10b981' },
    { id: 'map',            label: 'Live Map',        icon: <Map size={20} />, color: '#06b6d4' },
  ];

  const handleSimulateThreat = () => {
    const reasons = [
      "IRS Tax Scam: Threatening arrest for unpaid taxes.",
      "Grandparent Scam: AI voice clone claiming to be a family member in distress.",
      "Tech Support Fraud: Claiming your account has been compromised.",
      "Lottery Scam: Demanding advance fee for a fictitious prize."
    ];
    const phone = `+91 ${Math.floor(Math.random()*90000)+10000} ${Math.floor(Math.random()*90000)+10000}`;
    const reason = reasons[Math.floor(Math.random() * reasons.length)];
    setSimulatedScam({ phone, reason });
    setShowSimModal(true);
  };

  useEffect(() => {
    // Expose simulate threat to window for the "Simulate Threat" button in Map or elsewhere
    window.simulateThreat = handleSimulateThreat;
    return () => delete window.simulateThreat;
  }, []);

  return (
    <Layout 
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      name={userProfile.name}
      onProfileClick={() => setActiveTab('profile')}
      callsAnalyzed={callsAnalyzed}
      threatsBlocked={threatsBlocked}
      voiceHash={userProfile.voiceHash}
    >
      {activeTab === 'monitor' && (
        <Monitor 
          name={userProfile.name} 
          setCallsAnalyzed={setCallsAnalyzed} 
          setThreatsBlocked={setThreatsBlocked} 
          setFamilyLogs={setFamilyLogs}
          setScamState={setScamState}
          onTabChange={setActiveTab}
        />
      )}
      {activeTab === 'scam_intent' && (
        <ScamIntent 
          scamState={scamState} 
          setScamState={setScamState} 
          setCallsAnalyzed={setCallsAnalyzed} 
          setThreatsBlocked={setThreatsBlocked} 
          onTabChange={setActiveTab}
        />
      )}
      {activeTab === 'creator_shield' && <CreatorShield />}
      {activeTab === 'family' && (
        <FamilyVault 
          familyMembers={familyMembers} 
          setFamilyMembers={setFamilyMembers} 
          setCallsAnalyzed={setCallsAnalyzed} 
          setThreatsBlocked={setThreatsBlocked}
          activeCallSim={activeCallSim}
          setActiveCallSim={setActiveCallSim}
        />
      )}
      {activeTab === 'map' && <MapPage threatsBlocked={threatsBlocked} callsAnalyzed={callsAnalyzed} onSimulateThreat={handleSimulateThreat} />}
      {activeTab === 'profile' && <Profile name={userProfile.name} phone={userProfile.phone} voiceHash={userProfile.voiceHash} />}

      {/* Global Scam Simulation Toast */}
      {showSimModal && simulatedScam && (
        <div style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '520px', zIndex: 9999 }}>
          <div className="card border-danger bg-white shadow-lg p-6">
            <div className="flex items-start gap-4">
              <div className="bg-danger bg-opacity-10 p-3 rounded-full text-danger"><AlertTriangle size={28} /></div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-xl font-bold text-danger m-0">Incoming Scam Alert</h2>
                  <button onClick={() => setShowSimModal(false)} className="text-secondary">✕</button>
                </div>
                <p className="font-bold text-sm mb-1">Potential scam from: <span className="font-mono text-danger">{simulatedScam.phone}</span></p>
                <p className="text-sm text-secondary mb-4"><strong>Reason:</strong> {simulatedScam.reason}</p>
                <div className="flex gap-3">
                  <button className="btn btn-primary flex-1 bg-danger border-danger" onClick={() => setShowSimModal(false)}>Block & Report</button>
                  <button className="btn btn-outline flex-1" onClick={() => setShowSimModal(false)}>Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Family Vault Overlay */}
      {activeCallSim && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-md">
          <div className={`p-10 rounded-[32px] w-[420px] text-center shadow-2xl relative overflow-hidden ${activeCallSim.step === 'result' ? (activeCallSim.hasWatermark ? 'bg-green-900' : 'bg-red-900') : 'bg-indigo-950'}`}>
            <div className="w-[90px] h-[90px] rounded-full mx-auto mb-6 flex items-center justify-center text-white text-3xl font-bold border-4 border-white/30" style={{background: activeCallSim.member.color}}>
              {activeCallSim.member.initials}
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-widest mb-4">
              {activeCallSim.step === 'scanning' ? <Activity size={14} className="animate-spin" /> : null}
              {activeCallSim.step === 'scanning' ? 'Analyzing...' : activeCallSim.hasWatermark ? 'Authentic' : 'Suspect'}
            </div>
            <h2 className="text-white text-2xl font-extrabold mb-1">{activeCallSim.member.name}</h2>
            <p className="text-white/60 text-sm mb-6">{activeCallSim.member.relation}</p>
            <div className="bg-white/10 rounded-2xl p-5 text-left text-white mb-6">
              {activeCallSim.step === 'scanning' ? (
                <div className="text-center">
                  <Mic size={24} className="mx-auto mb-2 animate-pulse" />
                  <p className="text-sm font-medium">Running 18kHz bandpass filter analysis...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="opacity-60 uppercase">18kHz RMS</span>
                    <span>{activeCallSim.rms?.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold mb-4">
                    <span className="opacity-60 uppercase">Threshold</span>
                    <span>0.01000</span>
                  </div>
                  <div className="border-t border-white/20 pt-4 text-sm font-semibold">
                    {activeCallSim.hasWatermark ? '✅ Watermark confirmed. Registered voice.' : '⚠️ No signature found. Potential AI clone.'}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setActiveCallSim(null)} className="px-8 py-2 rounded-full border border-white/30 text-white font-bold hover:bg-white/10">Close</button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
