/**
 * Owns the single shared AudioContext + master output used by both
 * SoundManager (SFX) and MusicManager (BGM), so they mix together cleanly
 * and only need one user-gesture unlock.
 */

type ReadyCallback = (ctx: AudioContext, destination: AudioNode) => void;

class AudioCore {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private muted = false;
  private volume = 0.9;
  private pending: ReadyCallback[] = [];

  /** Must be called from a user-gesture handler (keydown/touchstart/click). */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const callbacks = this.pending;
    this.pending = [];
    for (const cb of callbacks) cb(ctx, this.master);
  }

  /** Registers a callback that fires once the context is unlocked (immediately if already unlocked). */
  onReady(cb: ReadyCallback): void {
    if (this.ctx && this.master) {
      cb(this.ctx, this.master);
    } else {
      this.pending.push(cb);
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }
}

export const audioCore = new AudioCore();
