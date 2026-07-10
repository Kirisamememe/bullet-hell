import { BulletPattern } from './Pattern';
import { Bullet } from '../entities/Bullet';
import { BulletType } from '../entities/types';

export class SpiralShot extends BulletPattern {
  private interval: number;
  private speed: number;
  private bulletType: BulletType;
  private angle = 0;
  private duration: number;

  constructor(interval = 100, speed = 2, duration = 5000, bulletType = BulletType.Normal) {
    super();
    this.interval = interval;
    this.speed = speed;
    this.duration = duration;
    this.bulletType = bulletType;
  }

  update(dt: number, _px = 180, _py = 300): Bullet[] {
    this.timer += dt;
    if (this.timer > this.duration) {
      this.isFinished = true;
      return [];
    }
    const bullets: Bullet[] = [];
    // Accumulate dt and fire on interval
    // Using a frame-counter approach
    this.angle += dt * 0.004; // rotation speed
    const framesSinceLast = Math.floor(this.timer / this.interval);
    const prevFrames = Math.floor((this.timer - dt) / this.interval);
    if (framesSinceLast > prevFrames) {
      for (let i = prevFrames; i < framesSinceLast; i++) {
        const a = this.angle + i * 0.3;
        bullets.push(new Bullet(
          180, 200,
          Math.cos(a) * this.speed,
          Math.sin(a) * this.speed,
          this.bulletType
        ));
      }
    }
    return bullets;
  }
}
