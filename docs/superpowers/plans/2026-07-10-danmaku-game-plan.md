# 弾幕煉獄 (Danma Rengo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based vertical-scrolling bullet-hell STG with 5 stages, keyboard + touch input, and pixel-art visuals using Bun + TypeScript + Canvas with zero dependencies.

**Architecture:** Single-page app with an offscreen Canvas (360×640) rendered via nearest-neighbor scaling. A custom game loop drives entity updates, bullet pattern generation, collision detection, and layered rendering. Scenes (title, gameplay, game over) are managed by a state machine in Game.ts.

**Tech Stack:** Bun (runtime + test), TypeScript strict mode, HTML5 Canvas API, no external dependencies.

## Global Constraints

- Runtime: Bun latest
- Language: TypeScript strict mode
- Base resolution: 360×640 (9:16 portrait)
- Render: offscreen Canvas → nearest-neighbor CSS scaling
- FPS: 60fps via requestAnimationFrame + delta-time
- All visuals: code-drawn (no image assets)
- Input: Keyboard (arrows/Z/X/Shift/Esc) + Touch (drag-move, auto-shoot, bomb button)
- Player hitbox: 1px point at center
- Layers: background(3 parallax) → bullets → enemies → player → effects → HUD

---

### Task 1: Project Scaffold and TypeScript Config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`

**Produces:** Runnable dev server that opens a blank page with a Canvas element.

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/kirisame/projects/bullet-hell
bun init -y
```

Then edit `package.json` to contain:

```json
{
  "name": "danma-rengo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/main.ts",
    "build": "bun build src/main.ts --outdir=dist --target=browser",
    "start": "bun run dist/main.js"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

- [ ] **Step 2: Configure TypeScript**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "outDir": "dist",
    "rootDir": ".",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": []
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create HTML shell**

Write `index.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>弾幕煉獄</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; image-rendering: pixelated; }
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Write minimal entry point**

Write `src/main.ts`:

```typescript
const canvas = document.getElementById('game') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element #game not found');
const ctx = canvas.getContext('2d')!;

canvas.width = 360;
canvas.height = 640;
canvas.style.width = '100%';
canvas.style.height = '100%';

ctx.fillStyle = '#111';
ctx.fillRect(0, 0, 360, 640);
ctx.fillStyle = '#fff';
ctx.font = '16px monospace';
ctx.fillText('弾幕煉獄 loading...', 100, 320);
```

- [ ] **Step 5: Verify dev server runs**

```bash
bun run dev
```

Open http://localhost:3000 (or whatever port Bun assigns). Verify: black canvas with "弾幕煉獄 loading..." text visible.

Expected: Page loads, canvas fills viewport, text centered.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: project scaffold with Bun + TypeScript + Canvas"
```

---

### Task 2: Canvas Setup with Offscreen Rendering and Resize

**Files:**
- Create: `src/core/Canvas.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `CanvasManager` class with `canvas: HTMLCanvasElement`, `ctx: CanvasRenderingContext2D`, `offscreen: HTMLCanvasElement`, `offscreenCtx: CanvasRenderingContext2D`, `resize(): void` method

- [ ] **Step 1: Write CanvasManager**

Write `src/core/Canvas.ts`:

```typescript
export class CanvasManager {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly offscreen: HTMLCanvasElement;
  readonly offscreenCtx: CanvasRenderingContext2D;

  static readonly WIDTH = 360;
  static readonly HEIGHT = 640;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = CanvasManager.WIDTH;
    this.offscreen.height = CanvasManager.HEIGHT;
    const offCtx = this.offscreen.getContext('2d');
    if (!offCtx) throw new Error('Failed to get offscreen 2d context');
    this.offscreenCtx = offCtx;
    this.offscreenCtx.imageSmoothingEnabled = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const parent = this.canvas.parentElement ?? document.body;
    const maxW = parent.clientWidth;
    const maxH = parent.clientHeight;
    const scale = Math.min(
      maxW / CanvasManager.WIDTH,
      maxH / CanvasManager.HEIGHT
    );
    this.canvas.width = CanvasManager.WIDTH * scale;
    this.canvas.height = CanvasManager.HEIGHT * scale;
    this.canvas.style.width = `${CanvasManager.WIDTH * scale}px`;
    this.canvas.style.height = `${CanvasManager.HEIGHT * scale}px`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${(maxW - CanvasManager.WIDTH * scale) / 2}px`;
    this.canvas.style.top = `${(maxH - CanvasManager.HEIGHT * scale) / 2}px`;
  }

  flip(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.offscreen,
      0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT,
      0, 0, this.canvas.width, this.canvas.height
    );
  }
}
```

- [ ] **Step 2: Update main.ts**

Replace `src/main.ts`:

```typescript
import { CanvasManager } from './core/Canvas';

const canvasEl = document.getElementById('game') as HTMLCanvasElement;
if (!canvasEl) throw new Error('Canvas element #game not found');

const canvas = new CanvasManager(canvasEl);

// Temporary render test
canvas.offscreenCtx.fillStyle = '#111133';
canvas.offscreenCtx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);
canvas.offscreenCtx.fillStyle = '#fff';
canvas.offscreenCtx.font = '16px monospace';
canvas.offscreenCtx.fillText('弾幕煉獄', 130, 320);
canvas.flip();
```

- [ ] **Step 3: Verify**

```bash
bun run dev
```

Expected: Canvas fills viewport maintaining 9:16 ratio, centered, pixelated text visible. Resize browser window → canvas stays centered and proportional.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: CanvasManager with offscreen rendering and responsive resize"
```

---

### Task 3: Game Loop and Scene State Machine

**Files:**
- Create: `src/core/Game.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `Scene` enum (`Title`, `Playing`, `Paused`, `GameOver`, `StageClear`, `StageIntro`), `Game` class with `scene: Scene`, `start(): void`, `update(dt: number): void`, `render(): void`, `run(): void`
- Consumes: `CanvasManager`

- [ ] **Step 1: Write Game.ts**

Write `src/core/Game.ts`:

```typescript
import { CanvasManager } from './Canvas';

export enum Scene {
  Title,
  StageIntro,
  Playing,
  Paused,
  StageClear,
  GameOver,
}

export class Game {
  readonly canvas: CanvasManager;
  scene: Scene = Scene.Title;
  private lastTime = 0;
  private running = false;

  // Game state shared across systems
  score = 0;
  hiScore = this.loadHiScore();
  lives = 3;
  bombs = 3;
  power = 1;
  stage = 1;
  continueCount = 0;

  constructor(canvas: CanvasManager) {
    this.canvas = canvas;
  }

  private loadHiScore(): number {
    const stored = localStorage.getItem('danma-hi');
    return stored ? parseInt(stored, 10) : 0;
  }

  saveHiScore(): void {
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      localStorage.setItem('danma-hi', String(this.hiScore));
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.running = true;
    this.loop(this.lastTime);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const rawDt = now - this.lastTime;
    this.lastTime = now;
    // Clamp delta to avoid spiral of death
    const dt = Math.min(rawDt, 33.33); // max ~30fps worth of delta

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  };

  update(_dt: number): void {
    // Scene-specific update will be wired in later tasks
  }

  render(): void {
    const ctx = this.canvas.offscreenCtx;
    // Clear with dark background
    ctx.fillStyle = '#111133';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);

    // Scene text placeholder
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Scene: ${Scene[this.scene]}`, 10, 20);

    this.canvas.flip();
  }
}
```

- [ ] **Step 2: Wire Game into main.ts**

Replace `src/main.ts`:

```typescript
import { CanvasManager } from './core/Canvas';
import { Game } from './core/Game';

const canvasEl = document.getElementById('game') as HTMLCanvasElement;
if (!canvasEl) throw new Error('Canvas element #game not found');

const canvas = new CanvasManager(canvasEl);
const game = new Game(canvas);
game.start();
```

- [ ] **Step 3: Verify game loop runs**

```bash
bun run dev
```

Open browser console. Add a temporary `console.log('tick')` inside the loop to confirm 60fps rendering. Remove after confirming. Check that "Scene: Title" appears on screen.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: game loop with scene state machine"
```

---

### Task 4: Input Manager (Keyboard + Touch)

**Files:**
- Create: `src/core/Input.ts`
- Modify: `src/core/Game.ts`

**Interfaces:**
- Produces: `InputState` interface `{ up: boolean, down: boolean, left: boolean, right: boolean, shot: boolean, bomb: boolean, slow: boolean, pause: boolean, touchActive: boolean, touchX: number, touchY: number }`, `Input` class with `state: InputState`, `consumePause(): boolean`, `consumeBomb(): boolean`
- Consumes: `HTMLCanvasElement`

- [ ] **Step 1: Write Input.ts**

Write `src/core/Input.ts`:

```typescript
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shot: boolean;
  bomb: boolean;
  slow: boolean;
  pause: boolean;
  touchActive: boolean;
  touchX: number;
  touchY: number;
  bombButtonPressed: boolean; // touch-only bomb trigger
}

export class Input {
  state: InputState = {
    up: false, down: false, left: false, right: false,
    shot: false, bomb: false, slow: false, pause: false,
    touchActive: false, touchX: 0, touchY: 0,
    bombButtonPressed: false,
  };

  private pauseConsumed = false;
  private bombConsumed = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
  }

  private onKey(e: KeyboardEvent, pressed: boolean): void {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': this.state.up = pressed; break;
      case 'ArrowDown': case 'KeyS': this.state.down = pressed; break;
      case 'ArrowLeft': case 'KeyA': this.state.left = pressed; break;
      case 'ArrowRight': case 'KeyD': this.state.right = pressed; break;
      case 'KeyZ': case 'Space': this.state.shot = pressed; break;
      case 'KeyX': if (pressed) this.state.bomb = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.slow = pressed; break;
      case 'Escape': if (pressed) this.state.pause = true; break;
    }
    e.preventDefault();
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    this.state.touchActive = true;
    this.state.touchX = touch.clientX;
    this.state.touchY = touch.clientY;
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    this.state.touchX = touch.clientX;
    this.state.touchY = touch.clientY;
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 0) {
      this.state.touchActive = false;
    }
  }

  /** Returns true once per pause press, then false until pressed again. */
  consumePause(): boolean {
    if (this.state.pause && !this.pauseConsumed) {
      this.pauseConsumed = true;
      return true;
    }
    if (!this.state.pause) {
      this.pauseConsumed = false;
    }
    return false;
  }

  /** Returns true once per bomb press, then false until pressed again. */
  consumeBomb(): boolean {
    if ((this.state.bomb || this.state.bombButtonPressed) && !this.bombConsumed) {
      this.bombConsumed = true;
      return true;
    }
    if (!this.state.bomb && !this.state.bombButtonPressed) {
      this.bombConsumed = false;
    }
    return false;
  }
}
```

- [ ] **Step 2: Wire Input into Game.ts**

Modify `src/core/Game.ts`:
- Add import: `import { Input } from './Input';`
- Add field: `readonly input: Input;`
- In constructor, add after `this.canvas = canvas`: `this.input = new Input(canvas.canvas);`

- [ ] **Step 3: Verify input in browser**

```bash
bun run dev
```

Add temporary logging in `Game.update()`: `console.log(this.input.state)`. Press arrow keys, Z, X, Shift, Escape — verify state changes in console. Touch on mobile or devtools mobile emulation — verify touchActive, touchX, touchY.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: unified input manager for keyboard and touch"
```

---

### Task 5: Entity Base Class and Bullet Entity

**Files:**
- Create: `src/entities/Entity.ts`
- Create: `src/entities/Bullet.ts`
- Create: `src/entities/types.ts`

**Interfaces:**
- Produces: `Entity` abstract class with `x, y, vx, vy, width, height, active: boolean`, `update(dt: number): void`, `isOffScreen(): boolean`. `Bullet` class extends Entity with `type: BulletType`, `damage: number`, `trail: {x:number,y:number}[]`, `color: string`, `friendly: boolean`. `BulletType` enum.
- Consumes: nothing (leaf dependency)

- [ ] **Step 1: Write types.ts**

Write `src/entities/types.ts`:

```typescript
export enum BulletType {
  Normal = 'normal',
  Odd = 'odd',
  Laser = 'laser',
  Fast = 'fast',
}

export const BULLET_COLORS: Record<BulletType, string> = {
  [BulletType.Normal]: '#ff4444',
  [BulletType.Odd]: '#4488ff',
  [BulletType.Laser]: '#cc44ff',
  [BulletType.Fast]: '#ffcc00',
};

export const BULLET_RADII: Record<BulletType, number> = {
  [BulletType.Normal]: 3,
  [BulletType.Odd]: 4,
  [BulletType.Laser]: 5,
  [BulletType.Fast]: 3,
};
```

- [ ] **Step 2: Write Entity.ts**

Write `src/entities/Entity.ts`:

```typescript
export abstract class Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  active: boolean = true;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.vx = 0;
    this.vy = 0;
  }

  /** Returns center x */
  get cx(): number { return this.x + this.width / 2; }
  /** Returns center y */
  get cy(): number { return this.y + this.height / 2; }

  abstract update(dt: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;

  isOffScreen(padX = 0, padY = 0): boolean {
    return this.x < -padX || this.x > 360 + padX ||
           this.y < -padY || this.y > 640 + padY;
  }
}
```

- [ ] **Step 3: Write Bullet.ts**

Write `src/entities/Bullet.ts`:

```typescript
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
```

- [ ] **Step 4: Verify compilation**

```bash
bun run --build src/entities/Bullet.ts
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Entity base class and Bullet entity with trail rendering"
```

---

### Task 6: Player Entity

**Files:**
- Create: `src/entities/Player.ts`
- Modify: `src/core/Game.ts` (add player ref + input processing in update)

**Interfaces:**
- Produces: `Player` class extends Entity. Properties: `speed: number`, `slowSpeed: number`, `invincible: boolean`, `invincibleTimer: number`, `power: number`, `shootTimer: number`, `bombTimer: number`. Methods: `handleInput(input: InputState): void`, `shoot(): Bullet[]`, `useBomb(): void`, `hit(): boolean`.
- Consumes: `Entity`, `Bullet`, `InputState`

- [ ] **Step 1: Write Player.ts**

Write `src/entities/Player.ts`:

```typescript
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
  invincible = true; // start invincible briefly
  invincibleTimer = 2000;
  shootTimer = 0;
  bombTimer = 0;
  power = 1;
  blinkVisible = true;
  private blinkTimer = 0;

  constructor() {
    super(180 - PLAYER_HALF, 560, PLAYER_SIZE, PLAYER_SIZE);
  }

  handleInput(input: InputState): void {
    this.speed = input.slow ? SLOW_SPEED : NORMAL_SPEED;

    let dx = 0, dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    // Touch input: move toward touch position
    if (input.touchActive) {
      // touchX/Y are in CSS pixels; we need to map to game coords.
      // This mapping is handled by CanvasManager — for now store raw;
      // the conversion happens when we know the canvas scale.
      // We'll use a conversion approach in Task 13 (touch refinement),
      // for now use raw input directly.
      const targetX = input.touchX;
      const targetY = input.touchY;
      const distX = targetX - this.cx;
      const distY = targetY - this.cy;
      const dist = Math.sqrt(distX * distX + distY * distY);
      if (dist > 2) {
        dx = distX / dist;
        dy = distY / dist;
        this.speed = NORMAL_SPEED;
      }
    }

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    this.x += dx * this.speed;
    this.y += dy * this.speed;

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

    // Player sprite: triangle ship (pixel-art style)
    const cx = this.cx;
    const top = this.y;
    const bottom = this.y + this.height;

    ctx.fillStyle = '#00ccff';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + PLAYER_HALF, bottom);
    ctx.lineTo(cx - PLAYER_HALF, bottom);
    ctx.closePath();
    ctx.fill();

    // Engine glow
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(cx - 3, bottom - 2, 6, 4);

    // Hitbox indicator (only visible when slow-moving)
    if (this.speed === SLOW_SPEED) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(cx - 1, this.cy - 1, 2, 2);
    }
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
bun run --build src/entities/Player.ts
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: Player entity with movement, shooting, bombing, invincibility"
```

---

### Task 7: Renderer with Layer System

**Files:**
- Create: `src/render/Renderer.ts`
- Create: `src/render/sprites.ts`

**Interfaces:**
- Produces: `Renderer` class with `clear(): void`, `renderLayer(layer: Layer, fn: () => void): void`, `addScreenShake(intensity: number): void`, `flip(): void`. `Layer` enum. `drawPixelChar(ctx, char, x, y, color, scale?): void` in sprites.ts.
- Consumes: `CanvasManager`

- [ ] **Step 1: Write sprites.ts**

Write `src/render/sprites.ts`:

```typescript
/** 5x7 pixel font — minimal character set for HUD and UI */
const FONT: Record<string, number[]> = {
  '0': [0xE,0x11,0x11,0x11,0xE],
  '1': [0x4,0xC,0x4,0x4,0xE],
  '2': [0xE,0x11,0x2,0x4,0x1F],
  '3': [0xE,0x11,0x6,0x11,0xE],
  '4': [0x11,0x11,0x1F,0x1,0x1],
  '5': [0x1F,0x10,0x1E,0x1,0x1E],
  '6': [0xE,0x10,0x1E,0x11,0xE],
  '7': [0x1F,0x1,0x2,0x4,0x8],
  '8': [0xE,0x11,0xE,0x11,0xE],
  '9': [0xE,0x11,0xF,0x1,0xE],
  'A': [0xE,0x11,0x1F,0x11,0x11],
  'B': [0x1E,0x11,0x1E,0x11,0x1E],
  'C': [0xE,0x11,0x10,0x11,0xE],
  'D': [0x1E,0x11,0x11,0x11,0x1E],
  'E': [0x1F,0x10,0x1E,0x10,0x1F],
  'F': [0x1F,0x10,0x1E,0x10,0x10],
  'G': [0xE,0x10,0x17,0x11,0xE],
  'H': [0x11,0x11,0x1F,0x11,0x11],
  'I': [0xE,0x4,0x4,0x4,0xE],
  'K': [0x11,0x12,0x1C,0x12,0x11],
  'L': [0x10,0x10,0x10,0x10,0x1F],
  'M': [0x11,0x1B,0x15,0x11,0x11],
  'N': [0x11,0x19,0x15,0x13,0x11],
  'O': [0xE,0x11,0x11,0x11,0xE],
  'P': [0x1E,0x11,0x1E,0x10,0x10],
  'R': [0x1E,0x11,0x1E,0x12,0x11],
  'S': [0xF,0x10,0xE,0x1,0x1E],
  'T': [0x1F,0x4,0x4,0x4,0x4],
  'U': [0x11,0x11,0x11,0x11,0xE],
  'V': [0x11,0x11,0x11,0xA,0x4],
  'W': [0x11,0x11,0x15,0x1B,0x11],
  'X': [0x11,0xA,0x4,0xA,0x11],
  'Y': [0x11,0xA,0x4,0x4,0x4],
  ' ': [0x0,0x0,0x0,0x0,0x0],
  ':': [0x0,0x4,0x0,0x4,0x0],
  '!': [0x4,0x4,0x4,0x0,0x4],
  '.': [0x0,0x0,0x0,0x0,0x4],
  '-': [0x0,0x0,0xE,0x0,0x0],
  '★': [0x4,0xE,0x1F,0xE,0x4],
  '♥': [0xA,0x1F,0x1F,0xE,0x4],
  '■': [0x1F,0x1F,0x1F,0x1F,0x1F],
  '▶': [0x8,0xC,0xE,0xC,0x8],
  '©': [0xE,0x11,0x15,0x11,0xE],
  '⭐': [0x4,0xE,0x1F,0xE,0x4],
};

const CHAR_W = 5;
const CHAR_H = 7;

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#ffffff',
  scale = 1
): number {
  let ox = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch];
    if (glyph) {
      for (let row = 0; row < CHAR_H; row++) {
        for (let col = 0; col < CHAR_W; col++) {
          if (glyph[row] & (1 << (CHAR_W - 1 - col))) {
            ctx.fillStyle = color;
            ctx.fillRect(
              ox + col * scale,
              y + row * scale,
              scale,
              scale
            );
          }
        }
      }
      ox += (CHAR_W + 1) * scale;
    } else {
      ox += (CHAR_W + 1) * scale;
    }
  }
  return ox - x;
}

export function drawPixelChar(
  ctx: CanvasRenderingContext2D,
  char: string,
  x: number,
  y: number,
  color = '#ffffff',
  scale = 1
): void {
  drawPixelText(ctx, char, x, y, color, scale);
}
```

- [ ] **Step 2: Write Renderer.ts**

Write `src/render/Renderer.ts`:

```typescript
import { CanvasManager } from '../core/Canvas';

export enum Layer {
  Background,
  Bullets,
  Enemies,
  Player,
  Effects,
  HUD,
}

export class Renderer {
  private canvas: CanvasManager;
  private shakeIntensity = 0;
  private shakeX = 0;
  private shakeY = 0;

  constructor(canvas: CanvasManager) {
    this.canvas = canvas;
  }

  addScreenShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  clear(): void {
    const ctx = this.canvas.offscreenCtx;
    this.shakeX = 0;
    this.shakeY = 0;
    if (this.shakeIntensity > 0) {
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity *= 0.85; // decay
      if (this.shakeIntensity < 0.3) this.shakeIntensity = 0;
    }

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // Black background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(-4, -4, CanvasManager.WIDTH + 8, CanvasManager.HEIGHT + 8);
  }

  finishAndFlip(): void {
    const ctx = this.canvas.offscreenCtx;
    ctx.restore();
    this.canvas.flip();
  }

  get ctx(): CanvasRenderingContext2D {
    return this.canvas.offscreenCtx;
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
bun run --build src/render/Renderer.ts
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Renderer with layer enum, screen shake, and pixel font system"
```

---

### Task 8: Bullet Pattern System (Base + 5 Patterns)

**Files:**
- Create: `src/patterns/Pattern.ts`
- Create: `src/patterns/AimedShot.ts`
- Create: `src/patterns/CircleShot.ts`
- Create: `src/patterns/SpiralShot.ts`
- Create: `src/patterns/LaserShot.ts`
- Create: `src/patterns/WaveShot.ts`

**Interfaces:**
- Produces: `BulletPattern` abstract class with `update(dt: number): Bullet[]`, `isFinished: boolean`, `reset(): void`. Five concrete pattern classes. Each pattern emits `Bullet[]` every update tick.
- Consumes: `Bullet`, `BulletType`

- [ ] **Step 1: Write Pattern.ts base class**

Write `src/patterns/Pattern.ts`:

```typescript
import { Bullet } from '../entities/Bullet';

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
```

- [ ] **Step 2: Write AimedShot.ts**

Write `src/patterns/AimedShot.ts`:

```typescript
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
```

- [ ] **Step 3: Write CircleShot.ts**

Write `src/patterns/CircleShot.ts`:

```typescript
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
```

- [ ] **Step 4: Write SpiralShot.ts**

Write `src/patterns/SpiralShot.ts`:

```typescript
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
```

- [ ] **Step 5: Write LaserShot.ts**

Write `src/patterns/LaserShot.ts`:

```typescript
import { BulletPattern } from './Pattern';
import { Bullet } from '../entities/Bullet';
import { BulletType } from '../entities/types';

export class LaserShot extends BulletPattern {
  private duration: number;
  private warmup: number;
  private fired = false;

  constructor(warmup = 1500, duration = 2000) {
    super();
    this.warmup = warmup;
    this.duration = duration;
  }

  update(dt: number, playerX = 180, _py = 300): Bullet[] {
    this.timer += dt;
    if (this.timer < this.warmup) {
      return []; // charging — render warning line (handled elsewhere)
    }
    if (!this.fired) {
      this.fired = true;
      this.timer = 0;
    }
    if (this.timer > this.duration) {
      this.isFinished = true;
      return [];
    }

    // Fire laser as a stream of fast bullets aimed at player
    const bullets: Bullet[] = [];
    const sx = 180;
    const sy = 60;
    const dx = playerX - sx;
    const dy = 560 - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Fire a few bullets per frame to create a solid beam effect
    for (let i = 0; i < 3; i++) {
      bullets.push(new Bullet(
        sx + (Math.random() - 0.5) * 12,
        sy,
        (dx / dist) * 7,
        (dy / dist) * 7,
        BulletType.Laser
      ));
    }
    return bullets;
  }

  /** Returns true during warmup phase */
  get isCharging(): boolean {
    return this.timer < this.warmup;
  }
}
```

- [ ] **Step 6: Write WaveShot.ts**

Write `src/patterns/WaveShot.ts`:

```typescript
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
```

- [ ] **Step 7: Verify compilation**

```bash
bun run --build src/patterns/AimedShot.ts
```

Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: bullet pattern system with 5 pattern types"
```

---

### Task 9: Enemy Entity

**Files:**
- Create: `src/entities/Enemy.ts`

**Interfaces:**
- Produces: `Enemy` class extends Entity. `hp: number`, `maxHp: number`, `scoreValue: number`, `isBoss: boolean`, `isMidBoss: boolean`, `phase: number`, `flashTimer: number`, `dropPowerItem: boolean`. `takeDamage(dmg: number): boolean` returns true if dead. Patterns array of `BulletPattern`.

- [ ] **Step 1: Write Enemy.ts**

Write `src/entities/Enemy.ts`:

```typescript
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
```

- [ ] **Step 2: Verify compilation**

```bash
bun run --build src/entities/Enemy.ts
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: Enemy entity with HP, phases, movement paths, and patterns"
```

---

### Task 10: Collision System

**Files:**
- Create: `src/systems/Collision.ts`

**Interfaces:**
- Produces: `checkCollision(a: Entity, b: Entity): boolean` — pixel-level for player (1px point vs circle), circle-vs-circle for bullets. `checkPlayerHit(player: Player, bullets: Bullet[]): boolean`. `checkEnemyHit(enemies: Enemy[], playerBullets: Bullet[]): Enemy[]`.

- [ ] **Step 1: Write Collision.ts**

Write `src/systems/Collision.ts`:

```typescript
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';

/**
 * Player hitbox: 1px point at center.
 * Bullet hitbox: circle with bullet.radius.
 */
export function isPlayerHitByBullet(player: Player, bullet: Bullet): boolean {
  if (!bullet.active || !bullet.friendly) return false; // friendly bullets don't hit player
  if (player.invincible) return false;

  const dx = player.cx - bullet.cx;
  const dy = player.cy - bullet.cy;
  const dist = dx * dx + dy * dy; // squared distance
  const hitRadius = bullet.radius;
  return dist <= hitRadius * hitRadius;
}

/**
 * Enemy hitbox: rectangle overlap with bullet circle.
 * Simplified: check bullet center vs enemy rect.
 */
export function isEnemyHitByBullet(enemy: Enemy, bullet: Bullet): boolean {
  if (!bullet.active || !bullet.friendly) return false;
  if (!enemy.active) return false;

  // Circle vs rect: find closest point on rect to circle center
  const cx = Math.max(enemy.x, Math.min(bullet.cx, enemy.x + enemy.width));
  const cy = Math.max(enemy.y, Math.min(bullet.cy, enemy.y + enemy.height));
  const dx = bullet.cx - cx;
  const dy = bullet.cy - cy;
  const dist = dx * dx + dy * dy;
  return dist <= bullet.radius * bullet.radius;
}

/**
 * Check all enemy bullets against player. Returns true if player was hit.
 */
export function checkPlayerCollisions(
  player: Player,
  enemyBullets: Bullet[]
): boolean {
  for (const bullet of enemyBullets) {
    if (isPlayerHitByBullet(player, bullet)) {
      bullet.active = false;
      return true;
    }
  }
  return false;
}

/**
 * Check all player bullets against all enemies. Returns enemies that were destroyed.
 * Sets bullet.active = false on hit.
 */
export function checkEnemyCollisions(
  enemies: Enemy[],
  playerBullets: Bullet[]
): Enemy[] {
  const destroyed: Enemy[] = [];
  for (const bullet of playerBullets) {
    if (!bullet.active) continue;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (isEnemyHitByBullet(enemy, bullet)) {
        bullet.active = false;
        const dead = enemy.takeDamage(bullet.damage);
        if (dead) {
          destroyed.push(enemy);
        }
        break; // bullet hits only one enemy
      }
    }
  }
  return destroyed;
}

/**
 * Check if bullet grazed the player (passed within grazeRadius of player hitbox).
 */
export function checkGraze(player: Player, bullet: Bullet, grazeRadius = 15): boolean {
  if (!bullet.active || bullet.friendly) return false;
  const dx = player.cx - bullet.cx;
  const dy = player.cy - bullet.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist <= grazeRadius;
}
```

- [ ] **Step 2: Verify compilation**

```bash
bun run --build src/systems/Collision.ts
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: collision detection system (player bullet, enemy bullet, graze)"
```

---

### Task 11: HUD

**Files:**
- Create: `src/ui/HUD.ts`

**Interfaces:**
- Produces: `HUD` class with `render(ctx, game): void`. Displays score, hi-score, lives (♥), bombs (★), power (■).
- Consumes: `Render` (Layer.HUD), `drawPixelText`, `Game`

- [ ] **Step 1: Write HUD.ts**

Write `src/ui/HUD.ts`:

```typescript
import { Game } from '../core/Game';
import { drawPixelText } from '../render/sprites';
import { CanvasManager } from '../core/Canvas';

const HUD_HEIGHT = 28;

export class HUD {
  private grazeFlash = 0;

  triggerGrazeFlash(): void {
    this.grazeFlash = 300; // ms
  }

  update(dt: number): void {
    if (this.grazeFlash > 0) this.grazeFlash -= dt;
  }

  render(ctx: CanvasRenderingContext2D, game: Game): void {
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, HUD_HEIGHT);

    const y = 4;
    const scale = 1;

    // Score (flashes gold on graze)
    const scoreColor = this.grazeFlash > 0 ? '#ffcc00' : '#ffffff';
    drawPixelText(ctx, `SCORE:${String(game.score).padStart(8, '0')}`, 4, y, scoreColor, scale);

    // Hi-score
    drawPixelText(ctx, `HI:${String(game.hiScore).padStart(8, '0')}`, 110, y, '#aaaaaa', scale);

    // Lives
    let ox = 210;
    for (let i = 0; i < game.lives; i++) {
      drawPixelText(ctx, '♥', ox, y, '#ff6688', scale);
      ox += 8;
    }

    // Bombs
    ox += 6;
    for (let i = 0; i < game.bombs; i++) {
      drawPixelText(ctx, '★', ox, y, '#ffcc00', scale);
      ox += 8;
    }

    // Power
    ox += 6;
    drawPixelText(ctx, 'P:', ox, y, '#00ccff', scale);
    ox += 14;
    for (let i = 0; i < game.power; i++) {
      drawPixelText(ctx, '■', ox, y, '#00ccff', scale);
      ox += 7;
    }
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
bun run --build src/ui/HUD.ts
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: HUD with score, hi-score, lives, bombs, and power display"
```

---

### Task 12: Stage Base Class and Stage 1

**Files:**
- Create: `src/stages/Stage.ts`
- Create: `src/stages/Stage1.ts`

**Interfaces:**
- Produces: `Stage` abstract class with `enemies: Enemy[]`, `enemyBullets: Bullet[]`, `playerBullets: Bullet[]`, `update(dt, player): void`, `isComplete: boolean`, `isBossActive: boolean`, `stageNumber: number`, `stageName: string`. `Stage1` concrete class.
- Consumes: `Enemy`, `Bullet`, `Player`, `BulletPattern` subclasses

- [ ] **Step 1: Write Stage.ts**

Write `src/stages/Stage.ts`:

```typescript
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Player } from '../entities/Player';

export abstract class Stage {
  abstract readonly stageNumber: number;
  abstract readonly stageName: string;
  abstract readonly themeColor: string;

  enemies: Enemy[] = [];
  enemyBullets: Bullet[] = [];
  playerBullets: Bullet[] = [];
  isComplete = false;
  isBossActive = false;
  protected timer = 0;

  abstract update(dt: number, player: Player): void;

  /** Spawn a wave of mooks. Returns created enemies. */
  protected spawnWave(enemies: Enemy[]): void {
    this.enemies.push(...enemies);
  }

  /** Clean up inactive entities */
  protected cleanup(): void {
    this.enemies = this.enemies.filter(e => e.active);
    this.enemyBullets = this.enemyBullets.filter(b => b.active);
    this.playerBullets = this.playerBullets.filter(b => b.active);
  }
}
```

- [ ] **Step 2: Write Stage1.ts**

Write `src/stages/Stage1.ts`:

```typescript
import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';

export class Stage1 extends Stage {
  readonly stageNumber = 1;
  readonly stageName = 'FIRST CONTACT';
  readonly themeColor = '#111144';
  private firstWaveSpawned = false;
  private secondWaveSpawned = false;
  private bossSpawned = false;
  private boss: Enemy | null = null;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1: Simple mooks at 1 second
    if (this.timer >= 1000 && !this.firstWaveSpawned) {
      this.firstWaveSpawned = true;
      for (let i = 0; i < 3; i++) {
        const enemy = new Enemy(60 + i * 100, -20, 20, 20, 2, 100);
        enemy.setMovePath([
          { x: 60 + i * 100, y: -20 },
          { x: 60 + i * 100, y: 80 },
          { x: 60 + i * 100, y: -20 },
        ]);
        enemy.patterns = [new AimedShot(2000, 2, 1)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2: More mooks at 5 seconds
    if (this.timer >= 5000 && !this.secondWaveSpawned) {
      this.secondWaveSpawned = true;
      for (let i = 0; i < 5; i++) {
        const enemy = new Enemy(40 + i * 70, -30, 18, 18, 3, 200);
        enemy.setMovePath([
          { x: 40 + i * 70, y: -30 },
          { x: 40 + i * 70, y: 100 },
          { x: 40 + i * 70, y: -30 },
        ]);
        if (i % 2 === 0) {
          enemy.patterns = [new AimedShot(1500, 2.5, 1)];
        }
        this.enemies.push(enemy);
      }
    }

    // Mid-boss at 10 seconds
    if (this.timer >= 10000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(140, -40, 80, 40, 80, 10000, false, true);
      this.boss.setMovePath([
        { x: 140, y: -40 },
        { x: 140, y: 60 },
      ]);
      this.boss.patterns = [
        new AimedShot(600, 3, Infinity),
        new CircleShot(3000, 2, 24),
      ];
      this.enemies.push(this.boss);
    }

    // Stage complete when mid-boss is dead
    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    // Update enemies and collect their bullets
    for (const enemy of this.enemies) {
      enemy.update(dt);
      this.enemyBullets.push(...enemy.getBullets(dt, player.cx, player.cy));
    }

    // Update bullets
    for (const bullet of this.enemyBullets) bullet.update(dt);
    for (const bullet of this.playerBullets) bullet.update(dt);

    this.cleanup();
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
bun run --build src/stages/Stage1.ts
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Stage base class and Stage 1 (tutorial stage)"
```

---

### Task 13: Wire Everything Together — Game Update/Render + Title Screen

**Files:**
- Modify: `src/core/Game.ts` — full update/render logic
- Create: `src/ui/TitleScreen.ts`
- Modify: `src/main.ts` — if needed

**Interfaces:**
- Consumes: All prior entities, patterns, stages, systems

Due to the complexity, this is a single integration task. Let's write the complete Game.ts with all wiring.

- [ ] **Step 1: Write TitleScreen.ts**

Write `src/ui/TitleScreen.ts`:

```typescript
import { CanvasManager } from '../core/Canvas';
import { drawPixelText } from '../render/sprites';

export class TitleScreen {
  private starField: { x: number; y: number; speed: number; brightness: number }[] = [];
  private blinkTimer = 0;
  private showPressStart = true;

  constructor() {
    for (let i = 0; i < 40; i++) {
      this.starField.push({
        x: Math.random() * CanvasManager.WIDTH,
        y: Math.random() * CanvasManager.HEIGHT,
        speed: 0.3 + Math.random() * 1.2,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
  }

  update(dt: number): void {
    for (const star of this.starField) {
      star.y += star.speed;
      if (star.y > CanvasManager.HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CanvasManager.WIDTH;
      }
    }
    this.blinkTimer += dt;
    if (this.blinkTimer >= 500) {
      this.blinkTimer -= 500;
      this.showPressStart = !this.showPressStart;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);

    // Stars
    for (const star of this.starField) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), 1, 1);
    }

    // Title
    drawPixelText(ctx, 'DANMA', 130, 180, '#ff4444', 2);
    drawPixelText(ctx, 'RENGO', 124, 210, '#ff4444', 2);

    drawPixelText(ctx, '弾 幕 煉 獄', 112, 250, '#ff8844', 1);

    // Press start
    if (this.showPressStart) {
      drawPixelText(ctx, 'PRESS Z TO START', 100, 400, '#ffffff', 1);
    }

    // Credits
    drawPixelText(ctx, '(C) 2026', 140, 600, '#666666', 1);
    drawPixelText(ctx, 'ARROWS:MOVE Z:SHOT X:BOMB', 55, 560, '#888888', 1);
    drawPixelText(ctx, 'SHIFT:SLOW ESC:PAUSE', 70, 576, '#888888', 1);
  }
}
```

- [ ] **Step 2: Write the full Game.ts update/render**

Replace `src/core/Game.ts`:

```typescript
import { CanvasManager } from './Canvas';
import { Input } from './Input';
import { Renderer, Layer } from '../render/Renderer';
import { Player } from '../entities/Player';
import { HUD } from '../ui/HUD';
import { TitleScreen } from '../ui/TitleScreen';
import { Stage } from '../stages/Stage';
import { Stage1 } from '../stages/Stage1';
import { checkPlayerCollisions, checkEnemyCollisions, checkGraze } from '../systems/Collision';

export enum Scene {
  Title,
  StageIntro,
  Playing,
  Paused,
  StageClear,
  GameOver,
}

export class Game {
  readonly canvas: CanvasManager;
  readonly input: Input;
  readonly renderer: Renderer;
  readonly hud: HUD;
  readonly titleScreen: TitleScreen;
  scene: Scene = Scene.Title;
  private running = false;
  private lastTime = 0;

  // Game state
  score = 0;
  hiScore = this.loadHiScore();
  lives = 3;
  bombs = 3;
  power = 1;
  currentStage = 1;
  continueCount = 0;

  // Entities
  player!: Player;
  currentStageInstance!: Stage;

  // Stage intro / clear timers
  private transitionTimer = 0;
  private stageClearTimer = 0;
  private stageClearBonusShown = false;

  constructor(canvas: CanvasManager) {
    this.canvas = canvas;
    this.input = new Input(canvas.canvas);
    this.renderer = new Renderer(canvas);
    this.hud = new HUD();
    this.titleScreen = new TitleScreen();
    this.initPlayer();
  }

  private initPlayer(): void {
    this.player = new Player();
  }

  private loadHiScore(): number {
    const stored = localStorage.getItem('danma-hi');
    return stored ? parseInt(stored, 10) : 0;
  }

  saveHiScore(): void {
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      localStorage.setItem('danma-hi', String(this.hiScore));
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.running = true;
    this.loop(this.lastTime);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const rawDt = now - this.lastTime;
    this.lastTime = now;
    const dt = Math.min(rawDt, 33.33);
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  private startStage(stageNum: number): void {
    this.currentStage = stageNum;
    switch (stageNum) {
      case 1: this.currentStageInstance = new Stage1(); break;
      // Future stages will be added here
      default: this.currentStageInstance = new Stage1(); break;
    }
    this.player = new Player();
    this.scene = Scene.StageIntro;
    this.transitionTimer = 2000;
  }

  update(dt: number): void {
    // Handle pause toggle (works in Playing and Paused)
    const pausePressed = this.input.consumePause();
    if (pausePressed) {
      if (this.scene === Scene.Playing) {
        this.scene = Scene.Paused;
        return;
      } else if (this.scene === Scene.Paused) {
        this.scene = Scene.Playing;
        return;
      }
    }

    switch (this.scene) {
      case Scene.Title:
        this.titleScreen.update(dt);
        if (this.input.state.shot) {
          this.score = 0;
          this.lives = 3;
          this.bombs = 3;
          this.power = 1;
          this.continueCount = 0;
          this.startStage(1);
        }
        break;

      case Scene.StageIntro:
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
          this.scene = Scene.Playing;
        }
        break;

      case Scene.Playing:
        this.updatePlaying(dt);
        break;

      case Scene.StageClear:
        this.stageClearTimer -= dt;
        if (this.stageClearTimer <= 0) {
          // Go to next stage
          if (this.currentStage < 5) {
            this.startStage(this.currentStage + 1);
          } else {
            // All stages clear! Show ending and go to title
            this.saveHiScore();
            this.scene = Scene.Title;
          }
        }
        break;

      case Scene.Paused:
        // Nothing updates during pause except checking for unpause (handled above)
        break;

      case Scene.GameOver:
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
          // Wait for input
          if (this.input.state.shot) {
            // Continue
            this.lives = 3;
            this.bombs = 3;
            this.power = 1;
            this.continueCount++;
            this.startStage(this.currentStage);
          }
          if (this.input.consumeBomb()) {
            // Back to title (using bomb button = back)
            this.saveHiScore();
            this.scene = Scene.Title;
          }
        }
        break;
    }
  }

  private updatePlaying(dt: number): void {
    // Player input
    this.player.handleInput(this.input.state);

    // Player shooting (auto-shoot when touch is active or Z held)
    if (this.input.state.shot || this.input.state.touchActive) {
      const newBullets = this.player.shoot(dt);
      this.currentStageInstance.playerBullets.push(...newBullets);
    } else {
      // Reset shoot timer when not shooting so next press fires immediately
      this.player.shootTimer = 0;
    }

    // Bomb
    if (this.input.consumeBomb() && this.bombs > 0) {
      this.bombs--;
      this.player.useBomb();
      // Clear all enemy bullets
      for (const b of this.currentStageInstance.enemyBullets) {
        b.active = false;
      }
      this.renderer.addScreenShake(6);
    }

    // Update player
    this.player.update(dt);

    // Update stage
    this.currentStageInstance.update(dt, this.player);

    // Collision: player vs enemy bullets
    if (checkPlayerCollisions(this.player, this.currentStageInstance.enemyBullets)) {
      if (this.player.hit()) {
        this.lives--;
        this.renderer.addScreenShake(8);
        if (this.lives < 0) {
          this.lives = 0;
          this.saveHiScore();
          this.scene = Scene.GameOver;
          this.transitionTimer = 1500;
          return;
        }
      }
    }

    // Graze detection
    for (const bullet of this.currentStageInstance.enemyBullets) {
      if (bullet.active && checkGraze(this.player, bullet)) {
        this.score += 100;
        this.hud.triggerGrazeFlash();
      }
    }

    // Collision: player bullets vs enemies
    const destroyed = checkEnemyCollisions(
      this.currentStageInstance.enemies,
      this.currentStageInstance.playerBullets
    );
    for (const enemy of destroyed) {
      this.score += enemy.scoreValue;
      if (enemy.dropPowerItem && this.power < 5) {
        this.power++;
      }
      this.renderer.addScreenShake(enemy.isBoss ? 4 : 1);
    }

    // Stage complete check
    if (this.currentStageInstance.isComplete) {
      this.score += this.bombs * 5000;
      this.score += this.lives * 10000;
      this.saveHiScore();
      this.scene = Scene.StageClear;
      this.stageClearTimer = 3000;
      this.stageClearBonusShown = false;
    }

    // Sync game state
    this.power = this.player.power;

    // HUD
    this.hud.update(dt);
  }

  render(): void {
    this.renderer.clear();
    const ctx = this.renderer.ctx;

    switch (this.scene) {
      case Scene.Title:
        this.titleScreen.render(ctx);
        break;

      case Scene.StageIntro:
        this.renderStageIntro(ctx);
        break;

      case Scene.Playing:
      case Scene.Paused:
        this.renderPlaying(ctx);
        if (this.scene === Scene.Paused) {
          this.renderPauseOverlay(ctx);
        }
        break;

      case Scene.StageClear:
        this.renderPlaying(ctx); // Still show game state behind
        this.renderStageClearOverlay(ctx);
        break;

      case Scene.GameOver:
        this.renderGameOver(ctx);
        break;
    }

    this.renderer.finishAndFlip();
  }

  private renderStageIntro(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);
    const { drawPixelText } = require('../render/sprites');
    const stage = this.currentStageInstance;
    drawPixelText(ctx, `STAGE ${stage.stageNumber}`, 120, 280, '#ffffff', 1);
    drawPixelText(ctx, `-- ${stage.stageName} --`, 100, 310, '#ff8844', 1);
    drawPixelText(ctx, 'READY...', 135, 360, '#ffffff', 1);
  }

  private renderPlaying(ctx: CanvasRenderingContext2D): void {
    const stage = this.currentStageInstance;

    // Background (simple gradient placeholder — will be enhanced later)
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);

    // Enemies
    for (const enemy of stage.enemies) {
      enemy.render(ctx);
    }

    // Enemy bullets
    for (const bullet of stage.enemyBullets) {
      bullet.render(ctx);
    }

    // Player bullets
    for (const bullet of stage.playerBullets) {
      bullet.render(ctx);
    }

    // Player
    this.player.render(ctx);

    // HUD
    this.hud.render(ctx, this);
  }

  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);
    const { drawPixelText } = require('../render/sprites');
    drawPixelText(ctx, 'PAUSED', 140, 310, '#ffffff', 1);
    drawPixelText(ctx, 'ESC TO RESUME', 105, 340, '#aaaaaa', 1);
  }

  private renderStageClearOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);
    const { drawPixelText } = require('../render/sprites');
    drawPixelText(ctx, 'STAGE CLEAR!', 110, 280, '#ffcc00', 1);
    drawPixelText(ctx, `BONUS: ${this.bombs * 5000 + this.lives * 10000}`, 90, 320, '#ffffff', 1);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);
    const { drawPixelText } = require('../render/sprites');
    drawPixelText(ctx, 'GAME OVER', 122, 240, '#ff2222', 1);
    drawPixelText(ctx, `SCORE: ${String(this.score).padStart(8, '0')}`, 100, 290, '#ffffff', 1);
    drawPixelText(ctx, `HI: ${String(this.hiScore).padStart(8, '0')}`, 130, 310, '#aaaaaa', 1);
    if (this.score >= this.hiScore && this.score > 0) {
      drawPixelText(ctx, 'NEW RECORD!', 118, 340, '#ffcc00', 1);
    }
    drawPixelText(ctx, 'Z - CONTINUE', 110, 400, '#ffffff', 1);
    drawPixelText(ctx, 'X - TITLE', 120, 425, '#ffffff', 1);
  }
}
```

- [ ] **Step 3: Fix "require" in Game.ts**

The `require` calls in Game.ts won't work with ES modules. Fix by importing at the top of Game.ts — add:
```typescript
import { drawPixelText } from '../render/sprites';
```

Then replace all `const { drawPixelText } = require('../render/sprites');` with just using the already-imported `drawPixelText`. Also need to update TitleScreen render to be consistent.

Actually, the cleanest approach: import `drawPixelText` at the top and use it directly. Let me fix the Game.ts to not use require. The import is already available at module scope via a top-level import. I'll adjust the render methods to just call `drawPixelText` directly.

The correct approach: add `import { drawPixelText } from '../render/sprites';` at the top of Game.ts and remove all `require` lines from render methods.

- [ ] **Step 4: Verify the full app compiles and runs**

```bash
bun run dev
```

Test:
1. Title screen appears with stars, title, "PRESS Z TO START"
2. Press Z → "STAGE 1 - FIRST CONTACT" → "READY..."
3. Game starts, player visible at bottom, can move with arrows
4. Z shoots bullets upward
5. Enemies spawn and shoot at player
6. X uses bomb (screen shake + bullets cleared)
7. Kill mid-boss → "STAGE CLEAR" with bonus
8. Game goes back to title

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: full game loop integration — title, gameplay, stage clear, game over"
```

---

### Task 14: Stages 2–5

**Files:**
- Create: `src/stages/Stage2.ts`
- Create: `src/stages/Stage3.ts`
- Create: `src/stages/Stage4.ts`
- Create: `src/stages/Stage5.ts`
- Modify: `src/core/Game.ts` — wire stage selection

**Note:** Due to plan length, detailed enemy layouts for stages 2-5 are summarized. Each stage follows the Stage1 pattern with increasing difficulty. Full details in individual commits.

- [ ] **Step 1: Write Stage2.ts**

Write `src/stages/Stage2.ts`:

```typescript
import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { WaveShot } from '../patterns/WaveShot';

export class Stage2 extends Stage {
  readonly stageNumber = 2;
  readonly stageName = 'STARLIT PATH';
  readonly themeColor = '#111155';

  private boss: Enemy | null = null;
  private bossSpawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1 (1s): 4 mooks from sides
    if (this.timer >= 1000 && this.enemies.length === 0) {
      for (let i = 0; i < 4; i++) {
        const ex = i < 2 ? -20 : 380;
        const enemy = new Enemy(ex, 60 + i * 60, 20, 20, 4, 200);
        enemy.setMovePath([{ x: ex, y: 60 + i * 60 }, { x: 180, y: 120 }, { x: ex, y: 60 + i * 60 }]);
        enemy.patterns = [new AimedShot(1800, 2.5, 1)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2 (4s): Wave-shot mooks
    if (this.timer >= 4000 && this.timer < 4500 && this.enemies.filter(e => !e.isBoss && !e.isMidBoss).length < 2) {
      for (let i = 0; i < 3; i++) {
        const enemy = new Enemy(100 + i * 80, -20, 20, 20, 5, 300);
        enemy.setMovePath([{ x: 100 + i * 80, y: -20 }, { x: 100 + i * 80, y: 90 }]);
        enemy.patterns = [new WaveShot(120, 2, 4000)];
        this.enemies.push(enemy);
      }
    }

    // Wave 3 (8s): More aimed shots
    if (this.timer >= 8000 && this.timer < 8500 && this.enemies.filter(e => !e.isBoss && !e.isMidBoss).length < 2) {
      for (let i = 0; i < 5; i++) {
        const enemy = new Enemy(30 + i * 70, -20, 20, 20, 5, 300);
        enemy.setMovePath([{ x: 30 + i * 70, y: -20 }, { x: 30 + i * 70, y: 110 }]);
        enemy.patterns = [new AimedShot(1200, 3, 2)];
        this.enemies.push(enemy);
      }
    }

    // Mid-boss (12s)
    if (this.timer >= 12000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(130, -50, 100, 50, 150, 15000, false, true);
      this.boss.setMovePath([{ x: 130, y: -50 }, { x: 130, y: 50 }]);
      this.boss.patterns = [
        new AimedShot(500, 3.5, Infinity),
        new CircleShot(2500, 2.5, 30),
        new WaveShot(100, 2.5, 4000),
      ];
      this.enemies.push(this.boss);
    }

    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    for (const enemy of this.enemies) {
      enemy.update(dt);
      this.enemyBullets.push(...enemy.getBullets(dt, player.cx, player.cy));
    }
    for (const bullet of this.enemyBullets) bullet.update(dt);
    for (const bullet of this.playerBullets) bullet.update(dt);

    this.cleanup();
  }
}
```

- [ ] **Step 2: Write Stage3.ts**

Write `src/stages/Stage3.ts` — increased density, introduces SpiralShot alongside other patterns:

```typescript
import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { WaveShot } from '../patterns/WaveShot';
import { SpiralShot } from '../patterns/SpiralShot';

export class Stage3 extends Stage {
  readonly stageNumber = 3;
  readonly stageName = 'CRIMSON SKY';
  readonly themeColor = '#221111';
  private boss: Enemy | null = null;
  private bossSpawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1 (1s): Mooks with aimed shots
    if (this.timer >= 1000 && this.enemies.length === 0) {
      for (let i = 0; i < 6; i++) {
        const enemy = new Enemy(30 + i * 55, -30, 18, 18, 6, 400);
        enemy.setMovePath([{ x: 30 + i * 55, y: -30 }, { x: 30 + i * 55, y: 100 }]);
        enemy.patterns = [new AimedShot(1400, 3, 2)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2 (4s): Wave + Spiral combination hints
    if (this.timer >= 4000 && this.timer < 4500) {
      const e1 = new Enemy(140, -20, 24, 24, 20, 800);
      e1.setMovePath([{ x: 140, y: -20 }, { x: 140, y: 80 }]);
      e1.patterns = [new SpiralShot(80, 2.5, 4000), new WaveShot(150, 2, 4000)];
      this.enemies.push(e1);
    }

    // Wave 3 (8s): Dense wave
    if (this.timer >= 8000 && this.timer < 8500) {
      for (let i = 0; i < 4; i++) {
        const enemy = new Enemy(50 + i * 80, -20, 20, 20, 6, 400);
        enemy.setMovePath([{ x: 50 + i * 80, y: -20 }, { x: 50 + i * 80, y: 100 }]);
        enemy.patterns = [new AimedShot(1000, 3.5, 2)];
        this.enemies.push(enemy);
      }
    }

    // Mid-boss (12s)
    if (this.timer >= 12000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(120, -60, 120, 60, 250, 20000, false, true);
      this.boss.setMovePath([{ x: 120, y: -60 }, { x: 120, y: 50 }]);
      this.boss.patterns = [
        new AimedShot(400, 4, Infinity),
        new CircleShot(2000, 3, 40),
        new SpiralShot(60, 3, 5000),
        new WaveShot(80, 3, 5000),
      ];
      this.enemies.push(this.boss);
    }

    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    for (const enemy of this.enemies) {
      enemy.update(dt);
      this.enemyBullets.push(...enemy.getBullets(dt, player.cx, player.cy));
    }
    for (const bullet of this.enemyBullets) bullet.update(dt);
    for (const bullet of this.playerBullets) bullet.update(dt);
    this.cleanup();
  }
}
```

- [ ] **Step 3: Write Stage4.ts**

Write `src/stages/Stage4.ts` — introduces LaserShot, higher density:

```typescript
import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { SpiralShot } from '../patterns/SpiralShot';
import { WaveShot } from '../patterns/WaveShot';
import { LaserShot } from '../patterns/LaserShot';

export class Stage4 extends Stage {
  readonly stageNumber = 4;
  readonly stageName = 'ABYSSAL FLAME';
  readonly themeColor = '#221122';
  private boss: Enemy | null = null;
  private bossSpawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1 (1s): 8 fast mooks
    if (this.timer >= 1000 && this.enemies.length === 0) {
      for (let i = 0; i < 8; i++) {
        const enemy = new Enemy(20 + i * 42, -30, 16, 16, 7, 500);
        enemy.setMovePath([{ x: 20 + i * 42, y: -30 }, { x: 20 + i * 42, y: 100 }]);
        enemy.patterns = [new AimedShot(1200, 3.5, 2)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2 (4s): Spiral enemies
    if (this.timer >= 4000 && this.timer < 4500) {
      for (let i = 0; i < 2; i++) {
        const enemy = new Enemy(100 + i * 160, -20, 28, 28, 30, 1000);
        enemy.setMovePath([{ x: 100 + i * 160, y: -20 }, { x: 100 + i * 160, y: 80 }]);
        enemy.patterns = [new SpiralShot(60, 3, 5000), new AimedShot(800, 3.5, 3)];
        this.enemies.push(enemy);
      }
    }

    // Wave 3 (8s): Laser enemies
    if (this.timer >= 8000 && this.timer < 8500) {
      const laserEnemy = new Enemy(140, -20, 30, 30, 40, 1200);
      laserEnemy.setMovePath([{ x: 140, y: -20 }, { x: 140, y: 70 }]);
      laserEnemy.patterns = [new LaserShot(1500, 2500), new WaveShot(100, 3, 4000)];
      this.enemies.push(laserEnemy);
    }

    // Mid-boss (13s)
    if (this.timer >= 13000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(110, -70, 140, 70, 400, 30000, false, true);
      this.boss.setMovePath([{ x: 110, y: -70 }, { x: 110, y: 40 }]);
      this.boss.patterns = [
        new AimedShot(350, 4.5, Infinity),
        new CircleShot(1800, 3.5, 48),
        new SpiralShot(50, 3.5, 6000),
        new WaveShot(70, 3.5, 6000),
        new LaserShot(2000, 2000),
      ];
      this.enemies.push(this.boss);
    }

    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    for (const enemy of this.enemies) {
      enemy.update(dt);
      this.enemyBullets.push(...enemy.getBullets(dt, player.cx, player.cy));
    }
    for (const bullet of this.enemyBullets) bullet.update(dt);
    for (const bullet of this.playerBullets) bullet.update(dt);
    this.cleanup();
  }
}
```

- [ ] **Step 4: Write Stage5.ts**

Write `src/stages/Stage5.ts` — final boss with 5+ phases, maximum density:

```typescript
import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { SpiralShot } from '../patterns/SpiralShot';
import { WaveShot } from '../patterns/WaveShot';
import { LaserShot } from '../patterns/LaserShot';
import { BulletType } from '../entities/types';

export class Stage5 extends Stage {
  readonly stageNumber = 5;
  readonly stageName = 'DANMA RENGO';
  readonly themeColor = '#220011';
  private boss: Enemy | null = null;
  private bossSpawned = false;
  private preBossWavesDone = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Pre-boss gauntlet: mixed dense waves
    if (this.timer >= 800 && this.timer < 1200 && this.enemies.filter(e => !e.isBoss && !e.isMidBoss).length < 3) {
      for (let i = 0; i < 3; i++) {
        const enemy = new Enemy(60 + i * 120, -20, 24, 24, 20, 800);
        enemy.setMovePath([{ x: 60 + i * 120, y: -20 }, { x: 60 + i * 120, y: 90 }]);
        enemy.patterns = [new SpiralShot(70, 3, 4000), new AimedShot(900, 4, 3)];
        this.enemies.push(enemy);
      }
    }

    if (this.timer >= 4000 && this.timer < 4500 && this.enemies.filter(e => !e.isBoss && !e.isMidBoss).length < 3) {
      for (let i = 0; i < 4; i++) {
        const enemy = new Enemy(30 + i * 95, -20, 20, 20, 15, 600);
        enemy.setMovePath([{ x: 30 + i * 95, y: -20 }, { x: 30 + i * 95, y: 100 }]);
        enemy.patterns = [new WaveShot(90, 3.5, 4000), new CircleShot(2500, 3, 24)];
        this.enemies.push(enemy);
      }
    }

    if (this.timer >= 8000 && this.timer < 8500 && this.enemies.filter(e => !e.isBoss && !e.isMidBoss).length < 3) {
      const laserEnemy = new Enemy(120, -20, 40, 40, 50, 2000);
      laserEnemy.setMovePath([{ x: 120, y: -20 }, { x: 120, y: 70 }]);
      laserEnemy.patterns = [new LaserShot(1200, 3000), new SpiralShot(50, 4, 4000)];
      this.enemies.push(laserEnemy);
    }

    // Final Boss (14s) — 5 phases
    if (this.timer >= 14000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(100, -80, 160, 80, 800, 50000, true, false);
      this.boss.setMovePath([{ x: 100, y: -80 }, { x: 100, y: 30 }]);
      // Phase 1 patterns (will be swapped on phase change — all active simultaneously)
      this.boss.patterns = [
        new AimedShot(300, 5, Infinity),
        new CircleShot(1500, 4, 60),
        new SpiralShot(40, 4, Infinity),
        new WaveShot(60, 4, Infinity),
        new LaserShot(2000, 2000),
        // Extra dense patterns for final boss
        new AimedShot(200, 6, Infinity, BulletType.Fast),
        new CircleShot(3000, 3.5, 72),
      ];
      this.enemies.push(this.boss);
    }

    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    // Phase transitions for final boss
    if (this.boss && this.boss.active && this.boss.checkPhase()) {
      // Add more patterns as phases progress
      if (this.boss.phase >= 3) {
        // Triple spiral in phase 3+
        if (!this.boss.patterns.find(p => p instanceof SpiralShot && p !== this.boss!.patterns[2])) {
          this.boss.patterns.push(new SpiralShot(30, 5, Infinity));
        }
      }
      if (this.boss.phase >= 4) {
        // Extra laser in phase 4+
        this.boss.patterns.push(new LaserShot(1500, 3000));
      }
      if (this.boss.phase >= 5) {
        // Maximum density in phase 5
        this.boss.patterns.push(new CircleShot(1000, 5, 90, BulletType.Fast));
      }
    }

    for (const enemy of this.enemies) {
      enemy.update(dt);
      this.enemyBullets.push(...enemy.getBullets(dt, player.cx, player.cy));
    }
    for (const bullet of this.enemyBullets) bullet.update(dt);
    for (const bullet of this.playerBullets) bullet.update(dt);
    this.cleanup();
  }
}
```

- [ ] **Step 5: Wire stages into Game.ts**

In `src/core/Game.ts`, update the `startStage` method's switch statement:

```typescript
import { Stage2 } from '../stages/Stage2';
import { Stage3 } from '../stages/Stage3';
import { Stage4 } from '../stages/Stage4';
import { Stage5 } from '../stages/Stage5';

// In startStage():
switch (stageNum) {
  case 1: this.currentStageInstance = new Stage1(); break;
  case 2: this.currentStageInstance = new Stage2(); break;
  case 3: this.currentStageInstance = new Stage3(); break;
  case 4: this.currentStageInstance = new Stage4(); break;
  case 5: this.currentStageInstance = new Stage5(); break;
  default: this.currentStageInstance = new Stage1(); break;
}
```

- [ ] **Step 6: Verify compilation**

```bash
bun run --build src/core/Game.ts
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Stages 2-5 with progressive difficulty and final boss"
```

---

### Task 15: Parallax Backgrounds and Visual Polish

**Files:**
- Create: `src/render/Background.ts`
- Modify: `src/core/Game.ts` — call background render

**Interfaces:**
- Consumes: `CanvasManager`, stage theme colors
- Produces: `Background` class with 3-layer parallax, per-stage color themes

- [ ] **Step 1: Write Background.ts**

Write `src/render/Background.ts`:

```typescript
import { CanvasManager } from '../core/Canvas';

interface Star {
  x: number; y: number; size: number; brightness: number;
}

export class Background {
  private farStars: Star[] = [];
  private midParticles: { x: number; y: number; size: number }[] = [];
  private nearDebris: { x: number; y: number; size: number }[] = [];
  private frameCount = 0;

  constructor() {
    // Far layer: many small stars
    for (let i = 0; i < 60; i++) {
      this.farStars.push({
        x: Math.random() * CanvasManager.WIDTH,
        y: Math.random() * CanvasManager.HEIGHT,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.2 + Math.random() * 0.5,
      });
    }
    // Mid layer: geometric particles
    for (let i = 0; i < 15; i++) {
      this.midParticles.push({
        x: Math.random() * CanvasManager.WIDTH,
        y: Math.random() * CanvasManager.HEIGHT,
        size: 1 + Math.random() * 2,
      });
    }
    // Near layer: larger debris
    for (let i = 0; i < 8; i++) {
      this.nearDebris.push({
        x: Math.random() * CanvasManager.WIDTH,
        y: Math.random() * CanvasManager.HEIGHT,
        size: 2 + Math.random() * 3,
      });
    }
  }

  update(dt: number): void {
    this.frameCount++;
    const speedFactor = dt / 16.67; // normalize to 60fps

    // Far stars: slow drift down
    for (const star of this.farStars) {
      star.y += 0.3 * speedFactor;
      if (star.y > CanvasManager.HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CanvasManager.WIDTH;
      }
    }
    // Mid particles: medium drift
    for (const p of this.midParticles) {
      p.y += 0.7 * speedFactor;
      if (p.y > CanvasManager.HEIGHT) {
        p.y = 0;
        p.x = Math.random() * CanvasManager.WIDTH;
      }
    }
    // Near debris: fast drift
    for (const d of this.nearDebris) {
      d.y += 1.3 * speedFactor;
      if (d.y > CanvasManager.HEIGHT) {
        d.y = 0;
        d.x = Math.random() * CanvasManager.WIDTH;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, themeColor: string): void {
    // Far layer: dim stars
    for (const star of this.farStars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    }

    // Mid layer: small geometric shapes in theme-adjacent color
    for (const p of this.midParticles) {
      ctx.fillStyle = 'rgba(100, 120, 180, 0.3)';
      // Small diamond
      const x = Math.floor(p.x), y = Math.floor(p.y), s = p.size;
      ctx.fillRect(x, y - s, 1, s * 2);
      ctx.fillRect(x - s, y, s * 2, 1);
    }

    // Near layer: brighter debris
    for (const d of this.nearDebris) {
      ctx.fillStyle = `rgba(200, 200, 255, ${0.15 + Math.sin(this.frameCount * 0.05 + d.x) * 0.1})`;
      ctx.fillRect(Math.floor(d.x), Math.floor(d.y), d.size, d.size);
    }
  }
}
```

- [ ] **Step 2: Wire background into Game.ts**

Add to `Game` class:
```typescript
import { Background } from '../render/Background';
// field:
readonly background = new Background();
```

In `update()` → `Scene.Playing`: add `this.background.update(dt);`

In `renderPlaying()` → before entities: add
```typescript
this.background.render(ctx, stage.themeColor);
```

- [ ] **Step 3: Verify visual**

```bash
bun run dev
```

Expected: 3-layer parallax scrolling background visible during gameplay.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 3-layer parallax background with per-stage themes"
```

---

### Task 16: Particle Effects, Hit Flash, and Polish

**Files:**
- Create: `src/render/Particles.ts`
- Modify: `src/core/Game.ts` — integrate particles

- [ ] **Step 1: Write Particles.ts**

Write `src/render/Particles.ts`:

```typescript
export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
}

export class ParticleSystem {
  particles: Particle[] = [];

  emit(x: number, y: number, count: number, color: string, speed = 2, life = 400): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        size: 1 + Math.random() * 3,
        color,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: Integrate particles into Game.ts**

Add to `Game`:
```typescript
import { ParticleSystem } from '../render/Particles';
// field:
readonly particles = new ParticleSystem();
```

In `updatePlaying()`, after enemy destroyed:
```typescript
this.particles.emit(enemy.cx, enemy.cy, enemy.isBoss ? 20 : 8,
  enemy.isBoss ? '#ff6644' : '#ffaa44', enemy.isBoss ? 4 : 2);
```

On player hit:
```typescript
this.particles.emit(this.player.cx, this.player.cy, 12, '#ff4444', 3, 500);
```

On bomb:
```typescript
this.particles.emit(180, 320, 30, '#ffffff', 6, 600);
```

In `renderPlaying()`:
```typescript
this.particles.render(ctx);
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: particle effects system for hits, explosions, and bomb"
```

---

### Task 17: Final Integration Test and Balance Tuning

- [ ] **Step 1: Run the full game end-to-end**

```bash
bun run dev
```

Test checklist:
- [ ] Title screen → Z starts game
- [ ] Stage 1: enemies spawn, shoot, die. Mid-boss fight.
- [ ] Stage clear → bonus display → next stage
- [ ] All 5 stages playable with increasing difficulty
- [ ] Stage 5 final boss has 5+ phases, high bullet density
- [ ] Player movement, shooting (5 power levels), bombing work
- [ ] Lives system, continue, game over flow
- [ ] Hi-score persists in localStorage
- [ ] Keyboard input (arrows, Z, X, Shift, Escape)
- [ ] Touch input on mobile (drag to move, auto-shoot)
- [ ] Pause/Resume with Escape
- [ ] Screen shake on bomb and player hit
- [ ] Particle effects on enemy death
- [ ] Graze scoring works
- [ ] Parallax background scrolling
- [ ] HUD displays all info correctly

- [ ] **Step 2: Tune any balance issues found**

Adjust enemy HP, bullet speeds, spawn timings if needed.

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "feat: final integration, balance tuning, and polish"
```
