import { BulletPattern } from './Pattern';
import { Bullet } from '../entities/Bullet';
import { BulletType } from '../entities/types';

export class LaserShot extends BulletPattern {
  private duration: number;
  private warmup: number;
  private fired = false;

  constructor(warmup = 1500, duration = 2000) {
    super();
    this.warmup = warmup;
    this.duration = duration;
  }

  update(dt: number, playerX = 180, _py = 300): Bullet[] {
    this.timer += dt;
    if (this.timer < this.warmup) {
      return []; // charging — render warning line (handled elsewhere)
    }
    if (!this.fired) {
      this.fired = true;
      this.timer = 0;
    }
    if (this.timer > this.duration) {
      this.isFinished = true;
      return [];
    }

    // Fire laser as a stream of fast bullets aimed at player
    const bullets: Bullet[] = [];
    const sx = 180;
    const sy = 60;
    const dx = playerX - sx;
    const dy = 560 - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Fire a few bullets per frame to create a solid beam effect
    for (let i = 0; i < 3; i++) {
      bullets.push(new Bullet(
        sx + (Math.random() - 0.5) * 12,
        sy,
        (dx / dist) * 7,
        (dy / dist) * 7,
        BulletType.Laser
      ));
    }
    return bullets;
  }

  /** Returns true during warmup phase */
  get isCharging(): boolean {
    return this.timer < this.warmup;
  }
}
