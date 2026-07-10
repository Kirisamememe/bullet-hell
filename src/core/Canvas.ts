export class CanvasManager {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly offscreen: HTMLCanvasElement;
  readonly offscreenCtx: CanvasRenderingContext2D;

  /** Integer scale factor from game resolution to CSS pixels. */
  scale = 1;

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
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement ?? document.body;
    const maxW = parent.clientWidth;
    const maxH = parent.clientHeight;

    // Integer scale for dot-by-dot (crisp pixel art)
    this.scale = Math.max(1, Math.floor(Math.min(
      maxW / CanvasManager.WIDTH,
      maxH / CanvasManager.HEIGHT
    )));

    // Display canvas buffer: game-res × integer-scale × device-pixel-ratio
    const bufferW = CanvasManager.WIDTH * this.scale * dpr;
    const bufferH = CanvasManager.HEIGHT * this.scale * dpr;
    this.canvas.width = bufferW;
    this.canvas.height = bufferH;

    // CSS size: game-res × integer-scale (logical pixels)
    const cssW = CanvasManager.WIDTH * this.scale;
    const cssH = CanvasManager.HEIGHT * this.scale;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${(maxW - cssW) / 2}px`;
    this.canvas.style.top = `${(maxH - cssH) / 2}px`;
  }

  flip(): void {
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.drawImage(
      this.offscreen,
      0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT,
      0, 0, CanvasManager.WIDTH * this.scale, CanvasManager.HEIGHT * this.scale
    );
    ctx.restore();
  }
}
