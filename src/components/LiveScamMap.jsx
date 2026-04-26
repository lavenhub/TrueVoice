import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Zap } from 'lucide-react';

const LiveScamMap = ({ onSimulateThreat }) => {
  const defaultPosition = [20.5937, 78.9629]; // India center

  const [threatEvents, setThreatEvents] = useState([
    { id: 1, lat: 19.0760, lng: 72.8777, city: "Mumbai, MH", type: "AI Voice Clone Intercepted", severity: "high" },
    { id: 2, lat: 28.7041, lng: 77.1025, city: "New Delhi, DL", type: "Urgency Scam Blocked", severity: "warn" },
    { id: 3, lat: 12.9716, lng: 77.5946, city: "Bengaluru, KA", type: "Financial Fraud Attempt", severity: "high" },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const cities = [
        { lat: 13.0827, lng: 80.2707, city: "Chennai, TN" },
        { lat: 22.5726, lng: 88.3639, city: "Kolkata, WB" },
        { lat: 17.3850, lng: 78.4867, city: "Hyderabad, TS" },
        { lat: 18.5204, lng: 73.8567, city: "Pune, MH" },
        { lat: 23.0225, lng: 72.5714, city: "Ahmedabad, GJ" },
        { lat: 26.9124, lng: 75.7873, city: "Jaipur, RJ" },
        { lat: 21.1458, lng: 79.0882, city: "Nagpur, MH" },
        { lat: 30.7333, lng: 76.7794, city: "Chandigarh, PB" },
        { lat: 22.3072, lng: 73.1812, city: "Vadodara, GJ" },
        { lat: 15.2993, lng: 74.1240, city: "Goa, GA" },
      ];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const isHigh = Math.random() > 0.45;

      setThreatEvents(prev => [
        {
          id: Date.now(),
          ...randomCity,
          type: isHigh ? "AI Voice Clone Intercepted" : "Financial Fraud Attempt",
          severity: isHigh ? "high" : "warn"
        },
        ...prev.slice(0, 7)
      ]);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Map */}
      <div style={{ height: '420px', width: '100%', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '1.5px solid rgba(37,99,235,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <MapContainer
          center={defaultPosition}
          zoom={5}
          style={{ height: '100%', width: '100%', zIndex: 1 }}
          zoomControl={true}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          {threatEvents.map((event, idx) => (
            <CircleMarker
              key={event.id}
              center={[event.lat, event.lng]}
              pathOptions={{
                color: event.severity === 'high' ? '#ef4444' : '#f59e0b',
                fillColor: event.severity === 'high' ? '#ef4444' : '#f59e0b',
                fillOpacity: idx === 0 ? 0.85 : Math.max(0.15, 0.65 - (idx * 0.08)),
                weight: idx === 0 ? 3 : 1.5
              }}
              radius={idx === 0 ? 14 : Math.max(5, 9 - idx)}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{event.city}</div>
                  <div style={{ fontSize: '0.8rem', color: event.severity === 'high' ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{event.type}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Live feed overlay */}
        <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', background: 'rgba(0,0,0,0.88)', padding: '12px 16px', borderRadius: '10px', zIndex: 1000, color: 'white', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', opacity: 0.6, letterSpacing: '1.5px' }}>
              Live Threat Feed
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <div
                className="animate-pulse"
                style={{ width: '8px', height: '8px', borderRadius: '50%', background: threatEvents[0]?.severity === 'high' ? '#ef4444' : '#f59e0b', flexShrink: 0 }}
              />
              <span><strong>{threatEvents[0]?.type}</strong> in {threatEvents[0]?.city}</span>
            </div>
          </div>
          <div style={{ fontSize: '11px', opacity: 0.5, fontWeight: 600 }}>{threatEvents.length} events</div>
        </div>
      </div>

      {/* Simulate Threat button */}
      {onSimulateThreat && (
        <button
          onClick={onSimulateThreat}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            width: '100%', padding: '1rem',
            borderRadius: 14, border: 'none',
            background: '#ef4444', // Solid Red
            color: '#ffffff', // White text for contrast
            fontWeight: 800, fontSize: '1rem',
            cursor: 'pointer', transition: 'all 0.3s ease',
            boxShadow: '0 10px 20px rgba(239, 68, 68, 0.3)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 25px rgba(239, 68, 68, 0.4)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(239, 68, 68, 0.3)'; }}
        >
          <Zap size={20} fill="white" />
          Simulate Incoming Scam Threat
        </button>
      )}
    </div>
  );
};

export default LiveScamMap;
