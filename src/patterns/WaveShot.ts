import { BulletPattern } from './Pattern';
import { Bullet } from '../entities/Bullet';
import { BulletType } from '../entities/types';

export class WaveShot extends BulletPattern {
  private interval: number;
  private speed: number;
  private bulletType: BulletType;
  private duration: number;

  constructor(interval = 80, speed = 2.5, duration = 6000, bulletType = BulletType.Odd) {
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
    const framesSince = Math.floor(this.timer / this.interval);
    const prevFrames = Math.floor((this.timer - dt) / this.interval);
    if (framesSince > prevFrames) {
      for (let i = prevFrames; i < framesSince; i++) {
        // Two streams from left and right, sine-wave pattern
        for (const side of [-1, 1]) {
          const sx = 180 + side * 120;
          const sy = -10;
          const waveX = Math.sin(this.timer * 0.003 + i * 0.5) * 2;
          bullets.push(new Bullet(
            sx, sy,
            waveX,
            this.speed,
            this.bulletType
          ));
        }
      }
    }
    return bullets;
  }
}
