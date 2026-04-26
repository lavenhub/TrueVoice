import Sidebar from './Sidebar';
import Spline from '@splinetool/react-spline';
import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

const Layout = ({ 
  children, 
  navItems, 
  activeTab, 
  onTabChange, 
  name, 
  onProfileClick,
  callsAnalyzed,
  threatsBlocked,
  voiceHash
}) => {
  return (
    <div className="app-container">
      <div className="spline-background interactive">
        <Spline scene="https://prod.spline.design/1pcMQPgVD49CiJpo/scene.splinecode" />
      </div>

      <Sidebar 
        navItems={navItems} 
        activeTab={activeTab} 
        onTabChange={onTabChange} 
        name={name} 
        onProfileClick={onProfileClick} 
      />

      <div className="main-layout">
        <header className="top-header">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span className="text-xs font-semibold text-secondary">System Online</span>
          </div>
        </header>

        <div className="content-area">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="card mb-0 flex items-center gap-4" style={{padding: '1.25rem'}}>
              <div className="bg-primary bg-opacity-10 text-primary p-3 rounded-full"><Activity size={24}/></div>
              <div>
                <p className="text-xs text-secondary font-bold uppercase mb-1 tracking-wider">Calls Analyzed (Session)</p>
                <p className="text-2xl font-bold mb-0">{callsAnalyzed.toLocaleString()}</p>
              </div>
            </div>
            <div className="card mb-0 flex items-center gap-4" style={{padding: '1.25rem'}}>
              <div className="bg-danger bg-opacity-10 text-danger p-3 rounded-full"><AlertTriangle size={24}/></div>
              <div>
                <p className="text-xs text-secondary font-bold uppercase mb-1 tracking-wider">Threats Blocked</p>
                <p className="text-2xl font-bold mb-0">{threatsBlocked.toLocaleString()}</p>
              </div>
            </div>
            <div className="card mb-0 flex items-center gap-4" style={{padding: '1.25rem'}}>
              <div className="bg-success bg-opacity-10 text-success p-3 rounded-full"><ShieldCheck size={24}/></div>
              <div>
                <p className="text-xs text-secondary font-bold uppercase mb-1 tracking-wider">Voice Fingerprint</p>
                <p className="text-sm font-bold mb-0 text-success" style={{fontFamily:'monospace', fontSize:'0.72rem', wordBreak:'break-all', lineHeight:1.3}}>{voiceHash ? voiceHash.slice(0,32) + '...' : 'Not Registered'}</p>
              </div>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
