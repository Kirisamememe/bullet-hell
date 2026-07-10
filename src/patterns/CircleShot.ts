import { BulletPattern } from './Pattern';
import { Bullet } from '../entities/Bullet';
import { BulletType } from '../entities/types';

export class CircleShot extends BulletPattern {
  private interval: number;
  private speed: number;
  private bulletCount: number;
  private bulletType: BulletType;
  private fired = false;

  constructor(interval = 2000, speed = 2, bulletCount = 36, bulletType = BulletType.Normal) {
    super();
    this.interval = interval;
    this.speed = speed;
    this.bulletCount = bulletCount;
    this.bulletType = bulletType;
  }

  update(dt: number, _px = 180, _py = 300): Bullet[] {
    this.timer += dt;
    if (this.timer >= this.interval && !this.fired) {
      this.fired = true;
      const angleStep = (Math.PI * 2) / this.bulletCount;
      const bullets: Bullet[] = [];
      for (let i = 0; i < this.bulletCount; i++) {
        const angle = angleStep * i + this.timer * 0.001;
        bullets.push(new Bullet(
          180, 200,
          Math.cos(angle) * this.speed,
          Math.sin(angle) * this.speed,
          this.bulletType
        ));
      }
      return bullets;
    }
    return [];
  }
}
