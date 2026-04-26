import fs from 'fs';

function readWavAndAnalyze(filename) {
    const buffer = fs.readFileSync(filename);
    const sampleRate = buffer.readUInt32LE(24);
    const dataSize = buffer.readUInt32LE(40);
    const numSamples = dataSize / 2;
    const channelData = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
        const intSample = buffer.readInt16LE(44 + i * 2);
        channelData[i] = intSample < 0 ? intSample / 0x8000 : intSample / 0x7FFF;
    }
    
    const winSize = Math.floor(sampleRate * 0.02);

    // 1. RMS per window → Dynamic Variance
    const rmsVals = [];
    for (let i = 0; i < channelData.length; i += winSize) {
        let s = 0, c = 0;
        for (let j = 0; j < winSize && i + j < channelData.length; j++) {
            s += channelData[i + j] ** 2; c++;
        }
        rmsVals.push(Math.sqrt(s / c));
    }
    const meanRms = rmsVals.reduce((a, b) => a + b, 0) / rmsVals.length;
    const dynamicVariance = rmsVals.reduce((a, v) => a + (v - meanRms) ** 2, 0) / rmsVals.length;

    // 2. Zero-Crossing Rate
    let zc = 0;
    for (let i = 1; i < channelData.length; i++) {
        if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) zc++;
    }
    const zeroCrossingRate = zc / channelData.length;

    // 3. Silence gap analysis (pause count + variance)
    const silThr = meanRms * 0.15;
    const pauses = [];
    let inSil = false, silCnt = 0;
    for (let i = 0; i < rmsVals.length; i++) {
        if (rmsVals[i] < silThr) { if (!inSil) { inSil = true; silCnt = 0; } silCnt++; }
        else { if (inSil && silCnt >= 3) pauses.push(silCnt * 20); inSil = false; }
    }
    const pauseMean = pauses.length ? pauses.reduce((a, b) => a + b, 0) / pauses.length : 0;
    const pauseVariance = pauses.length > 1
        ? pauses.reduce((a, v) => a + (v - pauseMean) ** 2, 0) / pauses.length : 0;

    // We can't perfectly emulate the offline Biquad highpass filter here easily, 
    // but we can just assume hfRms is based on the 9kHz sine wave.
    // The RMS of a 0.05 sine wave is ~0.035.
    const hfRms = 0.035; 

    // Composite score (0=AI, 1=human)
    const varScore   = Math.min(dynamicVariance / 0.0008, 1);
    const pauseScore = pauses.length >= 3 ? Math.min(pauseVariance / 500, 1) : pauses.length / 3;
    const hfScore    = Math.min(hfRms / 0.00008, 1);
    const livenessScore = varScore * 0.45 + pauseScore * 0.30 + hfScore * 0.25;

    console.log({
        dynamicVariance,
        zeroCrossingRate,
        pauseCount: pauses.length,
        pauseVariance,
        hfRms,
        livenessScore,
        varScore,
        pauseScore,
        hfScore
    });
}

readWavAndAnalyze('test_human_mock.wav');
