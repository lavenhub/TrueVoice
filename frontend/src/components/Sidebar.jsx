import { ShieldCheck } from 'lucide-react';

const Sidebar = ({ navItems, activeTab, onTabChange, name, onProfileClick }) => {
  return (
    <div className="sidebar" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255,255,255,0.5)' }}>
      {/* Logo */}
      <div className="sidebar-header" style={{ marginBottom: '2.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 12, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={22} color="#fff" />
        </div>
        <span style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TrueVoice</span>
      </div>

      {/* Nav items */}
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                padding: '0.85rem 1.1rem',
                borderRadius: 14,
                border: isActive ? `1.5px solid ${item.color}33` : '1.5px solid transparent',
                background: isActive ? `linear-gradient(135deg, ${item.color}18, ${item.color}0a)` : 'transparent',
                color: isActive ? item.color : '#64748b',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                width: '100%',
                textAlign: 'left',
                boxShadow: isActive ? `0 4px 16px ${item.color}22` : 'none',
              }}
            >
              {/* Colored icon bubble */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: isActive ? `linear-gradient(135deg, ${item.color}22, ${item.color}44)` : 'rgba(100,116,139,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isActive ? item.color : '#94a3b8',
                transition: 'all 0.2s ease',
              }}>
                {item.icon}
              </div>
              <span>{item.label}</span>
              {/* Active indicator dot */}
              {isActive && (
                <div style={{
                  marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%',
                  background: item.color,
                  boxShadow: `0 0 6px ${item.color}`,
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Profile card at bottom */}
      <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button
          onClick={onProfileClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderRadius: 14, width: '100%',
            background: activeTab === 'profile'
              ? 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.08))'
              : 'rgba(37,99,235,0.05)',
            border: activeTab === 'profile' ? '1.5px solid rgba(37,99,235,0.2)' : '1.5px solid transparent',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '1rem',
          }}>
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ textAlign: 'left', flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'User'}</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Protected Profile
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
