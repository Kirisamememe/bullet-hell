/**
 * Shared NES/Famicom-style (2A03-inspired) synthesis primitives used by both
 * SoundManager (one-shot SFX) and MusicManager (BGM sequencer). Nothing here
 * plays audio on its own — these are just waveform/envelope building blocks.
 */

/** Builds a band-limited pulse wave with a given duty cycle (0..1) for use as an oscillator's periodic wave. */
export function createPulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const N = 32;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

export type NoiseMode = 'long' | 'short';

/**
 * Renders the NES APU's 15-bit LFSR noise generator into a buffer.
 * 'long' mode (feedback = bit0 ^ bit1) gives a dense hiss good for explosions.
 * 'short' mode (feedback = bit0 ^ bit6) has a short 93-sample repeat cycle
 * that reads as a metallic/tonal buzz — the classic NES "electric" texture.
 */
export function buildLfsrNoiseBuffer(ctx: BaseAudioContext, mode: NoiseMode, seconds = 1): AudioBuffer {
  const total = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, total, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lfsr = 1;
  for (let i = 0; i < total; i++) {
    data[i] = lfsr & 1 ? 1 : -1;
    const bit0 = lfsr & 1;
    const tap = mode === 'short' ? (lfsr >> 6) & 1 : (lfsr >> 1) & 1;
    const feedback = bit0 ^ tap;
    lfsr = (lfsr >> 1) | (feedback << 14);
  }
  return buffer;
}

/**
 * Quantized (staircase) envelope mimicking the NES APU's 4-bit linear volume
 * register — real hardware can't do smooth exponential curves, it steps
 * through 16 discrete levels. That stepping is a big part of what makes chip
 * sounds feel punchy/percussive instead of a soft synth "boop".
 */
export function applyStepEnvelope(
  param: AudioParam,
  t0: number,
  peak: number,
  attack: number,
  hold: number,
  decay: number,
  steps = 10
): void {
  param.cancelScheduledValues(t0);
  param.setValueAtTime(0, t0);
  if (attack > 0) {
    const aSteps = 3;
    for (let s = 1; s <= aSteps; s++) {
      param.setValueAtTime((peak * s) / aSteps, t0 + (attack * s) / aSteps);
    }
  } else {
    param.setValueAtTime(peak, t0);
  }
  const holdEnd = t0 + attack + hold;
  if (hold > 0) param.setValueAtTime(peak, holdEnd);
  const dSteps = Math.max(1, Math.floor(steps));
  for (let s = 1; s <= dSteps; s++) {
    const t = holdEnd + (decay * s) / dSteps;
    const v = peak * (1 - s / dSteps);
    param.setValueAtTime(Math.max(0.0001, v), t);
  }
}

/**
 * Quantized pitch glide — steps through discrete frequency values rather than
 * a smooth analog sweep, since the NES pitch registers are only updated a
 * handful of times per effect. This "zip" texture is what makes a downward
 * sweep read as a laser zap instead of a smooth sci-fi swoosh.
 */
export function steppedFreqRamp(
  param: AudioParam,
  t0: number,
  duration: number,
  startFreq: number,
  endFreq: number,
  steps = 12
): void {
  param.setValueAtTime(startFreq, t0);
  const n = Math.max(1, Math.floor(steps));
  for (let s = 1; s <= n; s++) {
    const t = t0 + (duration * s) / n;
    const ratio = s / n;
    const f = startFreq * Math.pow(endFreq / startFreq, ratio);
    param.setValueAtTime(Math.max(1, f), t);
  }
}

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

/** Parses scientific pitch notation (e.g. "C4", "F#3", "A5") into Hz, A4 = 440. */
export function noteFreq(name: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 0;
  const [, pitch, octaveStr] = m;
  const octave = parseInt(octaveStr, 10);
  const semitone = NOTE_INDEX[pitch] + (octave - 4) * 12 - 9;
  return 440 * Math.pow(2, semitone / 12);
}
