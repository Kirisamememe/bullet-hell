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

    const flashing = this.flashTimer > 0;

    if (this.isBoss) {
      this.renderBoss(ctx, flashing);
    } else if (this.isMidBoss) {
      this.renderMidBoss(ctx, flashing);
    } else {
      this.renderMook(ctx, flashing);
    }
  }

  private renderBoss(ctx: CanvasRenderingContext2D, flash: boolean): void {
    const cx = this.cx, cy = this.cy;
    const r = this.width / 2;
    const dark = '#881111', mid = '#cc2222', light = flash ? '#ffffff' : '#ff5544', core = flash ? '#ffffff' : '#ffaa00';

    // Outer hex body
    ctx.fillStyle = dark;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Inner hex (mid color)
    ctx.fillStyle = mid;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * r * 0.7;
      const py = cy + Math.sin(a) * r * 0.7;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Bright accent lines from center to vertices
    ctx.strokeStyle = light;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
      ctx.stroke();
    }

    // Core
    ctx.fillStyle = core;
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);

    // HP bar (below boss)
    const hpW = 64, hpH = 4, hpY = this.y - 8;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - hpW / 2, hpY, hpW, hpH);
    ctx.fillStyle = '#333333';
    ctx.fillRect(cx - hpW / 2 + 1, hpY + 1, hpW - 2, hpH - 2);
    const ratio = this.hp / this.maxHp;
    const hpColor = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff2222';
    ctx.fillStyle = hpColor;
    ctx.fillRect(cx - hpW / 2 + 1, hpY + 1, Math.floor((hpW - 2) * ratio), hpH - 2);
  }

  private renderMidBoss(ctx: CanvasRenderingContext2D, flash: boolean): void {
    const cx = this.cx, cy = this.cy;
    const hw = this.width / 2, hh = this.height / 2;
    const base = flash ? '#ffffff' : '#cc4422';
    const dark = flash ? '#ffffff' : '#661a0a';
    const accent = flash ? '#ffffff' : '#ff6644';

    // Main body — octagonal
    ctx.fillStyle = dark;
    ctx.beginPath();
    const pts = [
      [cx - hw * 0.6, this.y], [cx + hw * 0.6, this.y],
      [this.x + this.width, cy - hh * 0.4], [this.x + this.width, cy + hh * 0.4],
      [cx + hw * 0.6, this.y + this.height], [cx - hw * 0.6, this.y + this.height],
      [this.x, cy + hh * 0.4], [this.x, cy - hh * 0.4],
    ];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();

    // Inner body
    ctx.fillStyle = base;
    ctx.fillRect(cx - hw * 0.35, cy - hh * 0.35, hw * 0.7, hh * 0.7);

    // Eye-like details
    ctx.fillStyle = accent;
    ctx.fillRect(cx - hw * 0.25, cy - 4, 6, 4);
    ctx.fillRect(cx + hw * 0.25 - 6, cy - 4, 6, 4);

    // Core glow
    ctx.fillStyle = flash ? '#ffffff' : '#ffaa44';
    ctx.fillRect(cx - 3, cy + 2, 6, 6);

    // HP bar
    const hpW = 50, hpH = 3, hpY = this.y - 6;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - hpW / 2, hpY, hpW, hpH);
    ctx.fillStyle = '#ff6644';
    ctx.fillRect(cx - hpW / 2, hpY, Math.floor(hpW * (this.hp / this.maxHp)), hpH);
  }

  private renderMook(ctx: CanvasRenderingContext2D, flash: boolean): void {
    const cx = this.cx, cy = this.cy;
    const s = Math.min(this.width, this.height) / 2;
    const body = flash ? '#ffffff' : '#ff5577';
    const wing = flash ? '#ffffff' : '#cc3355';
    const detail = flash ? '#ffffff' : '#ff99aa';

    // Left wing
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy);
    ctx.lineTo(this.x, this.y);
    ctx.lineTo(this.x, cy + s * 0.6);
    ctx.lineTo(this.x + s * 0.5, cy + s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Right wing
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy);
    ctx.lineTo(this.x + this.width, this.y);
    ctx.lineTo(this.x + this.width, cy + s * 0.6);
    ctx.lineTo(this.x + this.width - s * 0.5, cy + s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = body;
    ctx.fillRect(cx - 3, cy - s * 0.5, 6, s);

    // Cockpit/canopy
    ctx.fillStyle = detail;
    ctx.fillRect(cx - 2, cy - s * 0.3, 4, s * 0.4);
  }
}
