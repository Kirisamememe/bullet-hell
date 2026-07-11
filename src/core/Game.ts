import { CanvasManager, WIDTH, HEIGHT } from './Canvas';
import { Input } from './Input';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { HUD } from '../ui/HUD';
import { TitleScreen } from '../ui/TitleScreen';
import { Stage } from '../stages/Stage';
import { Stage1 } from '../stages/Stage1';
import { Stage2 } from '../stages/Stage2';
import { Stage3 } from '../stages/Stage3';
import { Stage4 } from '../stages/Stage4';
import { Stage5 } from '../stages/Stage5';
import { drawPixelText } from '../render/sprites';
import { Background } from '../render/Background';
import { ParticleSystem } from '../render/Particles';
import { checkPlayerCollisions, checkEnemyCollisions, checkGraze } from '../systems/Collision';
import { soundManager } from '../audio/SoundManager';
import { musicManager } from '../audio/MusicManager';
import { TITLE_TRACK, STAGE_TRACK, BOSS_TRACK } from '../audio/tracks';

const CHAR_W = 6;
/** Center text of given length at given scale */
function cx(len: number, scale = 1): number {
  return Math.floor((WIDTH - len * CHAR_W * scale) / 2);
}

export enum Scene {
  Title,
  StageIntro,
  Playing,
  Paused,
  StageClear,
  GameOver,
}

export class Game {
  readonly canvas: CanvasManager;
  readonly input: Input;
  readonly hud: HUD;
  readonly titleScreen: TitleScreen;
  readonly background: Background;
  readonly particles: ParticleSystem;
  scene: Scene = Scene.Title;
  private running = false;
  private lastTime = 0;

  // Game state
  score = 0;
  hiScore = this.loadHiScore();
  lives = 3;
  bombs = 3;
  power = 1;
  currentStage = 1;
  continueCount = 0;

  // Entities
  player!: Player;
  currentStageInstance!: Stage;
  private wasBossActive = false;

  // Stage intro / clear timers
  private transitionTimer = 0;
  private stageClearTimer = 0;

  // Bomb effect
  private bombFlash = 0;       // screen flash timer (ms)
  private bombRing = 0;        // expanding ring radius

  // Big explosion (boss/midboss death) screen flash
  private explosionFlash = 0;  // ms
  private explosionFlashMax = 0;

  // Screen shake
  private shakeAmp = 0;        // px, current max amplitude
  private shakeTimer = 0;      // ms remaining
  private shakeDuration = 0;   // ms total (for decay ratio)

  constructor(canvas: CanvasManager) {
    this.canvas = canvas;
    this.input = new Input(canvas.canvas);
    this.hud = new HUD();
    this.titleScreen = new TitleScreen();
    this.background = new Background();
    this.particles = new ParticleSystem();
    this.initPlayer();
  }

  private initPlayer(): void {
    this.player = new Player();
  }

  private loadHiScore(): number {
    try {
      const stored = localStorage.getItem('danma-hi');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  saveHiScore(): void {
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      try {
        localStorage.setItem('danma-hi', String(this.hiScore));
      } catch { /* localStorage may be unavailable */ }
    }
  }

  /** Adds screen shake. Keeps the strongest shake currently in effect. */
  addScreenShake(amplitude: number, duration = 200): void {
    if (amplitude >= this.shakeAmp || this.shakeTimer <= 0) {
      this.shakeAmp = amplitude;
      this.shakeDuration = duration;
      this.shakeTimer = duration;
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.running = true;
    this.loop(this.lastTime);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const rawDt = now - this.lastTime;
    this.lastTime = now;
    const dt = Math.min(rawDt, 33.33);
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  };

  private startStage(stageNum: number): void {
    this.currentStage = stageNum;
    switch (stageNum) {
      case 1: this.currentStageInstance = new Stage1(); break;
      case 2: this.currentStageInstance = new Stage2(); break;
      case 3: this.currentStageInstance = new Stage3(); break;
      case 4: this.currentStageInstance = new Stage4(); break;
      case 5: this.currentStageInstance = new Stage5(); break;
      default: this.currentStageInstance = new Stage1(); break;
    }
    this.player = new Player();
    this.wasBossActive = false;
    this.scene = Scene.StageIntro;
    this.transitionTimer = 2000;
    musicManager.play('stage', STAGE_TRACK);
  }

  update(dt: number): void {
    const pausePressed = this.input.consumePause();
    if (pausePressed) {
      if (this.scene === Scene.Playing) {
        soundManager.pause();
        this.scene = Scene.Paused;
        return;
      } else if (this.scene === Scene.Paused) {
        soundManager.pause();
        this.scene = Scene.Playing;
        return;
      }
    }

    switch (this.scene) {
      case Scene.Title:
        musicManager.play('title', TITLE_TRACK);
        this.titleScreen.update(dt);
        if (this.input.consumeShot()) {
          soundManager.menuConfirm();
          this.score = 0;
          this.lives = 3;
          this.bombs = 3;
          this.power = 1;
          this.continueCount = 0;
          this.startStage(1);
        }
        break;

      case Scene.StageIntro:
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
          this.scene = Scene.Playing;
        }
        break;

      case Scene.Playing:
        this.updatePlaying(dt);
        break;

      case Scene.StageClear:
        this.stageClearTimer -= dt;
        if (this.stageClearTimer <= 0) {
          if (this.currentStage < 5) {
            this.startStage(this.currentStage + 1);
          } else {
            this.saveHiScore();
            this.scene = Scene.Title;
          }
        }
        break;

      case Scene.Paused:
        break;

      case Scene.GameOver:
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
          // Tap position-based action (touch-first, won't conflict with keyboard)
          const tap = this.input.consumeTap();
          if (tap) {
            // Upper 65% of screen → continue, lower 35% → title
            if (tap.y < HEIGHT * 0.65) {
              soundManager.menuConfirm();
              this.lives = 3;
              this.bombs = 3;
              this.power = 1;
              this.continueCount++;
              this.startStage(this.currentStage);
            } else {
              soundManager.menuMove();
              this.saveHiScore();
              this.scene = Scene.Title;
            }
          } else {
            // Keyboard fallback
            if (this.input.consumeShot()) {
              soundManager.menuConfirm();
              this.lives = 3;
              this.bombs = 3;
              this.power = 1;
              this.continueCount++;
              this.startStage(this.currentStage);
            }
            if (this.input.consumeBomb()) {
              soundManager.menuMove();
              this.saveHiScore();
              this.scene = Scene.Title;
            }
          }
        }
        break;
    }
  }

  private updatePlaying(dt: number): void {
    // Background
    this.background.update(dt);
    this.particles.update(dt);

    // Bomb effect timers
    if (this.bombFlash > 0) {
      this.bombFlash -= dt;
      this.bombRing += dt * 0.8; // ring expands
    }
    // Big explosion (boss death) flash timer
    if (this.explosionFlash > 0) {
      this.explosionFlash -= dt;
      if (this.explosionFlash < 0) this.explosionFlash = 0;
    }
    // Screen shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer < 0) this.shakeTimer = 0;
    }

    // Touch bomb button: tap in bottom-left corner triggers bomb
    const tap = this.input.consumeTap();
    if (tap) {
      const gp = this.canvas.screenToGame(tap.x, tap.y);
      if (gp.x >= 6 && gp.x <= 44 && gp.y >= HEIGHT - 44 && gp.y <= HEIGHT - 6) {
        this.input.state.bombButtonPressed = true;
      }
    }

    // Player input
    this.player.handleInput(
      this.input.state,
      dt,
      (sx, sy) => this.canvas.screenToGame(sx, sy)
    );

    // Player shooting
    if (this.input.state.shot || this.input.state.touchActive) {
      const newBullets = this.player.shoot(dt);
      if (newBullets.length > 0) {
        this.currentStageInstance.playerBullets.push(...newBullets);
        soundManager.playerShot();
        this.particles.emit(this.player.cx, this.player.y - 2, 2, '#aef6ff', 1.2, 90, { glow: true, size: 1.5 });
      }
    } else {
      this.player.shootTimer = 0;
    }

    // Bomb
    if (this.input.consumeBomb() && this.bombs > 0) {
      this.bombs--;
      this.player.useBomb();
      soundManager.bomb();
      // Clear all enemy bullets
      for (const b of this.currentStageInstance.enemyBullets) {
        b.active = false;
      }
      // Damage all enemies on screen
      for (const enemy of this.currentStageInstance.enemies) {
        if (enemy.active) enemy.takeDamage(30);
      }
      // Spectacular effects
      this.bombFlash = 400;
      this.bombRing = 0;
      this.addScreenShake(9, 350);
      this.particles.emit(180, 320, 60, '#ffffff', 8, 700, { glow: true });
      this.particles.emit(180, 320, 40, '#ffcc44', 10, 500, { glow: true });
      this.particles.emit(180, 320, 20, '#ff6622', 12, 400);
      this.particles.emitShockwave(180, 320, 220, '#ffffff', 600, 3);
    }
    // Reset touch bomb flag after processing
    this.input.state.bombButtonPressed = false;

    // Update player
    this.player.update(dt);

    // Update stage
    this.currentStageInstance.update(dt, this.player);

    // Boss / mid-boss appearance alert
    if (this.currentStageInstance.isBossActive && !this.wasBossActive) {
      soundManager.bossAlert();
      musicManager.play('boss', BOSS_TRACK, 0.8);
      this.addScreenShake(5, 300);
    }
    this.wasBossActive = this.currentStageInstance.isBossActive;

    // Boss phase transitions (flag set by Enemy.checkPhase())
    for (const enemy of this.currentStageInstance.enemies) {
      if (enemy.phaseChangedFlag) {
        enemy.phaseChangedFlag = false;
        soundManager.phaseChange();
        this.particles.emitShockwave(enemy.cx, enemy.cy, enemy.isBoss ? 100 : 60, '#ffffff', 450, 4);
        this.addScreenShake(7, 250);
      }
    }

    // Collision: player vs enemy bullets
    if (checkPlayerCollisions(this.player, this.currentStageInstance.enemyBullets)) {
      if (this.player.hit()) {
        this.lives--;
        soundManager.playerHit();
        this.particles.emit(this.player.cx, this.player.cy, 16, '#ff4444', 3, 500, { glow: true });
        this.particles.emitShockwave(this.player.cx, this.player.cy, 36, '#ff6666', 350, 3);
        this.addScreenShake(10, 320);
        if (this.lives < 0) {
          this.lives = 0;
          this.saveHiScore();
          musicManager.stop(0.5);
          soundManager.gameOver();
          this.scene = Scene.GameOver;
          this.transitionTimer = 1500;
          return;
        }
      }
    }

    // Graze detection
    for (const bullet of this.currentStageInstance.enemyBullets) {
      if (bullet.active && checkGraze(this.player, bullet)) {
        this.score += 100;
        this.hud.triggerGrazeFlash();
        soundManager.graze();
      }
    }

    // Collision: player bullets vs enemies (onHit fires for every impact, including kills)
    const destroyed = checkEnemyCollisions(
      this.currentStageInstance.enemies,
      this.currentStageInstance.playerBullets,
      (hx, hy) => {
        soundManager.enemyHit();
        this.particles.emitSparks(hx, hy, 3, '#fff4cc', 5, 120);
      }
    );
    for (const enemy of destroyed) {
      this.score += enemy.scoreValue;
      this.onEnemyDestroyed(enemy);
      if (enemy.dropPowerItem && this.power < 5) {
        this.power++;
        soundManager.powerUp();
        this.particles.emit(enemy.cx, enemy.cy, 10, '#66ffee', 2, 400, { glow: true });
      }
    }

    // Stage complete
    if (this.currentStageInstance.isComplete) {
      this.score += this.bombs * 5000;
      this.score += this.lives * 10000;
      this.saveHiScore();
      musicManager.stop(0.5);
      soundManager.stageClear();
      this.scene = Scene.StageClear;
      this.stageClearTimer = 3000;
    }

    // Sync player power with game
    this.power = this.player.power;

    // HUD
    this.hud.update(dt);
  }

  /** Spawns layered explosion VFX + sound when an enemy is destroyed. */
  private onEnemyDestroyed(enemy: Enemy): void {
    const pal = enemy.palette;
    const isBig = enemy.isBoss || enemy.isMidBoss;

    if (isBig) {
      soundManager.bossDeath();
      const core = pal?.core ?? '#ffffff';
      const light = pal?.light ?? '#ffaa44';
      const glow = pal?.glow ?? '#ff4422';
      this.particles.emit(enemy.cx, enemy.cy, 50, core, 5, 750, { glow: true });
      this.particles.emit(enemy.cx, enemy.cy, 35, light, 4, 600, { glow: true });
      this.particles.emit(enemy.cx, enemy.cy, 22, glow, 3, 450);
      this.particles.emitSparks(enemy.cx, enemy.cy, 16, '#ffffff', 20, 300);
      this.particles.emitShockwave(enemy.cx, enemy.cy, enemy.isBoss ? 110 : 65, '#ffffff', 550, 4);
      this.particles.emitShockwave(enemy.cx, enemy.cy, enemy.isBoss ? 75 : 45, glow, 700, 3);
      this.addScreenShake(enemy.isBoss ? 15 : 9, enemy.isBoss ? 500 : 320);
      this.explosionFlash = enemy.isBoss ? 280 : 160;
      this.explosionFlashMax = this.explosionFlash;
    } else {
      soundManager.enemyDeath();
      const light = pal?.light ?? '#ffaa44';
      this.particles.emit(enemy.cx, enemy.cy, 14, light, 2.5, 380, { glow: true });
      this.particles.emitSparks(enemy.cx, enemy.cy, 6, '#ffffff', 8, 200);
      this.particles.emitShockwave(enemy.cx, enemy.cy, 24, light, 300, 2);
      this.addScreenShake(2.5, 120);
    }
  }

  render(): void {
    const ctx = this.canvas.offscreenCtx;

    // Clear (slightly padded so screen-shake translation never reveals gaps)
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(-16, -16, WIDTH + 32, HEIGHT + 32);

    switch (this.scene) {
      case Scene.Title:
        this.titleScreen.render(ctx);
        break;

      case Scene.StageIntro:
        this.renderStageIntro(ctx);
        break;

      case Scene.Playing:
      case Scene.Paused:
        this.renderShaken(ctx, () => this.renderPlaying(ctx));
        if (this.scene === Scene.Paused) {
          this.renderPauseOverlay(ctx);
        }
        break;

      case Scene.StageClear:
        this.renderShaken(ctx, () => this.renderPlaying(ctx));
        this.renderStageClearOverlay(ctx);
        break;

      case Scene.GameOver:
        this.renderGameOver(ctx);
        break;
    }

    this.canvas.flip();
  }

  /** Runs a render callback offset by the current screen-shake amplitude. */
  private renderShaken(ctx: CanvasRenderingContext2D, draw: () => void): void {
    let sx = 0, sy = 0;
    if (this.shakeTimer > 0 && this.shakeDuration > 0) {
      const ratio = this.shakeTimer / this.shakeDuration;
      const amp = this.shakeAmp * ratio;
      sx = (Math.random() - 0.5) * 2 * amp;
      sy = (Math.random() - 0.5) * 2 * amp;
    }
    ctx.save();
    ctx.translate(sx, sy);
    draw();
    ctx.restore();
  }

  private renderStageIntro(ctx: CanvasRenderingContext2D): void {
    const stage = this.currentStageInstance;
    const numStr = `STAGE ${stage.stageNumber}`;
    const nameStr = `-- ${stage.stageName} --`;

    drawPixelText(ctx, numStr, cx(numStr.length), 270, '#ffffff', 1);
    drawPixelText(ctx, nameStr, cx(nameStr.length), 300, '#ff8844', 1);
    drawPixelText(ctx, 'READY...', cx(8), 350, '#ffffff', 1);
  }

  private renderPlaying(ctx: CanvasRenderingContext2D): void {
    const stage = this.currentStageInstance;

    // Parallax background
    this.background.render(ctx, stage.themeColor);

    // Bomb expanding ring (behind entities)
    if (this.bombRing > 0 && this.bombFlash > 0) {
      const alpha = this.bombFlash / 400;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(180, 320, this.bombRing, 0, Math.PI * 2);
      ctx.stroke();
      // Inner glow
      ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.6})`;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(180, 320, Math.max(0, this.bombRing - 20), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Particles (behind entities)
    this.particles.render(ctx);

    // Enemies
    for (const enemy of stage.enemies) {
      enemy.render(ctx);
    }

    // Enemy bullets
    for (const bullet of stage.enemyBullets) {
      bullet.render(ctx);
    }

    // Player bullets
    for (const bullet of stage.playerBullets) {
      bullet.render(ctx);
    }

    // Player
    this.player.render(ctx);

    // Touch bomb button (bottom-left corner)
    {
      const bx = 6, by = HEIGHT - 44;
      ctx.fillStyle = 'rgba(255, 200, 50, 0.18)';
      ctx.fillRect(bx, by, 38, 38);
      ctx.strokeStyle = 'rgba(255, 200, 50, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, 38, 38);
      drawPixelText(ctx, 'B', bx + 16, by + 8, '#ffcc00', 1);
      drawPixelText(ctx, 'BOMB', bx + 7, by + 22, '#ffcc0077', 1);
    }

    // Bomb screen flash overlay
    if (this.bombFlash > 0) {
      const alpha = (this.bombFlash / 400) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Big explosion (boss/midboss death) screen flash overlay
    if (this.explosionFlash > 0 && this.explosionFlashMax > 0) {
      const alpha = (this.explosionFlash / this.explosionFlashMax) * 0.55;
      ctx.fillStyle = `rgba(255, 240, 200, ${alpha})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // HUD
    this.hud.render(ctx, this);
  }

  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawPixelText(ctx, 'PAUSED', cx(6), 300, '#ffffff', 1);
    drawPixelText(ctx, 'ESC TO RESUME', cx(13), 330, '#aaaaaa', 1);
  }

  private renderStageClearOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawPixelText(ctx, 'STAGE CLEAR!', cx(12), 270, '#ffcc00', 1);
    const bonus = this.bombs * 5000 + this.lives * 10000;
    const bonusStr = `BONUS: ${bonus}`;
    drawPixelText(ctx, bonusStr, cx(bonusStr.length), 310, '#ffffff', 1);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawPixelText(ctx, 'GAME OVER', cx(9), 230, '#ff2222', 1);

    const scoreStr = `SCORE: ${String(this.score).padStart(8, '0')}`;
    drawPixelText(ctx, scoreStr, cx(scoreStr.length), 280, '#ffffff', 1);

    const hiStr = `HI: ${String(this.hiScore).padStart(8, '0')}`;
    drawPixelText(ctx, hiStr, cx(hiStr.length), 300, '#aaaaaa', 1);

    if (this.score >= this.hiScore && this.score > 0) {
      drawPixelText(ctx, 'NEW RECORD!', cx(11), 330, '#ffcc00', 1);
    }

    // Divider between continue/title tap zones
    const divY = Math.floor(HEIGHT * 0.65);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(40, divY, WIDTH - 80, 1);

    drawPixelText(ctx, 'TAP / Z - CONTINUE', cx(19), 385, '#ffffff', 1);
    drawPixelText(ctx, 'TAP LOWER / X - TITLE', cx(22), 410, '#aaaaaa', 1);
  }
}
