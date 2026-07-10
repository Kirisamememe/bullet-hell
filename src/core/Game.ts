import { CanvasManager, WIDTH, HEIGHT } from './Canvas';
import { Input } from './Input';
import { Player } from '../entities/Player';
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

  // Stage intro / clear timers
  private transitionTimer = 0;
  private stageClearTimer = 0;

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
    this.scene = Scene.StageIntro;
    this.transitionTimer = 2000;
  }

  update(dt: number): void {
    const pausePressed = this.input.consumePause();
    if (pausePressed) {
      if (this.scene === Scene.Playing) {
        this.scene = Scene.Paused;
        return;
      } else if (this.scene === Scene.Paused) {
        this.scene = Scene.Playing;
        return;
      }
    }

    switch (this.scene) {
      case Scene.Title:
        this.titleScreen.update(dt);
        if (this.input.state.shot) {
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
          if (this.input.state.shot) {
            this.lives = 3;
            this.bombs = 3;
            this.power = 1;
            this.continueCount++;
            this.startStage(this.currentStage);
          }
          if (this.input.state.bomb) {
            this.saveHiScore();
            this.scene = Scene.Title;
          }
        }
        break;
    }
  }

  private updatePlaying(dt: number): void {
    // Background
    this.background.update(dt);
    this.particles.update(dt);

    // Player input
    this.player.handleInput(this.input.state);

    // Player shooting
    if (this.input.state.shot || this.input.state.touchActive) {
      const newBullets = this.player.shoot(dt);
      this.currentStageInstance.playerBullets.push(...newBullets);
    } else {
      this.player.shootTimer = 0;
    }

    // Bomb
    if (this.input.consumeBomb() && this.bombs > 0) {
      this.bombs--;
      this.player.useBomb();
      for (const b of this.currentStageInstance.enemyBullets) {
        b.active = false;
      }
      this.particles.emit(180, 320, 30, '#ffffff', 6, 600);
    }

    // Update player
    this.player.update(dt);

    // Update stage
    this.currentStageInstance.update(dt, this.player);

    // Collision: player vs enemy bullets
    if (checkPlayerCollisions(this.player, this.currentStageInstance.enemyBullets)) {
      if (this.player.hit()) {
        this.lives--;
        this.particles.emit(this.player.cx, this.player.cy, 12, '#ff4444', 3, 500);
        if (this.lives < 0) {
          this.lives = 0;
          this.saveHiScore();
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
      }
    }

    // Collision: player bullets vs enemies
    const destroyed = checkEnemyCollisions(
      this.currentStageInstance.enemies,
      this.currentStageInstance.playerBullets
    );
    for (const enemy of destroyed) {
      this.score += enemy.scoreValue;
      this.particles.emit(enemy.cx, enemy.cy, enemy.isBoss ? 20 : 8,
        enemy.isBoss ? '#ff6644' : '#ffaa44', enemy.isBoss ? 4 : 2);
      if (enemy.dropPowerItem && this.power < 5) {
        this.power++;
      }
    }

    // Stage complete
    if (this.currentStageInstance.isComplete) {
      this.score += this.bombs * 5000;
      this.score += this.lives * 10000;
      this.saveHiScore();
      this.scene = Scene.StageClear;
      this.stageClearTimer = 3000;
    }

    // Sync player power with game
    this.power = this.player.power;

    // HUD
    this.hud.update(dt);
  }

  render(): void {
    const ctx = this.canvas.offscreenCtx;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    switch (this.scene) {
      case Scene.Title:
        this.titleScreen.render(ctx);
        break;

      case Scene.StageIntro:
        this.renderStageIntro(ctx);
        break;

      case Scene.Playing:
      case Scene.Paused:
        this.renderPlaying(ctx);
        if (this.scene === Scene.Paused) {
          this.renderPauseOverlay(ctx);
        }
        break;

      case Scene.StageClear:
        this.renderPlaying(ctx);
        this.renderStageClearOverlay(ctx);
        break;

      case Scene.GameOver:
        this.renderGameOver(ctx);
        break;
    }

    this.canvas.flip();
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

    drawPixelText(ctx, 'Z - CONTINUE', cx(12), 395, '#ffffff', 1);
    drawPixelText(ctx, 'X - TITLE', cx(9), 420, '#ffffff', 1);
  }
}
