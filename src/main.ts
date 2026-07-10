import { CanvasManager } from './core/Canvas';
import { Game } from './core/Game';

const canvasEl = document.getElementById('game') as HTMLCanvasElement;
if (!canvasEl) throw new Error('Canvas element #game not found');

const canvas = new CanvasManager(canvasEl);
const game = new Game(canvas);
game.start();
