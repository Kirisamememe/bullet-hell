import { Entity } from './Entity';
import { BulletPattern } from '../patterns/Pattern';
import { Bullet } from './Bullet';

export interface EnemyPalette {
  dark: string;
  mid: string;
  light: string;
  core: string;
  glow: string;
}

export const MOOK_PALETTE: EnemyPalette = {
  dark: '#7a1533', mid: '#d43a63', light: '#ff8fae', core: '#fff2c8', glow: '#ff5588',
};

export const MIDBOSS_PALETTE: EnemyPalette = {
  dark: '#5a2408', mid: '#cc5522', light: '#ffb066', core: '#fff2c0', glow: '#ff8833',
};

export const BOSS_PALETTE: EnemyPalette = {
  dark: '#5c0d0d', mid: '#cc2222', light: '#ff6a4d', core: '#ffe08a', glow: '#ff3311',
};

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
  /** Optional per-stage art palette override; falls back to type default. */
  palette?: EnemyPalette;
  /** Set true by checkPhase() on the frame a boss phase changes; caller should consume+reset. */
  phaseChangedFlag = false;

  private animTime = 0;

  // Movement behavior
  private movePath?: { x: number; y: number }[];
  private moveTimer = 0;
  private moveIndex = 0;
  // Post-path horizontal patrol
  driftSpeed = 0;   // px/s
  driftRange = 0;   // ±px from anchor
  private driftDir = 1;
  private driftAnchor = 0;
  private driftMin = 0;
  private driftMax = 0;
  private pathDone = false;

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
    // Slight per-instance animation phase offset so groups don't move in lockstep
    this.animTime = (x * 13 + y * 7) % 1000;
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
      this.phaseChangedFlag = true;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    this.animTime += dt;

    // Flash timer (blink state: on when timer%8 < 4)
    if (this.flashTimer > 0) this.flashTimer -= dt * 60 / 1000;

    // Follow move path with smooth interpolation
    if (this.movePath && this.moveIndex < this.movePath.length - 1) {
      this.moveTimer += dt;
      const interval = this.isBoss ? 1000 : 500;
      const t = Math.min(this.moveTimer / interval, 1);
      const from = this.movePath[this.moveIndex];
      const to = this.movePath[this.moveIndex + 1];
      this.x = from.x + (to.x - from.x) * t;
      this.y = from.y + (to.y - from.y) * t;
      if (t >= 1) {
        this.moveIndex++;
        this.moveTimer = 0;
        if (this.moveIndex >= this.movePath.length - 1) {
          this.pathDone = true;
          this.driftAnchor = this.x;
          this.driftMin = Math.max(8, this.x - this.driftRange);
          this.driftMax = Math.min(360 - 8 - this.width, this.x + this.driftRange);
        }
      }
    }

    // Post-path horizontal patrol
    if (this.pathDone && this.driftSpeed > 0) {
      this.x += this.driftSpeed * this.driftDir * (dt / 1000);
      if (this.x <= this.driftMin) {
        this.x = this.driftMin;
        this.driftDir = 1;
      } else if (this.x >= this.driftMax) {
        this.x = this.driftMax;
        this.driftDir = -1;
      }
    }

    // Clamp to play area
    this.x = Math.max(4, Math.min(360 - 4 - this.width, this.x));
    this.y = Math.max(0, Math.min(640 - 4 - this.height, this.y));
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    // Hit flash: rapid blink (toggle every ~80ms)
    const blinking = this.flashTimer > 0 && Math.floor(this.flashTimer / 4) % 2 === 0;

    if (blinking) {
      ctx.globalAlpha = 0.35;
    }

    if (this.isBoss) {
      this.renderBoss(ctx);
    } else if (this.isMidBoss) {
      this.renderMidBoss(ctx);
    } else {
      this.renderMook(ctx);
    }

    ctx.globalAlpha = 1;
  }

  private renderBoss(ctx: CanvasRenderingContext2D): void {
    const cx = this.cx, cy = this.cy;
    const r = this.width / 2;
    const pal = this.palette ?? BOSS_PALETTE;
    const t = this.animTime * 0.001;
    // Higher phase = faster rotation & more intense pulse
    const intensity = 1 + this.phase * 0.15;
    const rotOuter = t * 0.4 * intensity;
    const rotInner = -t * 0.7 * intensity;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 * intensity);

    // Outer aura glow
    ctx.save();
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 14 + pulse * 8;

    // Rotating outer hex shell
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotOuter);
    const outerGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    outerGrad.addColorStop(0, pal.mid);
    outerGrad.addColorStop(1, pal.dark);
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Vertex spikes
    ctx.fillStyle = pal.light;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const bx = Math.cos(a) * r, by = Math.sin(a) * r;
      const tx = Math.cos(a) * (r + 6 + pulse * 3), ty = Math.sin(a) * (r + 6 + pulse * 3);
      const perp = a + Math.PI / 2;
      const w = 3;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(perp) * w, by + Math.sin(perp) * w);
      ctx.lineTo(bx - Math.cos(perp) * w, by - Math.sin(perp) * w);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;

    // Inner counter-rotating hex plate
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotInner);
    ctx.fillStyle = pal.dark;
    ctx.globalAlpha *= 0.9;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = Math.cos(a) * r * 0.68;
      const py = Math.sin(a) * r * 0.68;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Panel seams
    ctx.strokeStyle = pal.light;
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore(); // pop shadow

    // Pulsing core with layered radial gradient
    const coreR = 6 + pulse * 2.5;
    ctx.save();
    ctx.shadowColor = pal.core;
    ctx.shadowBlur = 10 + pulse * 6;
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, pal.core);
    coreGrad.addColorStop(1, pal.glow);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Rotating iris lines across core
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 1.5 * intensity);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 3) * i * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * coreR * 0.4, Math.sin(a) * coreR * 0.4);
      ctx.lineTo(Math.cos(a) * coreR * 1.4, Math.sin(a) * coreR * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderMidBoss(ctx: CanvasRenderingContext2D): void {
    const cx = this.cx, cy = this.cy;
    const hw = this.width / 2, hh = this.height / 2;
    const pal = this.palette ?? MIDBOSS_PALETTE;
    const t = this.animTime * 0.001;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);

    // Main octagonal hull with gradient
    const hullGrad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    hullGrad.addColorStop(0, pal.mid);
    hullGrad.addColorStop(1, pal.dark);
    ctx.fillStyle = hullGrad;
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

    // Panel line details
    ctx.strokeStyle = pal.dark;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + 4, cy); ctx.lineTo(this.x + this.width - 4, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Side glowing vents (pulse)
    ctx.save();
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 6 + pulse * 4;
    ctx.fillStyle = pal.light;
    ctx.fillRect(this.x + 2, cy - 2, 4, 4);
    ctx.fillRect(this.x + this.width - 6, cy - 2, 4, 4);
    ctx.restore();

    // Rotating accent ring around central eye
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 1.1);
    ctx.strokeStyle = pal.light;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, hh * 0.42, 0, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();

    // Central eye core
    const coreR = hh * 0.28 + pulse * 1.5;
    ctx.save();
    ctx.shadowColor = pal.core;
    ctx.shadowBlur = 8 + pulse * 5;
    const eyeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    eyeGrad.addColorStop(0, '#ffffff');
    eyeGrad.addColorStop(0.55, pal.core);
    eyeGrad.addColorStop(1, pal.glow);
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
    // Iris slit
    ctx.fillStyle = pal.dark;
    ctx.fillRect(cx - coreR * 0.9, cy - 1.2, coreR * 1.8, 2.4);
    ctx.restore();
  }

  private renderMook(ctx: CanvasRenderingContext2D): void {
    const cx = this.cx, cy = this.cy;
    const s = Math.min(this.width, this.height) / 2;
    const pal = this.palette ?? MOOK_PALETTE;
    const t = this.animTime * 0.001;
    const flap = Math.sin(t * 10) * 0.35 + 0.65; // wing flap 0.3..1

    // Wings — animated flap via horizontal scale-ish shear using flap factor
    const wingSpan = s * 0.55 * flap;
    ctx.fillStyle = pal.mid;
    // Left wing
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - s * 0.1);
    ctx.lineTo(cx - wingSpan - s * 0.3, this.y + s * 0.15);
    ctx.lineTo(this.x, cy + s * 0.6);
    ctx.lineTo(cx - wingSpan * 0.4, cy + s * 0.35);
    ctx.closePath();
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - s * 0.1);
    ctx.lineTo(cx + wingSpan + s * 0.3, this.y + s * 0.15);
    ctx.lineTo(this.x + this.width, cy + s * 0.6);
    ctx.lineTo(cx + wingSpan * 0.4, cy + s * 0.35);
    ctx.closePath();
    ctx.fill();

    // Wing edge highlight
    ctx.strokeStyle = pal.light;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - s * 0.1); ctx.lineTo(cx - wingSpan - s * 0.3, this.y + s * 0.15);
    ctx.moveTo(cx + 1, cy - s * 0.1); ctx.lineTo(cx + wingSpan + s * 0.3, this.y + s * 0.15);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Fuselage with gradient nose-to-tail
    const bodyGrad = ctx.createLinearGradient(cx, this.y, cx, this.y + this.height);
    bodyGrad.addColorStop(0, pal.light);
    bodyGrad.addColorStop(1, pal.dark);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(cx, this.y);
    ctx.lineTo(cx + 3, cy - s * 0.2);
    ctx.lineTo(cx + 2.5, this.y + this.height);
    ctx.lineTo(cx - 2.5, this.y + this.height);
    ctx.lineTo(cx - 3, cy - s * 0.2);
    ctx.closePath();
    ctx.fill();

    // Glowing core (cockpit)
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + this.x * 0.05);
    ctx.save();
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 5 + pulse * 3;
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.05, 2 + pulse * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Engine flare trail
    const flareAlpha = 0.4 + flap * 0.4;
    ctx.fillStyle = `rgba(255, 200, 120, ${flareAlpha})`;
    ctx.fillRect(cx - 1.5, this.y + this.height - 1, 3, 3 + flap * 2);
  }
}
