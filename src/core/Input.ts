export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shot: boolean;
  bomb: boolean;
  slow: boolean;
  pause: boolean;
  touchActive: boolean;
  touchX: number;
  touchY: number;
  bombButtonPressed: boolean; // touch-only bomb trigger
}

export class Input {
  state: InputState = {
    up: false, down: false, left: false, right: false,
    shot: false, bomb: false, slow: false, pause: false,
    touchActive: false, touchX: 0, touchY: 0,
    bombButtonPressed: false,
  };

  private pauseConsumed = false;
  private bombConsumed = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
  }

  private onKey(e: KeyboardEvent, pressed: boolean): void {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': this.state.up = pressed; break;
      case 'ArrowDown': case 'KeyS': this.state.down = pressed; break;
      case 'ArrowLeft': case 'KeyA': this.state.left = pressed; break;
      case 'ArrowRight': case 'KeyD': this.state.right = pressed; break;
      case 'KeyZ': case 'Space': this.state.shot = pressed; break;
      case 'KeyX': if (pressed) this.state.bomb = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.state.slow = pressed; break;
      case 'Escape': if (pressed) this.state.pause = true; break;
    }
    e.preventDefault();
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    this.state.touchActive = true;
    this.state.touchX = touch.clientX;
    this.state.touchY = touch.clientY;
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    this.state.touchX = touch.clientX;
    this.state.touchY = touch.clientY;
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 0) {
      this.state.touchActive = false;
    }
  }

  /** Returns true once per pause press, then false until pressed again. */
  consumePause(): boolean {
    if (this.state.pause && !this.pauseConsumed) {
      this.pauseConsumed = true;
      return true;
    }
    if (!this.state.pause) {
      this.pauseConsumed = false;
    }
    return false;
  }

  /** Returns true once per bomb press, then false until pressed again. */
  consumeBomb(): boolean {
    if ((this.state.bomb || this.state.bombButtonPressed) && !this.bombConsumed) {
      this.bombConsumed = true;
      return true;
    }
    if (!this.state.bomb && !this.state.bombButtonPressed) {
      this.bombConsumed = false;
    }
    return false;
  }
}
