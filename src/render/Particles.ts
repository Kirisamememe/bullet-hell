export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  glow?: boolean;
  gravity?: number;
  drag?: number;
}

export interface Shockwave {
  x: number; y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
}

export interface Spark {
  x: number; y: number;
  angle: number;
  length: number;
  life: number;
  maxLife: number;
  color: string;
}

export class ParticleSystem {
  particles: Particle[] = [];
  shockwaves: Shockwave[] = [];
  sparks: Spark[] = [];

  emit(
    x: number, y: number, count: number, color: string,
    speed = 2, life = 400, opts: { glow?: boolean; size?: number; gravity?: number; drag?: number } = {}
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        size: opts.size ?? (1 + Math.random() * 3),
        color,
        glow: opts.glow,
        gravity: opts.gravity,
        drag: opts.drag,
      });
    }
  }

  /** Expanding fading ring — used for explosions, bomb, phase-change flashes. */
  emitShockwave(x: number, y: number, maxRadius: number, color: string, life = 400, lineWidth = 3): void {
    this.shockwaves.push({ x, y, radius: 0, maxRadius, life, maxLife: life, color, lineWidth });
  }

  /** Directional streak lines radiating outward — used for muzzle flash / hit sparks. */
  emitSparks(x: number, y: number, count: number, color: string, length = 6, life = 150): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.sparks.push({ x, y, angle, length: length * (0.6 + Math.random() * 0.8), life, maxLife: life, color });
    }
  }

  update(dt: number): void {
    const step = dt / 16.67;
    for (const p of this.particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      if (p.gravity) p.vy += p.gravity * step;
      if (p.drag) {
        p.vx *= Math.pow(p.drag, step);
        p.vy *= Math.pow(p.drag, step);
      }
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const s of this.shockwaves) {
      const t = 1 - Math.max(0, s.life - dt) / s.maxLife;
      s.radius = s.maxRadius * Math.min(1, t + dt / s.maxLife);
      s.life -= dt;
    }
    this.shockwaves = this.shockwaves.filter(s => s.life > 0);

    for (const s of this.sparks) {
      s.life -= dt;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2.5;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      }
    }

    for (const s of this.shockwaves) {
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth * alpha + 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.1, s.radius), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const s of this.sparks) {
      const alpha = Math.max(0, s.life / s.maxLife);
      const len = s.length * alpha;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(s.angle) * len, s.y + Math.sin(s.angle) * len);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
