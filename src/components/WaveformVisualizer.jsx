import { useEffect, useRef } from 'react';

const WaveformVisualizer = ({ audioFile, isInjecting }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!audioFile || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    
    const drawWaveform = async () => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioFile.slice(0).arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);
        const samples = 100; // number of bars
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }
        
        const max = Math.max(...filteredData);
        const normalizedData = filteredData.map(n => n / max);
        
        let phase = 0;
        const render = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = canvas.width / samples;
          
          for (let i = 0; i < samples; i++) {
            const x = barWidth * i;
            let height = normalizedData[i] * canvas.height * 0.8;
            if (height < 2) height = 2;
            
            // Original waveform
            ctx.fillStyle = isInjecting ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.8)';
            ctx.fillRect(x, canvas.height/2 - height/2, barWidth - 1, height);
            
            // High-frequency injection overlay
            if (isInjecting) {
              const injectHeight = Math.sin(phase + i * 0.5) * (canvas.height * 0.2);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillRect(x, canvas.height/2 + injectHeight - 2, barWidth - 1, 4);
            }
          }
          if (isInjecting) {
            phase += 0.2;
            animationId = requestAnimationFrame(render);
          }
        };
        
        render();
      } catch (e) {
        console.error("Waveform error", e);
      }
    };
    
    drawWaveform();
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [audioFile, isInjecting]);
  
  return <canvas ref={canvasRef} width={400} height={80} className="w-full rounded-md" style={{ background: 'rgba(0,0,0,0.03)' }} />;
};

export default WaveformVisualizer;
