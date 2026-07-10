import { CanvasManager } from '../core/Canvas';
import { drawPixelText } from '../render/sprites';

const W = CanvasManager.WIDTH;
const H = CanvasManager.HEIGHT;
const CHAR_W = 6; // 5px glyph + 1px gap

/** Calculate x to center text of given length at given scale */
function cx(textLen: number, scale = 1): number {
  return Math.floor((W - textLen * CHAR_W * scale) / 2);
}

export class TitleScreen {
  private starField: { x: number; y: number; speed: number; brightness: number; size: number }[] = [];
  private blinkTimer = 0;
  private showPressStart = true;
  private frameCount = 0;

  constructor() {
    for (let i = 0; i < 80; i++) {
      this.starField.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 0.2 + Math.random() * 1.5,
        brightness: 0.2 + Math.random() * 0.8,
        size: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  update(dt: number): void {
    this.frameCount++;
    for (const star of this.starField) {
      star.y += star.speed * (dt / 16.67);
      if (star.y > H + 4) { star.y = -4; star.x = Math.random() * W; }
    }
    this.blinkTimer += dt;
    if (this.blinkTimer >= 500) {
      this.blinkTimer -= 500;
      this.showPressStart = !this.showPressStart;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Deep space background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05051a');
    grad.addColorStop(0.5, '#0a0a28');
    grad.addColorStop(1, '#0d0d20');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Twinkling stars
    for (const star of this.starField) {
      const twinkle = 0.5 + 0.5 * Math.sin(this.frameCount * 0.03 + star.x * 0.1);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle})`;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    }

    // === Decorative border ===
    const borderY1 = 140, borderY2 = 275, borderW = 240;
    const borderX = (W - borderW) / 2;
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(borderX, borderY1, borderW, 2);
    ctx.fillRect(borderX, borderY2, borderW, 2);
    ctx.fillStyle = '#ff444433';
    ctx.fillRect(borderX - 2, borderY1, 2, borderY2 - borderY1 + 2);
    ctx.fillRect(borderX + borderW, borderY1, 2, borderY2 - borderY1 + 2);

    // === Title (centered) ===
    drawPixelText(ctx, 'DANMA', cx(5, 2), 155, '#ff4444', 2);
    drawPixelText(ctx, 'RENGO', cx(5, 2), 185, '#ff4444', 2);
    drawPixelText(ctx, '弾 幕 煉 獄', cx(7), 225, '#ff8844', 1);

    // === Start prompt (centered) ===
    if (this.showPressStart) {
      drawPixelText(ctx, 'PRESS Z OR TAP', cx(16), 390, '#ffffff', 1);
      drawPixelText(ctx, 'TO START', cx(8), 406, '#aaaaaa', 1);
    }

    // === Controls box (centered) ===
    const ctrlY = 510;
    const ctrlW = 220, ctrlH = 58;
    const ctrlX = (W - ctrlW) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(ctrlX, ctrlY - 12, ctrlW, ctrlH);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(ctrlX + 2, ctrlY - 10, ctrlW - 4, ctrlH - 4);

    const col1 = ctrlX + 12;
    const col2 = ctrlX + 106;
    drawPixelText(ctx, 'ARROWS / WASD', col1, ctrlY, '#aaaacc', 1);
    drawPixelText(ctx, 'Z : SHOT',   col2, ctrlY, '#ffcc88', 1);
    drawPixelText(ctx, 'X : BOMB',   col1, ctrlY + 16, '#ffcc88', 1);
    drawPixelText(ctx, 'SHIFT : SLOW', col2, ctrlY + 16, '#ffcc88', 1);
    drawPixelText(ctx, 'ESC : PAUSE', col1, ctrlY + 32, '#aaaacc', 1);

    // === Footer (centered) ===
    drawPixelText(ctx, '(C) 2026  DANMA RENGO', cx(22), 620, '#555566', 1);
  }
}
