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
