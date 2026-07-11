import { CanvasManager } from './core/Canvas';
import { Game } from './core/Game';
import { audioCore } from './audio/AudioCore';
// Imported for their side-effecting singleton registration with audioCore.
import './audio/SoundManager';
import './audio/MusicManager';

const canvasEl = document.getElementById('game') as HTMLCanvasElement;
if (!canvasEl) throw new Error('Canvas element #game not found');

// Browsers require audio to be unlocked from within a user gesture.
const unlockAudio = () => {
  audioCore.unlock();
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('touchstart', unlockAudio);
  window.removeEventListener('pointerdown', unlockAudio);
};
window.addEventListener('keydown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

const canvas = new CanvasManager(canvasEl);
const game = new Game(canvas);
game.start();
