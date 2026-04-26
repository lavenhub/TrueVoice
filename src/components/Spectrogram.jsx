import { useEffect, useRef } from 'react';

const Spectrogram = ({ spectrogramData, label, hasWatermark, rms }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!spectrogramData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { data, numTimeBins, numFreqBins, bands } = spectrogramData;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    const cellW = W / numTimeBins;
    const cellH = H / numFreqBins;

    // Find max magnitude for normalization
    let maxMag = 0;
    for (const row of data) for (const v of row) if (v > maxMag) maxMag = v;
    if (maxMag === 0) maxMag = 1;

    for (let t = 0; t < numTimeBins; t++) {
      for (let f = 0; f < numFreqBins; f++) {
        const val = data[t][f] / maxMag;
        const freq = bands[f];
        const is18k = freq >= 17000 && freq <= 19000;

        let r, g, b;
        if (is18k && val > 0.05) {
          // Bright cyan/white for watermark band
          const intensity = Math.min(val * 3, 1);
          r = Math.floor(50 + intensity * 205);
          g = Math.floor(200 + intensity * 55);
          b = 255;
        } else {
          // Dark blue → cyan → yellow → white heat map
          const v = Math.pow(val, 0.6);
          if (v < 0.25) {
            r = 0; g = Math.floor(v * 4 * 80); b = Math.floor(40 + v * 4 * 160);
          } else if (v < 0.5) {
            const t2 = (v - 0.25) * 4;
            r = 0; g = Math.floor(80 + t2 * 175); b = Math.floor(200 - t2 * 100);
          } else if (v < 0.75) {
            const t2 = (v - 0.5) * 4;
            r = Math.floor(t2 * 255); g = 255; b = Math.floor(100 - t2 * 100);
          } else {
            const t2 = (v - 0.75) * 4;
            r = 255; g = 255; b = Math.floor(t2 * 255);
          }
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        // Draw bottom-up (low freq at bottom)
        ctx.fillRect(t * cellW, H - (f + 1) * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Draw 18kHz indicator line
    const idx18k = bands.findIndex(b => b >= 18000);
    if (idx18k >= 0) {
      const y = H - (idx18k + 0.5) * cellH;
      ctx.strokeStyle = hasWatermark ? 'rgba(0,255,200,0.8)' : 'rgba(255,80,80,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = hasWatermark ? '#00ffc8' : '#ff5050';
      ctx.font = 'bold 10px Inter, monospace';
      ctx.fillText('18kHz →', 4, y - 4);
    }

    // Frequency axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Inter, monospace';
    const labelFreqs = [1000, 5000, 10000, 15000, 18000];
    for (const lf of labelFreqs) {
      const fi = bands.findIndex(b => b >= lf);
      if (fi >= 0) {
        const y = H - (fi + 0.5) * cellH;
        ctx.fillText(`${lf / 1000}k`, W - 24, y + 3);
      }
    }
  }, [spectrogramData, hasWatermark]);

  const borderColor = hasWatermark ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)';

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: '0.5rem', color: hasWatermark ? '#10b981' : '#ef4444',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span>{label}</span>
        <span style={{
          background: hasWatermark ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          padding: '2px 8px', borderRadius: 99, fontSize: '0.65rem'
        }}>
          RMS: {rms !== null && rms !== undefined ? rms.toFixed(5) : '—'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={180}
        style={{
          width: '100%', height: '180px', borderRadius: '12px',
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 20px ${borderColor}`,
        }}
      />
      <div style={{
        marginTop: '0.5rem', textAlign: 'center', fontWeight: 800,
        fontSize: '0.85rem',
        color: hasWatermark ? '#10b981' : '#ef4444'
      }}>
        {hasWatermark ? '✅ 18kHz WATERMARK DETECTED' : '🚨 NO WATERMARK — AI CLONE'}
      </div>
    </div>
  );
};

export default Spectrogram;
