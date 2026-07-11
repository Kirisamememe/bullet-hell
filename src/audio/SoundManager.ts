/**
 * Procedurally synthesized sound effects, styled after the NES/Famicom
 * (2A03) sound chip: two pulse-wave channels with selectable duty cycles,
 * a triangle channel, and an LFSR-based noise channel, all driven by
 * quantized "staircase" volume envelopes instead of smooth synth curves.
 * Zero external audio assets — everything is generated at runtime,
 * matching the "no image assets" philosophy used for the rest of this
 * game's visuals.
 *
 * Signal path: each one-shot voice is shaped by its own envelope/filter,
 * then routed into a shared bus that feeds a gentle compressor (so a
 * screen full of simultaneous explosions doesn't clip into harsh digital
 * distortion) and an algorithmic reverb send (so hits/explosions get a
 * touch of space). Repeated same-type triggers within a short window are
 * auto-attenuated and pitch-jittered so stacked identical hits don't phase
 * into an ugly wall of noise.
 */

import { audioCore } from './AudioCore';
import { applyStepEnvelope, buildLfsrNoiseBuffer, createPulseWave, steppedFreqRamp } from './chip';

type Wave = 'pulse' | 'triangle' | 'sine';

interface VoiceOpts {
  wave: Wave;
  duty?: number; // 0..1, pulse only
  freq: number;
  endFreq?: number;
  freqSteps?: number;
  duration?: number; // seconds
  attack?: number;
  hold?: number;
  gain?: number; // peak 0..1
  steps?: number; // decay staircase resolution
  delay?: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
  vibratoRate?: number;
  vibratoDepth?: number; // cents
  pan?: number; // -1..1
  reverb?: number; // 0..1 wet send
}

interface NoiseVoiceOpts {
  mode?: 'long' | 'short';
  rate?: number; // buffer playback rate = noise "pitch"
  duration?: number;
  attack?: number;
  hold?: number;
  gain?: number;
  steps?: number;
  delay?: number;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  endFilterFreq?: number;
  filterQ?: number;
  pan?: number;
  reverb?: number;
}

export class SoundManager {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseLong: AudioBuffer | null = null;
  private noiseShort: AudioBuffer | null = null;
  private dutyCache = new Map<number, PeriodicWave>();
  private lastShot = 0;
  private lastGraze = 0;
  private recentTriggers: Map<string, { count: number; time: number }> = new Map();
  private sfxGain: GainNode | null = null;
  private volume = 0.7;
  muted = false;

  constructor() {
    audioCore.onReady((ctx, dest) => this.init(ctx, dest));
  }

  private init(ctx: AudioContext, dest: AudioNode): void {
    this.ctx = ctx;

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.muted ? 0 : this.volume;
    this.sfxGain.connect(dest);

    // Gentle bus compression keeps overlapping explosions/hits from
    // clipping into harsh distortion when many voices stack at once.
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;
    this.compressor.connect(this.sfxGain);

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.compressor);

    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.buildImpulseResponse(1.6, 2.4);
    this.reverbSend.connect(this.convolver);
    this.convolver.connect(this.bus);

    this.noiseLong = buildLfsrNoiseBuffer(ctx, 'long', 1);
    this.noiseShort = buildLfsrNoiseBuffer(ctx, 'short', 1);
  }

  /** Must be called from a user-gesture handler (keydown/touchstart/click). */
  unlock(): void {
    audioCore.unlock();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  private get ready(): boolean {
    return !!this.ctx && !!this.bus && !!this.noiseLong && !!this.noiseShort;
  }

  private getPulseWave(duty: number): PeriodicWave {
    const key = Math.round(duty * 1000);
    let w = this.dutyCache.get(key);
    if (!w) {
      w = createPulseWave(this.ctx!, duty);
      this.dutyCache.set(key, w);
    }
    return w;
  }

  /** Short synthetic decay tail used to give hits/explosions a sense of space. */
  private buildImpulseResponse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  /** Attenuates + tracks repeated triggers of the same SFX within a short window. */
  private triggerDensity(key: string, windowMs = 150): number {
    const now = performance.now();
    const rec = this.recentTriggers.get(key);
    if (!rec || now - rec.time > windowMs) {
      this.recentTriggers.set(key, { count: 1, time: now });
      return 1;
    }
    rec.count++;
    rec.time = now;
    return Math.max(0.3, 1 / Math.sqrt(rec.count));
  }

  /** Routes a finished voice into the dry bus and (optionally) the reverb send + a stereo position. */
  private routeVoice(voice: AudioNode, pan?: number, reverb?: number): void {
    if (!this.bus || !this.ctx) return;
    let out: AudioNode = voice;
    if (pan !== undefined) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      voice.connect(panner);
      out = panner;
    }
    out.connect(this.bus);
    if (reverb && this.reverbSend) {
      const send = this.ctx.createGain();
      send.gain.value = Math.max(0, Math.min(1, reverb));
      out.connect(send);
      send.connect(this.reverbSend);
    }
  }

  private voice(opts: VoiceOpts): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const dur = opts.duration ?? 0.12;
    const attack = opts.attack ?? 0.002;
    const hold = opts.hold ?? 0;
    const decay = Math.max(0.01, dur - attack - hold);

    const osc = ctx.createOscillator();
    if (opts.wave === 'pulse') {
      osc.setPeriodicWave(this.getPulseWave(opts.duty ?? 0.25));
    } else {
      osc.type = opts.wave;
    }
    if (opts.endFreq !== undefined && opts.endFreq !== opts.freq) {
      steppedFreqRamp(osc.frequency, t0, dur, opts.freq, opts.endFreq, opts.freqSteps ?? 12);
    } else {
      osc.frequency.setValueAtTime(opts.freq, t0);
    }

    let lfo: OscillatorNode | null = null;
    if (opts.vibratoRate && opts.vibratoDepth) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = opts.vibratoRate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = opts.vibratoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }

    let chainEnd: AudioNode = osc;
    if (opts.filterFreq !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType ?? 'lowpass';
      filter.Q.value = 0.8;
      filter.frequency.value = opts.filterFreq;
      osc.connect(filter);
      chainEnd = filter;
    }

    const gain = ctx.createGain();
    applyStepEnvelope(gain.gain, t0, opts.gain ?? 0.2, attack, hold, decay, opts.steps ?? 9);
    chainEnd.connect(gain);

    this.routeVoice(gain, opts.pan, opts.reverb);

    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseVoice(opts: NoiseVoiceOpts): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const dur = opts.duration ?? 0.2;
    const attack = opts.attack ?? 0.001;
    const hold = opts.hold ?? 0;
    const decay = Math.max(0.01, dur - attack - hold);

    const src = ctx.createBufferSource();
    src.buffer = (opts.mode === 'short' ? this.noiseShort : this.noiseLong)!;
    src.playbackRate.value = opts.rate ?? 1;

    let chainEnd: AudioNode = src;
    if (opts.filterFreq !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType ?? 'bandpass';
      filter.Q.value = opts.filterQ ?? 1;
      filter.frequency.setValueAtTime(opts.filterFreq, t0);
      if (opts.endFilterFreq !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFilterFreq), t0 + dur);
      }
      src.connect(filter);
      chainEnd = filter;
    }

    const gain = ctx.createGain();
    applyStepEnvelope(gain.gain, t0, opts.gain ?? 0.2, attack, hold, decay, opts.steps ?? 8);
    chainEnd.connect(gain);

    this.routeVoice(gain, opts.pan, opts.reverb);

    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---- Gameplay SFX ----

  /** Player shot — classic 8-bit laser zap: a pulse wave diving in pitch with a spark of metallic noise. */
  playerShot(): void {
    if (!this.ready) return;
    const now = performance.now();
    if (now - this.lastShot < 65) return;
    this.lastShot = now;
    const duty = Math.random() < 0.5 ? 0.25 : 0.125;
    const jitter = (Math.random() - 0.5) * 90;
    this.voice({
      wave: 'pulse',
      duty,
      freq: 1850 + jitter,
      endFreq: 240,
      freqSteps: 9,
      duration: 0.1,
      attack: 0.001,
      gain: 0.18,
      steps: 7,
      filterFreq: 7000,
      pan: (Math.random() - 0.5) * 0.25,
    });
    this.noiseVoice({ mode: 'short', duration: 0.02, gain: 0.06, rate: 3, filterType: 'highpass', filterFreq: 3500 });
  }

  /** Bullet connects with an enemy but doesn't kill it. */
  enemyHit(): void {
    const atten = this.triggerDensity('enemyHit');
    this.voice({
      wave: 'pulse',
      duty: 0.5,
      freq: 720 + Math.random() * 100,
      endFreq: 260,
      freqSteps: 6,
      duration: 0.055,
      gain: 0.13 * atten,
      steps: 6,
      filterFreq: 4200,
    });
  }

  /** Small enemy destroyed — NES-style noise burst + descending triangle thump. */
  enemyDeath(): void {
    const atten = this.triggerDensity('enemyDeath');
    const pan = (Math.random() - 0.5) * 0.6;
    const rateJit = 0.9 + Math.random() * 0.3;
    this.noiseVoice({
      mode: 'long',
      duration: 0.22,
      gain: 0.24 * atten,
      rate: rateJit,
      filterType: 'lowpass',
      filterFreq: 5000,
      endFilterFreq: 500,
      steps: 8,
      pan,
      reverb: 0.15,
    });
    this.voice({
      wave: 'triangle',
      freq: 240 * rateJit,
      endFreq: 55,
      freqSteps: 8,
      duration: 0.18,
      gain: 0.16 * atten,
      steps: 6,
      pan,
      reverb: 0.12,
    });
  }

  /** Mid-boss / boss destroyed — bigger layered explosion with a deep, reverberant boom. */
  bossDeath(): void {
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.11;
      const pan = (i - 2) * 0.2;
      this.noiseVoice({
        mode: 'long',
        duration: 0.5,
        gain: 0.26,
        rate: 1 - i * 0.08,
        filterType: 'lowpass',
        filterFreq: 6000 - i * 700,
        endFilterFreq: 150,
        steps: 10,
        delay,
        pan,
        reverb: 0.32,
      });
      this.voice({
        wave: 'triangle',
        freq: 150 - i * 12,
        endFreq: 38,
        freqSteps: 8,
        duration: 0.45,
        gain: 0.17,
        steps: 8,
        delay,
        pan,
        reverb: 0.28,
      });
    }
    this.voice({
      wave: 'triangle',
      freq: 60,
      endFreq: 22,
      freqSteps: 10,
      duration: 1.0,
      attack: 0.02,
      gain: 0.3,
      steps: 12,
      delay: 0.12,
      reverb: 0.4,
    });
  }

  /** Player takes a hit and loses a life. */
  playerHit(): void {
    this.noiseVoice({
      mode: 'short',
      duration: 0.3,
      gain: 0.24,
      rate: 1.4,
      filterType: 'bandpass',
      filterFreq: 2600,
      endFilterFreq: 300,
      steps: 8,
      reverb: 0.18,
    });
    this.voice({
      wave: 'pulse',
      duty: 0.5,
      freq: 500,
      endFreq: 90,
      freqSteps: 10,
      duration: 0.3,
      gain: 0.2,
      steps: 8,
      reverb: 0.12,
    });
  }

  /** Bomb activation — big rising sweep with a spacious tail. */
  bomb(): void {
    this.voice({
      wave: 'pulse',
      duty: 0.5,
      freq: 100,
      endFreq: 1400,
      freqSteps: 20,
      duration: 0.5,
      attack: 0.02,
      gain: 0.2,
      steps: 14,
      filterFreq: 5500,
      reverb: 0.35,
    });
    this.noiseVoice({
      mode: 'long',
      duration: 0.6,
      gain: 0.18,
      filterType: 'bandpass',
      filterFreq: 300,
      endFilterFreq: 5000,
      steps: 14,
      reverb: 0.3,
    });
    this.voice({
      wave: 'pulse',
      duty: 0.125,
      freq: 1800,
      endFreq: 500,
      freqSteps: 8,
      duration: 0.35,
      delay: 0.08,
      gain: 0.1,
      steps: 8,
      reverb: 0.25,
    });
  }

  /** Power item pickup — bright ascending pulse arpeggio (classic pickup "bling"). */
  powerUp(): void {
    const notes = [880, 1108.73, 1318.51];
    notes.forEach((f, i) => {
      this.voice({
        wave: 'pulse',
        duty: 0.25,
        freq: f,
        duration: 0.12,
        delay: i * 0.045,
        gain: 0.15,
        steps: 6,
        reverb: 0.2,
      });
    });
  }

  /** Grazing an enemy bullet — subtle high ping, rate-limited and auto-ducked since it fires often. */
  graze(): void {
    const now = performance.now();
    if (now - this.lastGraze < 110) return;
    this.lastGraze = now;
    const atten = this.triggerDensity('graze', 500);
    this.voice({
      wave: 'pulse',
      duty: 0.125,
      freq: 2100 + Math.random() * 250,
      duration: 0.03,
      gain: 0.05 * atten,
      steps: 4,
    });
  }

  /** Boss / mid-boss appears — alternating two-note 8-bit alarm siren. */
  bossAlert(): void {
    const lowF = 220;
    const highF = 277.18;
    const totalDur = 1.1;
    const stepDur = 0.09;
    const stepsCount = Math.floor(totalDur / stepDur);
    for (let i = 0; i < stepsCount; i++) {
      const f = i % 2 === 0 ? highF : lowF;
      this.voice({
        wave: 'pulse',
        duty: 0.5,
        freq: f,
        duration: stepDur * 0.95,
        hold: stepDur * 0.5,
        delay: i * stepDur,
        gain: 0.18,
        steps: 4,
        reverb: 0.25,
      });
    }
    this.voice({ wave: 'triangle', freq: 55, duration: totalDur, gain: 0.14, steps: 10, reverb: 0.3 });
  }

  /** Boss phase transition sting. */
  phaseChange(): void {
    this.noiseVoice({
      mode: 'short',
      duration: 0.3,
      gain: 0.16,
      filterType: 'highpass',
      filterFreq: 2000,
      endFilterFreq: 6000,
      steps: 6,
      reverb: 0.2,
    });
    this.voice({
      wave: 'pulse',
      duty: 0.25,
      freq: 480,
      endFreq: 1500,
      freqSteps: 8,
      duration: 0.26,
      gain: 0.15,
      steps: 6,
      reverb: 0.18,
    });
  }

  /** UI: menu cursor move. */
  menuMove(): void {
    this.voice({ wave: 'pulse', duty: 0.5, freq: 500, duration: 0.045, gain: 0.08, steps: 3 });
  }

  /** UI: confirm / start selection. */
  menuConfirm(): void {
    this.voice({ wave: 'pulse', duty: 0.5, freq: 660, duration: 0.09, gain: 0.14, steps: 5 });
    this.voice({ wave: 'pulse', duty: 0.5, freq: 990, duration: 0.12, delay: 0.06, gain: 0.14, steps: 6 });
  }

  /** Pause / unpause blip. */
  pause(): void {
    this.voice({ wave: 'pulse', duty: 0.5, freq: 440, duration: 0.08, gain: 0.12, steps: 4 });
  }

  /** Stage clear fanfare — ascending pulse-wave arpeggio. */
  stageClear(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      this.voice({
        wave: 'pulse',
        duty: 0.25,
        freq: f,
        duration: 0.22,
        delay: i * 0.11,
        gain: 0.16,
        steps: 8,
        reverb: 0.25,
      });
    });
  }

  /** Game over jingle — descending, somber pulse tones. */
  gameOver(): void {
    const notes = [392, 329.63, 261.63, 196];
    notes.forEach((f, i) => {
      this.voice({
        wave: 'pulse',
        duty: 0.5,
        freq: f,
        duration: 0.45,
        delay: i * 0.22,
        gain: 0.15,
        steps: 10,
        reverb: 0.3,
      });
    });
  }
}

export const soundManager = new SoundManager();
