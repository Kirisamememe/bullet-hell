import { Entity } from './Entity';
import { Bullet } from './Bullet';
import { BulletType } from './types';
import { InputState } from '../core/Input';

const PLAYER_SIZE = 16;
const PLAYER_HALF = PLAYER_SIZE / 2;
const NORMAL_SPEED = 4;
const SLOW_SPEED = 2;
const SHOOT_INTERVAL = 250; // ms between shots (4/sec)
const INVINCIBLE_DURATION = 2000; // ms
const BOMB_DURATION = 2000; // ms
const PLAY_AREA_LEFT = 16;
const PLAY_AREA_RIGHT = 360 - 16;
const PLAY_AREA_TOP = 40; // below HUD
const PLAY_AREA_BOTTOM = 640 - 16;

export class Player extends Entity {
  speed = NORMAL_SPEED;
  invincible = true;
  invincibleTimer = 2000;
  shootTimer = 0;
  bombTimer = 0;
  power = 1;
  blinkVisible = true;
  private blinkTimer = 0;
  private touchWasActive = false;

  /** Touch Y offset: ship renders this many px above the finger */
  private static readonly TOUCH_Y_OFFSET = 48;

  constructor() {
    super(180 - PLAYER_HALF, 560, PLAYER_SIZE, PLAYER_SIZE);
  }

  handleInput(
    input: InputState,
    screenToGame?: (sx: number, sy: number) => { x: number; y: number }
  ): void {
    this.speed = input.slow ? SLOW_SPEED : NORMAL_SPEED;

    if (input.touchActive && screenToGame) {
      // Convert screen touch coords to game coords
      const target = screenToGame(input.touchX, input.touchY);
      // Offset so ship is above the finger
      target.y -= Player.TOUCH_Y_OFFSET;

      if (!this.touchWasActive) {
        // First touch: snap to finger position
        this.x = target.x - this.width / 2;
        this.y = target.y - this.height / 2;
      } else {
        // Continued touch: lerp smoothly toward target
        const lerpFactor = 0.25;
        this.x += (target.x - this.cx) * lerpFactor;
        this.y += (target.y - this.cy) * lerpFactor;
      }
      this.touchWasActive = true;
    } else {
      this.touchWasActive = false;

      // Keyboard movement
      let dx = 0, dy = 0;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;

      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
      }

      this.x += dx * this.speed;
      this.y += dy * this.speed;
    }

    // Clamp to play area
    this.x = Math.max(PLAY_AREA_LEFT, Math.min(PLAY_AREA_RIGHT - this.width, this.x));
    this.y = Math.max(PLAY_AREA_TOP, Math.min(PLAY_AREA_BOTTOM - this.height, this.y));
  }

  shoot(dt: number): Bullet[] {
    this.shootTimer -= dt;
    if (this.shootTimer > 0) return [];

    this.shootTimer = SHOOT_INTERVAL;
    const bullets: Bullet[] = [];
    const cx = this.cx;

    switch (this.power) {
      case 1:
        bullets.push(new Bullet(cx, this.y, 0, -8, BulletType.Normal, true));
        break;
      case 2:
        bullets.push(new Bullet(cx - 4, this.y, 0, -8, BulletType.Normal, true));
        bullets.push(new Bullet(cx + 4, this.y, 0, -8, BulletType.Normal, true));
        break;
      case 3:
        bullets.push(new Bullet(cx, this.y, 0, -8, BulletType.Normal, true));
        bullets.push(new Bullet(cx - 6, this.y, -0.5, -8, BulletType.Normal, true));
        bullets.push(new Bullet(cx + 6, this.y, 0.5, -8, BulletType.Normal, true));
        break;
      case 4:
        bullets.push(new Bullet(cx - 6, this.y, 0, -8, BulletType.Normal, true));
        bullets.push(new Bullet(cx + 6, this.y, 0, -8, BulletType.Normal, true));
        bullets.push(new Bullet(cx - 12, this.y, -1, -7, BulletType.Normal, true));
        bullets.push(new Bullet(cx + 12, this.y, 1, -7, BulletType.Normal, true));
        break;
      case 5:
        bullets.push(new Bullet(cx - 6, this.y, 0, -8, BulletType.Normal, true));
        bullets.push(new Bullet(cx + 6, this.y, 0, -8, BulletType.Normal, true));
        bullets.push(new Bullet(cx - 14, this.y, -1, -7, BulletType.Normal, true));
        bullets.push(new Bullet(cx + 14, this.y, 1, -7, BulletType.Normal, true));
        // Homing — just fires two extra aimed upward with slight spread
        bullets.push(new Bullet(cx - 3, this.y, -0.3, -8, BulletType.Fast, true));
        bullets.push(new Bullet(cx + 3, this.y, 0.3, -8, BulletType.Fast, true));
        break;
    }

    return bullets;
  }

  useBomb(): void {
    this.bombTimer = BOMB_DURATION;
    this.invincible = true;
    this.invincibleTimer = Math.max(this.invincibleTimer, BOMB_DURATION);
  }

  /** Called when hit by enemy bullet. Returns true if player died. */
  hit(): boolean {
    if (this.invincible) return false;
    this.invincible = true;
    this.invincibleTimer = INVINCIBLE_DURATION;
    if (this.power > 1) this.power--;
    return true; // caller decrements lives
  }

  update(dt: number): void {
    // Invincibility timer
    if (this.invincible) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.invincibleTimer = 0;
      }
    }
    // Bomb timer
    if (this.bombTimer > 0) {
      this.bombTimer -= dt;
      if (this.bombTimer < 0) this.bombTimer = 0;
    }
    // Blink animation during invincibility
    if (this.invincible) {
      this.blinkTimer += dt;
      this.blinkVisible = Math.floor(this.blinkTimer / 100) % 2 === 0;
    } else {
      this.blinkVisible = true;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.blinkVisible) return;

    const cx = this.cx;
    const top = this.y;
    const bot = this.y + this.height;
    const mid = this.cy;
    const half = PLAYER_HALF;

    // Main fuselage — layered triangle
    ctx.fillStyle = '#005588';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + half, bot);
    ctx.lineTo(cx, bot - 4);
    ctx.lineTo(cx - half, bot);
    ctx.closePath();
    ctx.fill();

    // Upper hull highlight
    ctx.fillStyle = '#0077bb';
    ctx.beginPath();
    ctx.moveTo(cx, top + 2);
    ctx.lineTo(cx + half - 2, bot - 2);
    ctx.lineTo(cx, bot - 5);
    ctx.lineTo(cx - half + 2, bot - 2);
    ctx.closePath();
    ctx.fill();

    // Cockpit canopy
    ctx.fillStyle = '#44ccff';
    ctx.fillRect(cx - 3, top + 4, 6, 5);
    ctx.fillStyle = '#aaeeff';
    ctx.fillRect(cx - 1, top + 5, 2, 2);

    // Wing accents
    ctx.fillStyle = '#00aadd';
    ctx.fillRect(cx - half + 1, bot - 8, 4, 2);
    ctx.fillRect(cx + half - 5, bot - 8, 4, 2);

    // Nacelles (side pods)
    ctx.fillStyle = '#004466';
    ctx.fillRect(cx - half - 1, mid, 3, 6);
    ctx.fillRect(cx + half - 2, mid, 3, 6);

    // Engine glow (two nozzles)
    const glowPhase = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(cx - 4, bot - 2, 3, 4);
    ctx.fillRect(cx + 1, bot - 2, 3, 4);
    ctx.fillStyle = `rgba(255, 200, 50, ${glowPhase})`;
    ctx.fillRect(cx - 3, bot, 2, 3);
    ctx.fillRect(cx + 1, bot, 2, 3);

    // Hitbox indicator (only visible when slow-moving)
    if (this.speed === SLOW_SPEED) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(cx - 1, this.cy - 1, 2, 2);
      // Crosshair ring
      ctx.strokeStyle = '#ff000044';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, this.cy, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
