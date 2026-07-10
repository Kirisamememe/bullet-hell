import { CanvasManager } from './Canvas';
import { Input } from './Input';
import { Player } from '../entities/Player';

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
  player: Player | null = null;

  constructor(canvas: CanvasManager) {
    this.canvas = canvas;
    this.input = new Input(canvas.canvas);
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

  newGame(): void {
    this.score = 0;
    this.lives = 3;
    this.bombs = 3;
    this.power = 1;
    this.player = new Player();
    this.scene = Scene.Playing;
  }

  update(dt: number): void {
    switch (this.scene) {
      case Scene.Playing: {
        if (!this.player) break;
        const input = this.input.state;

        // Handle bomb consumption
        if (this.input.consumeBomb() && this.bombs > 0) {
          this.bombs--;
          this.player.useBomb();
        }

        this.player.handleInput(input);
        // Collect bullets from shooting for later processing
        // (bullet pool management added in a later task)
        this.player.shoot(dt);
        this.player.update(dt);
        break;
      }
      default:
        break;
    }
  }

  render(): void {
    const ctx = this.canvas.offscreenCtx;
    // Clear with dark background
    ctx.fillStyle = '#111133';
    ctx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);

    // Scene-specific rendering
    if (this.scene === Scene.Playing) {
      if (this.player) {
        this.player.render(ctx);
      }
    }

    // Scene text placeholder
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Scene: ${Scene[this.scene]}`, 10, 20);

    this.canvas.flip();
  }
}
