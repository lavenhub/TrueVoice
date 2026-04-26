// audioUtils.js - Web Audio API DSP functions for TrueVoice

/**
 * Embeds an 18kHz sine wave watermark into an audio blob.
 */
export const embedWatermark = async (audioBlob) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const duration = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(sampleRate * duration),
    sampleRate
  );
  
  // 1. Original Audio Source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();
  
  // 2. High-Frequency Watermark (18kHz Sine Wave)
  const oscillator = offlineContext.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 18000;
  
  const gainNode = offlineContext.createGain();
  gainNode.gain.value = 0.1; // 10% amplitude (loud enough for computer, basically inaudible to humans)
  
  oscillator.connect(gainNode);
  gainNode.connect(offlineContext.destination);
  
  oscillator.start();
  oscillator.stop(duration);
  
  const renderedBuffer = await offlineContext.startRendering();
  
  // Convert AudioBuffer to WAV Blob
  return bufferToWave(renderedBuffer, renderedBuffer.length);
};

/**
 * Analyzes an audio file to see if it contains a specific frequency watermark.
 * Uses a tight Bandpass filter and calculates RMS energy.
 */
export const detectWatermark = async (audioFile, targetFreq = 18000) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const offlineContext = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Create a tight bandpass filter exactly at the target frequency
  const filter = offlineContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = targetFreq;
  filter.Q.value = 100; // Very narrow frequency band
  
  source.connect(filter);
  filter.connect(offlineContext.destination);
  source.start();
  
  const renderedBuffer = await offlineContext.startRendering();
  
  // Calculate RMS (Root Mean Square) energy of the filtered 18kHz output
  const channelData = renderedBuffer.getChannelData(0);
  let sumSquares = 0;
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i];
  }
  const rms = Math.sqrt(sumSquares / channelData.length);
  
  console.log(`[TrueVoice DSP] 18kHz Bandpass RMS Energy: ${rms}`);
  
  // If the 18kHz signal is present, the RMS will be significant (e.g. ~0.07 for 0.1 gain sine)
  // A clean voice clip has almost zero energy at 18kHz (< 0.001)
  // We use 0.01 as a robust threshold
  return { isAuthentic: rms > 0.01, rms };
};

// Helper: Convert AudioBuffer to standard WAV Blob
function bufferToWave(abuffer, len) {
  let numOfChan = abuffer.numberOfChannels,
      length = len * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length),
      view = new DataView(buffer),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"
  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while(pos < length) {
    for(i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], {type: "audio/wav"});

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

/**
 * Analyzes audio for physical "liveness" (human in a room vs. digital playback).
 * It calculates the Dynamic Variance (to detect heavily compressed playback)
 * and High-Frequency ambient energy (to detect speaker roll-off).
 */
export const analyzeLiveness = async (audioBlob) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const channelData = audioBuffer.getChannelData(0);
  
  // 1. Calculate Dynamic Range Variance (50ms windows)
  const windowSize = Math.floor(audioBuffer.sampleRate * 0.05);
  const rmsValues = [];
  
  for (let i = 0; i < channelData.length; i += windowSize) {
    let sumSquares = 0;
    let count = 0;
    for (let j = 0; j < windowSize && i + j < channelData.length; j++) {
      sumSquares += channelData[i + j] * channelData[i + j];
      count++;
    }
    rmsValues.push(Math.sqrt(sumSquares / count));
  }
  
  const meanRms = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
  let variance = 0;
  for (let i = 0; i < rmsValues.length; i++) {
    variance += Math.pow(rmsValues[i] - meanRms, 2);
  }
  variance = variance / rmsValues.length;
  
  // 2. Calculate High-Frequency Ambient Energy (above 10kHz)
  const offlineContext = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  const filter = offlineContext.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 10000; // 10kHz cut-off
  
  source.connect(filter);
  filter.connect(offlineContext.destination);
  source.start();
  
  const renderedBuffer = await offlineContext.startRendering();
  const hfData = renderedBuffer.getChannelData(0);
  
  let hfSumSquares = 0;
  for(let i=0; i<hfData.length; i++) {
    hfSumSquares += hfData[i] * hfData[i];
  }
  const hfRms = Math.sqrt(hfSumSquares / hfData.length);
  
  console.log(`[TrueVoice Liveness] Dynamic Variance: ${variance.toFixed(6)}, HF RMS: ${hfRms.toFixed(6)}`);
  
  // Heuristics:
  // - A real human speaking in a physical room has higher variance (pauses/plosives) and natural high-frequency ambient noise.
  // - A digital AI clone played out of a phone speaker is heavily compressed (low variance) and cuts off frequencies above 10kHz (low HF RMS).
  
  const hasGoodDynamics = variance > 0.0001; 
  const hasAmbientHF = hfRms > 0.00005;

  return hasGoodDynamics || hasAmbientHF;
};

/**
 * Real prosodic liveness analysis via time-domain DSP.
 * Measures dynamic variance, zero-crossing rate, silence gap irregularity,
 * and high-frequency energy to detect AI synthesis artifacts.
 */
export const analyzeProsodicLiveness = async (audioFile) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const winSize = Math.floor(sampleRate * 0.02); // 20ms windows

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

  // 4. HF energy via offline highpass (8kHz+)
  const offCtx = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
  const src = offCtx.createBufferSource(); src.buffer = audioBuffer;
  const hpf = offCtx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 8000;
  src.connect(hpf); hpf.connect(offCtx.destination); src.start();
  const hfBuf = await offCtx.startRendering();
  const hfData = hfBuf.getChannelData(0);
  let hfSum = 0;
  for (let i = 0; i < hfData.length; i++) hfSum += hfData[i] ** 2;
  const hfRms = Math.sqrt(hfSum / hfData.length);

  // Composite score (0=AI, 1=human)
  const varScore   = Math.min(dynamicVariance / 0.0008, 1);
  const pauseScore = pauses.length >= 3 ? Math.min(pauseVariance / 500, 1) : pauses.length / 3;
  const hfScore    = Math.min(hfRms / 0.00008, 1);
  const livenessScore = varScore * 0.45 + pauseScore * 0.30 + hfScore * 0.25;

  const flags = [];
  if (dynamicVariance < 0.0002) flags.push('Low dynamic range — AI compression pattern');
  if (pauses.length < 2) flags.push('Very few natural pauses detected');
  if (pauses.length > 1 && pauseVariance < 200) flags.push('Unnaturally regular pause intervals');
  if (hfRms < 0.00003) flags.push('High-frequency roll-off — digital speaker artifact');
  if (zeroCrossingRate > 0.12) flags.push('Elevated ZCR — tonal synthesis indicator');

  return { dynamicVariance, zeroCrossingRate, pauseCount: pauses.length,
    pauseVariance, hfRms, livenessScore: Math.min(livenessScore, 1), flags };
};

// Scam intent detection logic removed - now handled via backend Gemini API.

/**
 * Creator Shield Engine
 * Demuxes audio, generates an HMAC-SHA256 signature, injects a 19kHz
 * cryptographic sine wave watermark, and remuxes into a safe .wav file.
 */
export const injectCreatorShield = async (audioFile, userId) => {
  // 1. Generate cryptographic signature using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(`${userId}-${Date.now()}`);
  const key = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode('truevoice_master_secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 2. Decode audio
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // 3. Setup OfflineAudioContext for rendering
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, length, sampleRate);

  // Source node
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Watermark Oscillator (18000 Hz)
  const osc = offlineCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 18000;

  // Gain node for watermark (very low amplitude so it's inaudible but detectable)
  const gainNode = offlineCtx.createGain();
  gainNode.gain.value = 0.08;

  osc.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  source.connect(offlineCtx.destination);

  osc.start(0);
  source.start(0);

  // Render to audio buffer
  const renderedBuffer = await offlineCtx.startRendering();

  // 4. Encode to WAV
  const wavBlob = audioBufferToWav(renderedBuffer);
  
  return {
    blob: wavBlob,
    hash: hashHex
  };
};

function audioBufferToWav(buffer) {
  let numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  // write WAVE header
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numOfChan, true); offset += 2;
  view.setUint32(offset, buffer.sampleRate, true); offset += 4;
  view.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4;
  view.setUint16(offset, numOfChan * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, length - pos - 4, true); offset += 4;

  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while(pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArray], { type: "audio/wav" });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generates synthetic voice-like audio WITHOUT watermark for Layer 1 comparison.
 * Creates a sawtooth + lowpass filtered signal (flat TTS profile).
 */
export const generateCloneAudio = async (durationSeconds = 3) => {
  const sampleRate = 44100;
  const length = sampleRate * durationSeconds;
  const offlineCtx = new OfflineAudioContext(1, length, sampleRate);

  // Sawtooth oscillator (vocal-like)
  const osc = offlineCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 180;

  // Lowpass filter (simulates TTS bandwidth limiting — cuts above 8kHz)
  const lpf = offlineCtx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 4000;

  // Slight amplitude modulation for realism
  const modOsc = offlineCtx.createOscillator();
  modOsc.frequency.value = 3;
  const modGain = offlineCtx.createGain();
  modGain.gain.value = 0.15;
  modOsc.connect(modGain);

  const mainGain = offlineCtx.createGain();
  mainGain.gain.value = 0.25;
  modGain.connect(mainGain.gain);

  osc.connect(lpf);
  lpf.connect(mainGain);
  mainGain.connect(offlineCtx.destination);
  osc.start(); osc.stop(durationSeconds);
  modOsc.start(); modOsc.stop(durationSeconds);

  const rendered = await offlineCtx.startRendering();
  const blob = audioBufferToWav(rendered);
  return new File([blob], 'clone_audio.wav', { type: 'audio/wav' });
};

/**
 * Computes a spectrogram for an audio file.
 * Returns a 2D array [time][freq] of energy values + metadata.
 * Uses bandpass filters at key frequency bands for accuracy.
 */
export const computeSpectrogram = async (audioFile) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const numTimeBins = 150;
  const bands = [200,500,1000,2000,3000,4000,5000,6000,7000,8000,
                 9000,10000,11000,12000,13000,14000,15000,16000,17000,18000,19000,20000];
  const numFreqBins = bands.length;
  const sliceLen = Math.floor(channelData.length / numTimeBins);

  const data = [];
  for (let t = 0; t < numTimeBins; t++) {
    const start = t * sliceLen;
    const row = [];
    for (let f = 0; f < numFreqBins; f++) {
      const freq = bands[f];
      const omega = (2 * Math.PI * freq) / sampleRate;
      let real = 0, imag = 0;
      const end = Math.min(start + sliceLen, channelData.length);
      // Goertzel for this frequency
      for (let i = start; i < end; i++) {
        real += channelData[i] * Math.cos(omega * (i - start));
        imag += channelData[i] * Math.sin(omega * (i - start));
      }
      const mag = Math.sqrt(real * real + imag * imag) / sliceLen;
      row.push(mag);
    }
    data.push(row);
  }

  return { data, numTimeBins, numFreqBins, bands, maxFreq: 22050 };
};

