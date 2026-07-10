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
