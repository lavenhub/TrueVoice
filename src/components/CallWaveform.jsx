import { useEffect, useRef } from 'react';

const CallWaveform = ({ analyserNode, isActive, color = '#2563eb' }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 10, 26, 0.3)';
      ctx.fillRect(0, 0, W, H);

      if (analyserNode && isActive) {
        const bufLen = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufLen);
        analyserNode.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath();

        const sliceWidth = W / bufLen;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * H) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Flatline with subtle glow
        ctx.strokeStyle = 'rgba(100,116,139,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [analyserNode, isActive, color]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      style={{
        width: '100%', height: '80px', borderRadius: '12px',
        background: 'rgba(10,10,26,0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    />
  );
};

export default CallWaveform;
