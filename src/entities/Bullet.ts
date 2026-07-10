import { Entity } from './Entity';
import { BulletType, BULLET_COLORS, BULLET_RADII } from './types';

const TRAIL_LENGTH = 4;

export class Bullet extends Entity {
  readonly bulletType: BulletType;
  readonly damage: number;
  readonly friendly: boolean;
  private trail: { x: number; y: number }[] = [];

  constructor(
    x: number, y: number,
    vx: number, vy: number,
    bulletType: BulletType,
    friendly: boolean = false,
    damage: number = 1
  ) {
    const r = BULLET_RADII[bulletType];
    super(x - r, y - r, r * 2, r * 2);
    this.vx = vx;
    this.vy = vy;
    this.bulletType = bulletType;
    this.friendly = friendly;
    this.damage = damage;
    // Pre-fill trail at spawn position
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      this.trail.push({ x: this.cx, y: this.cy });
    }
  }

  /** Radius for collision purposes */
  get radius(): number {
    return BULLET_RADII[this.bulletType];
  }

  update(_dt: number): void {
    // Push current position onto trail
    this.trail.push({ x: this.cx, y: this.cy });
    if (this.trail.length > TRAIL_LENGTH) {
      this.trail.shift();
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.isOffScreen(32, 32)) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Draw trail
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = (i + 1) / (this.trail.length + 1) * 0.4;
      const r = this.radius * (i + 1) / (this.trail.length + 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = BULLET_COLORS[this.bulletType];
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bullet body with glow
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = BULLET_COLORS[this.bulletType];
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }
}
