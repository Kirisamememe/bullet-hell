import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';

export class Stage1 extends Stage {
  readonly stageNumber = 1;
  readonly stageName = 'FIRST CONTACT';
  readonly themeColor = '#111144';
  private firstWaveSpawned = false;
  private secondWaveSpawned = false;
  private bossSpawned = false;
  private boss: Enemy | null = null;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1: Simple mooks at 1 second
    if (this.timer >= 1000 && !this.firstWaveSpawned) {
      this.firstWaveSpawned = true;
      for (let i = 0; i < 3; i++) {
        const enemy = new Enemy(60 + i * 100, -20, 20, 20, 2, 100);
        enemy.setMovePath([
          { x: 60 + i * 100, y: -20 },
          { x: 60 + i * 100, y: 80 },
          { x: 60 + i * 100, y: -20 },
        ]);
        enemy.patterns = [new AimedShot(2000, 2, 1)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2: More mooks at 5 seconds
    if (this.timer >= 5000 && !this.secondWaveSpawned) {
      this.secondWaveSpawned = true;
      for (let i = 0; i < 5; i++) {
        const enemy = new Enemy(40 + i * 70, -30, 18, 18, 3, 200);
        enemy.setMovePath([
          { x: 40 + i * 70, y: -30 },
          { x: 40 + i * 70, y: 100 },
          { x: 40 + i * 70, y: -30 },
        ]);
        if (i % 2 === 0) {
          enemy.patterns = [new AimedShot(1500, 2.5, 1)];
        }
        this.enemies.push(enemy);
      }
    }

    // Mid-boss at 10 seconds
    if (this.timer >= 10000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(140, -40, 80, 40, 80, 10000, false, true);
      this.boss.setMovePath([
        { x: 140, y: -40 },
        { x: 140, y: 60 },
      ]);
      this.boss.patterns = [
        new AimedShot(600, 3, Infinity),
        new CircleShot(3000, 2, 24),
      ];
      this.enemies.push(this.boss);
    }

    // Stage complete when mid-boss is dead
    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    // Update enemies and collect their bullets
    for (const enemy of this.enemies) {
      enemy.update(dt);
      this.enemyBullets.push(...enemy.getBullets(dt, player.cx, player.cy));
    }

    // Update bullets
    for (const bullet of this.enemyBullets) bullet.update(dt);
    for (const bullet of this.playerBullets) bullet.update(dt);

    this.cleanup();
  }
}
