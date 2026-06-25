import { useState, useEffect } from 'react';

const MatrixHash = ({ targetHash, isHashing }) => {
  const [displayHash, setDisplayHash] = useState('');
  
  useEffect(() => {
    if (!isHashing && targetHash) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayHash(targetHash);
      return;
    }
    
    const chars = '0123456789abcdef';
    const interval = setInterval(() => {
      let temp = '';
      for(let i=0; i<64; i++) {
        temp += chars[Math.floor(Math.random() * chars.length)];
      }
      setDisplayHash(temp);
    }, 50);
    
    return () => clearInterval(interval);
  }, [isHashing, targetHash]);
  
  return (
    <div className="font-mono text-xs break-all bg-black text-green-400 p-3 rounded mt-2 shadow-inner h-14 flex items-center overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.5))' }}></div>
      {displayHash || 'WAITING_FOR_HASH_GENERATION...'}
    </div>
  );
};

export default MatrixHash;
