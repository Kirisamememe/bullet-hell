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

    // Controls
    drawPixelText(ctx, '(C) 2026', 140, 600, '#666666', 1);
    drawPixelText(ctx, 'ARROWS:MOVE Z:SHOT X:BOMB', 55, 560, '#888888', 1);
    drawPixelText(ctx, 'SHIFT:SLOW ESC:PAUSE', 70, 576, '#888888', 1);
  }
}
