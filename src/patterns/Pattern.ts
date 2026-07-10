import type { Bullet } from '../entities/Bullet';

export abstract class BulletPattern {
  protected timer = 0;
  isFinished = false;

  /** Returns new bullets this frame. Call every update tick. */
  abstract update(dt: number, playerX?: number, playerY?: number): Bullet[];

  reset(): void {
    this.timer = 0;
    this.isFinished = false;
  }
}
