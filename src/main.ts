const canvas = document.getElementById('game') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element #game not found');
const ctx = canvas.getContext('2d')!;

canvas.width = 360;
canvas.height = 640;
canvas.style.width = '100%';
canvas.style.height = '100%';

ctx.fillStyle = '#111';
ctx.fillRect(0, 0, 360, 640);
ctx.fillStyle = '#fff';
ctx.font = '16px monospace';
ctx.fillText('弾幕煉獄 loading...', 100, 320);
