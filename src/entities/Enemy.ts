import { Entity } from './Entity';
import { BulletPattern } from '../patterns/Pattern';
import { Bullet } from './Bullet';

export class Enemy extends Entity {
  hp: number;
  maxHp: number;
  scoreValue: number;
  isBoss: boolean;
  isMidBoss: boolean;
  phase = 0;
  flashTimer = 0;
  dropPowerItem = false;
  patterns: BulletPattern[] = [];

  // Movement behavior
  private movePath?: { x: number; y: number }[];
  private moveTimer = 0;
  private moveIndex = 0;

  constructor(
    x: number, y: number,
    width: number, height: number,
    hp: number,
    scoreValue: number,
    isBoss = false,
    isMidBoss = false
  ) {
    super(x, y, width, height);
    this.hp = hp;
    this.maxHp = hp;
    this.scoreValue = scoreValue;
    this.isBoss = isBoss;
    this.isMidBoss = isMidBoss;
  }

  setMovePath(path: { x: number; y: number }[]): void {
    this.movePath = path;
    this.moveIndex = 0;
    this.moveTimer = 0;
    if (path.length > 0) {
      this.x = path[0].x;
      this.y = path[0].y;
    }
  }

  /** Returns true if dead */
  takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    this.flashTimer = 60; // 1 frame of white flash (will count down)
    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      // Bosses always drop power, regular enemies 20% chance
      this.dropPowerItem = this.isBoss || this.isMidBoss || Math.random() < 0.2;
      return true;
    }
    return false;
  }

  /** Get bullets from all active patterns this frame */
  getBullets(dt: number, playerX: number, playerY: number): Bullet[] {
    const bullets: Bullet[] = [];
    for (const pattern of this.patterns) {
      if (!pattern.isFinished) {
        bullets.push(...pattern.update(dt, playerX, playerY));
      }
    }
    return bullets;
  }

  /** Check phase transitions based on HP percentage */
  checkPhase(): boolean {
    if (!this.isBoss) return false;
    const hpPct = this.hp / this.maxHp;
    const newPhase = this.isMidBoss
      ? (hpPct < 0.5 ? 2 : 1)
      : (hpPct < 0.2 ? 5 : hpPct < 0.4 ? 4 : hpPct < 0.6 ? 3 : hpPct < 0.8 ? 2 : 1);
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    // Flash timer
    if (this.flashTimer > 0) this.flashTimer -= dt * 60 / 1000;

    // Follow move path
    if (this.movePath && this.moveIndex < this.movePath.length) {
      this.moveTimer += dt;
      // Move to next waypoint every 500ms by default (or faster for bosses)
      const waypointInterval = this.isBoss ? 1000 : 500;
      const nextIndex = Math.min(
        Math.floor(this.moveTimer / waypointInterval),
        this.movePath.length - 1
      );
      if (nextIndex !== this.moveIndex) {
        this.moveIndex = nextIndex;
        this.x = this.movePath[this.moveIndex].x;
        this.y = this.movePath[this.moveIndex].y;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    // Flash white when damaged
    const baseColor = this.flashTimer > 0 ? '#ffffff' :
      (this.isBoss ? '#ff2222' : this.isMidBoss ? '#ff6622' : '#ff4466');

    if (this.isBoss) {
      // Boss: large hexagonal-ish shape
      ctx.fillStyle = baseColor;
      const cx = this.cx, cy = this.cy;
      const r = this.width / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // HP bar below boss
      const hpW = 60, hpH = 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(cx - hpW / 2, this.y - 10, hpW, hpH);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(cx - hpW / 2, this.y - 10, hpW * (this.hp / this.maxHp), hpH);
    } else if (this.isMidBoss) {
      ctx.fillStyle = baseColor;
      ctx.fillRect(this.x, this.y, this.width, this.height);
    } else {
      // Mook: simple diamond
      ctx.fillStyle = baseColor;
      const cx = this.cx, cy = this.cy;
      ctx.beginPath();
      ctx.moveTo(cx, this.y);
      ctx.lineTo(this.x + this.width, cy);
      ctx.lineTo(cx, this.y + this.height);
      ctx.lineTo(this.x, cy);
      ctx.closePath();
      ctx.fill();
    }
  }
}
