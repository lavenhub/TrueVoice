import fs from 'fs';

function writeWav(filename, samples, sampleRate = 44100) {
    const buffer = Buffer.alloc(44 + samples.length * 2);
    
    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples.length * 2, 4);
    buffer.write('WAVE', 8);
    
    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
    buffer.writeUInt16LE(2, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    
    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples.length * 2, 40);
    
    // Write samples
    for (let i = 0; i < samples.length; i++) {
        // clamp and convert to 16-bit integer
        let s = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, 44 + i * 2);
    }
    
    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
}

const sampleRate = 44100;
const durationSeconds = 15; // length of the clip
const totalSamples = sampleRate * durationSeconds;

// 1. Generate "Human" Mock Audio
// We need to perfectly hit the targets:
// - dynamicVariance > 0.0008
// - pauseVariance > 500, pauses.length >= 3
// - hfRms > 0.00008
// - zeroCrossingRate < 0.12
const humanSamples = new Float32Array(totalSamples);
let pos = 0;

// Create exactly 4 pauses of lengths: 0.5s, 1.0s, 1.5s, 2.0s
// and 5 speech segments of 2.0s each
const segments = [
    { type: 'speech', duration: 2.0 },
    { type: 'pause', duration: 0.5 },
    { type: 'speech', duration: 2.0 },
    { type: 'pause', duration: 1.0 },
    { type: 'speech', duration: 2.0 },
    { type: 'pause', duration: 1.5 },
    { type: 'speech', duration: 2.0 },
    { type: 'pause', duration: 2.0 },
    { type: 'speech', duration: 2.0 }
];

for (const seg of segments) {
    const segSamples = Math.floor(seg.duration * sampleRate);
    for (let i = 0; i < segSamples && pos < totalSamples; i++) {
        if (seg.type === 'pause') {
            // Very quiet low freq to avoid white noise ZCR
            humanSamples[pos] = Math.sin((pos / sampleRate) * Math.PI * 2 * 20) * 0.001;
        } else {
            // Speech: 100Hz fundamental, highly variable amplitude envelope
            // Envelope that goes from 0 to 1 and back every 0.5s
            const env = Math.abs(Math.sin((i / sampleRate) * Math.PI * 2)); 
            const fundamental = Math.sin((pos / sampleRate) * Math.PI * 2 * 100);
            
            // 12kHz tone for HF RMS check. Amplitude 0.01 is huge for the 0.00008 threshold, 
            // but too small to cause zero-crossings on the 100Hz fundamental.
            const hfTone = Math.sin((pos / sampleRate) * Math.PI * 2 * 12000) * 0.01;
            
            humanSamples[pos] = (fundamental * 0.8 + hfTone) * env;
        }
        pos++;
    }
}

// 2. Generate "AI Clone" Mock Audio
// Characteristics: Low dynamic variance (constant amplitude), no pauses, low HF energy (smooth wave)
const aiSamples = new Float32Array(totalSamples);

for (let i = 0; i < totalSamples; i++) {
    // Constant 300Hz sine wave (no pauses, high zero crossing, low HF energy)
    const mod = Math.sin((i / sampleRate) * Math.PI * 2 * 2); // 2Hz modulation
    aiSamples[i] = Math.sin((i / sampleRate) * Math.PI * 2 * 300) * (0.8 + 0.1 * mod);
}

writeWav('test_human_mock.wav', humanSamples);
writeWav('test_ai_clone_mock.wav', aiSamples);
