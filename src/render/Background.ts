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
    for (let i = 0; i < 60; i++) {
      this.farStars.push({
        x: Math.random() * CanvasManager.WIDTH,
        y: Math.random() * CanvasManager.HEIGHT,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.2 + Math.random() * 0.5,
      });
    }
    for (let i = 0; i < 15; i++) {
      this.midParticles.push({
        x: Math.random() * CanvasManager.WIDTH,
        y: Math.random() * CanvasManager.HEIGHT,
        size: 1 + Math.random() * 2,
      });
    }
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
    const speedFactor = dt / 16.67;

    for (const star of this.farStars) {
      star.y += 0.3 * speedFactor;
      if (star.y > CanvasManager.HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CanvasManager.WIDTH;
      }
    }
    for (const p of this.midParticles) {
      p.y += 0.7 * speedFactor;
      if (p.y > CanvasManager.HEIGHT) {
        p.y = 0;
        p.x = Math.random() * CanvasManager.WIDTH;
      }
    }
    for (const d of this.nearDebris) {
      d.y += 1.3 * speedFactor;
      if (d.y > CanvasManager.HEIGHT) {
        d.y = 0;
        d.x = Math.random() * CanvasManager.WIDTH;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, _themeColor: string): void {
    // Far layer: dim stars
    for (const star of this.farStars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    }

    // Mid layer: small cross shapes
    for (const p of this.midParticles) {
      ctx.fillStyle = 'rgba(100, 120, 180, 0.3)';
      const x = Math.floor(p.x), y = Math.floor(p.y), s = p.size;
      ctx.fillRect(x, y - s, 1, s * 2);
      ctx.fillRect(x - s, y, s * 2, 1);
    }

    // Near layer: brighter debris with subtle animation
    for (const d of this.nearDebris) {
      ctx.fillStyle = `rgba(200, 200, 255, ${0.15 + Math.sin(this.frameCount * 0.05 + d.x) * 0.1})`;
      ctx.fillRect(Math.floor(d.x), Math.floor(d.y), d.size, d.size);
    }
  }
}
