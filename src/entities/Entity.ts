export abstract class Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  active: boolean = true;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.vx = 0;
    this.vy = 0;
  }

  /** Returns center x */
  get cx(): number { return this.x + this.width / 2; }
  /** Returns center y */
  get cy(): number { return this.y + this.height / 2; }

  abstract update(dt: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;

  isOffScreen(padX = 0, padY = 0): boolean {
    return this.x < -padX || this.x > 360 + padX ||
           this.y < -padY || this.y > 640 + padY;
  }
}
