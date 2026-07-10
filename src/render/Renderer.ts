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
