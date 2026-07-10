import { BulletPattern } from './Pattern';
import { Bullet } from '../entities/Bullet';
import { BulletType } from '../entities/types';

export class AimedShot extends BulletPattern {
  private interval: number;
  private speed: number;
  private bulletType: BulletType;
  private count: number;
  private fired = 0;

  constructor(interval = 500, speed = 3, count = Infinity, bulletType = BulletType.Normal) {
    super();
    this.interval = interval;
    this.speed = speed;
    this.count = count;
    this.bulletType = bulletType;
  }

  update(dt: number, playerX = 180, playerY = 300): Bullet[] {
    if (this.fired >= this.count) {
      this.isFinished = true;
      return [];
    }

    this.timer += dt;
    const bullets: Bullet[] = [];

    while (this.timer >= this.interval && this.fired < this.count) {
      this.timer -= this.interval;
      this.fired++;
      // Fire from top/center toward player
      const sx = 180 + Math.sin(this.fired * 1.7) * 100;
      const sy = -10;
      const dx = playerX - sx;
      const dy = playerY - sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push(new Bullet(
        sx, sy,
        (dx / dist) * this.speed,
        (dy / dist) * this.speed,
        this.bulletType
      ));
    }
    return bullets;
  }
}
