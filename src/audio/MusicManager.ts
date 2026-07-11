/**
 * Tiny 4-channel chiptune sequencer, styled after the NES/Famicom 2A03:
 * two pulse-wave channels (melody + harmony), one triangle channel (bass),
 * and one LFSR-noise channel (drums). Tracks are authored as compact
 * note-event lists in `tracks.ts` and looped forever with a lookahead
 * scheduler so timing stays sample-accurate regardless of frame rate.
 */

import { audioCore } from './AudioCore';
import { applyStepEnvelope, buildLfsrNoiseBuffer, createPulseWave } from './chip';

export type DrumHit = 'kick' | 'hat' | 'accent';
/** [pitch in Hz (pulse/triangle) or drum hit name (noise), duration in 16th-note steps] */
export type NoteEvent = [number | DrumHit | null, number];

export interface ChannelPattern {
  wave: 'pulse' | 'triangle' | 'noise';
  duty?: number; // pulse only
  gain: number;
  /** Must sum (steps) to exactly Track.totalSteps so all channels loop in sync. */
  events: NoteEvent[];
}

export interface Track {
  bpm: number;
  totalSteps: number; // 16th notes in one full loop
  channels: ChannelPattern[];
}

const SCHEDULE_AHEAD = 0.2; // seconds
const TICK_INTERVAL_MS = 50;

class MusicManager {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noiseLong: AudioBuffer | null = null;
  private noiseShort: AudioBuffer | null = null;
  private dutyCache = new Map<number, PeriodicWave>();

  private currentTrack: Track | null = null;
  private trackName: string | null = null;
  private schedulerHandle: number | null = null;
  private stepDur = 0;
  private cursors: { index: number; nextTime: number }[] = [];
  private volume = 0.4;
  private muted = false;

  constructor() {
    audioCore.onReady((ctx, dest) => this.init(ctx, dest));
  }

  private init(ctx: AudioContext, dest: AudioNode): void {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(dest);
    this.noiseLong = buildLfsrNoiseBuffer(ctx, 'long', 1);
    this.noiseShort = buildLfsrNoiseBuffer(ctx, 'short', 1);
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

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.bus && this.ctx) {
      this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bus.gain.linearRampToValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime + 0.15);
    }
    return this.muted;
  }

  /** Starts looping `track` under `name`; no-ops if it's already playing. Crossfades away from whatever was playing before. */
  play(name: string, track: Track, fade = 0.5): void {
    if (!this.ctx || !this.bus) return;
    if (this.trackName === name) return;
    this.stopScheduler();
    this.trackName = name;
    this.currentTrack = track;
    this.stepDur = 60 / track.bpm / 4;
    const startAt = this.ctx.currentTime + 0.05;
    this.cursors = track.channels.map(() => ({ index: 0, nextTime: startAt }));

    this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bus.gain.setValueAtTime(this.bus.gain.value, this.ctx.currentTime);
    this.bus.gain.linearRampToValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime + fade);

    this.tick();
    this.schedulerHandle = window.setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  /** Stops the current track with a fade-out. */
  stop(fade = 0.4): void {
    if (this.ctx && this.bus) {
      this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bus.gain.setValueAtTime(this.bus.gain.value, this.ctx.currentTime);
      this.bus.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fade);
    }
    this.stopScheduler();
    this.trackName = null;
    this.currentTrack = null;
  }

  private stopScheduler(): void {
    if (this.schedulerHandle !== null) {
      window.clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }

  private tick(): void {
    if (!this.ctx || !this.currentTrack) return;
    const track = this.currentTrack;
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD;
    track.channels.forEach((chan, ci) => {
      const cursor = this.cursors[ci];
      if (!cursor || chan.events.length === 0) return;
      while (cursor.nextTime < horizon) {
        const [value, steps] = chan.events[cursor.index % chan.events.length];
        const dur = steps * this.stepDur;
        this.playEvent(chan, value, cursor.nextTime, dur);
        cursor.nextTime += dur;
        cursor.index++;
      }
    });
  }

  private playEvent(chan: ChannelPattern, value: number | DrumHit | null, t0: number, dur: number): void {
    if (value === null || !this.ctx || !this.bus) return;
    if (chan.wave === 'noise') {
      this.playDrum(value as DrumHit, t0, chan.gain);
      return;
    }
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    if (chan.wave === 'pulse') {
      osc.setPeriodicWave(this.getPulseWave(chan.duty ?? 0.5));
    } else {
      osc.type = 'triangle';
    }
    osc.frequency.setValueAtTime(value as number, t0);

    const noteDur = Math.max(0.03, dur * 0.9); // small gap between notes = staccato "chip" articulation
    const attack = Math.min(0.012, noteDur * 0.2);
    const decay = Math.max(0.02, noteDur - attack);

    const gain = ctx.createGain();
    applyStepEnvelope(gain.gain, t0, chan.gain, attack, 0, decay, 6);
    osc.connect(gain).connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + noteDur + 0.02);
  }

  private playDrum(kind: DrumHit, t0: number, gain: number): void {
    if (!this.ctx || !this.bus || !this.noiseLong || !this.noiseShort) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    if (kind === 'kick') {
      src.buffer = this.noiseLong;
      src.playbackRate.value = 0.7;
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      applyStepEnvelope(g.gain, t0, gain * 1.1, 0.001, 0, 0.09, 6);
    } else if (kind === 'accent') {
      src.buffer = this.noiseShort;
      src.playbackRate.value = 1.6;
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      applyStepEnvelope(g.gain, t0, gain * 0.9, 0.001, 0, 0.05, 5);
    } else {
      src.buffer = this.noiseShort;
      src.playbackRate.value = 2.2;
      filter.type = 'highpass';
      filter.frequency.value = 5000;
      applyStepEnvelope(g.gain, t0, gain * 0.6, 0.001, 0, 0.035, 4);
    }

    src.connect(filter).connect(g).connect(this.bus);
    src.start(t0);
    src.stop(t0 + 0.16);
  }
}

export const musicManager = new MusicManager();
