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
