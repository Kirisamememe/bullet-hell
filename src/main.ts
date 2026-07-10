import { CanvasManager } from './core/Canvas';

const canvasEl = document.getElementById('game') as HTMLCanvasElement;
if (!canvasEl) throw new Error('Canvas element #game not found');

const canvas = new CanvasManager(canvasEl);

// Temporary render test
canvas.offscreenCtx.fillStyle = '#111133';
canvas.offscreenCtx.fillRect(0, 0, CanvasManager.WIDTH, CanvasManager.HEIGHT);
canvas.offscreenCtx.fillStyle = '#fff';
canvas.offscreenCtx.font = '16px monospace';
canvas.offscreenCtx.fillText('弾幕煉獄', 130, 320);
canvas.flip();
