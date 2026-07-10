import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { WaveShot } from '../patterns/WaveShot';

export class Stage2 extends Stage {
  readonly stageNumber = 2;
  readonly stageName = 'STARLIT PATH';
  readonly themeColor = '#111155';

  private boss: Enemy | null = null;
  private bossSpawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1 (1s): 4 mooks from sides
    if (this.timer >= 1000 && this.enemies.length === 0) {
      for (let i = 0; i < 4; i++) {
        const ex = i < 2 ? -20 : 380;
        const enemy = new Enemy(ex, 60 + i * 60, 20, 20, 4, 200);
        enemy.setMovePath([{ x: ex, y: 60 + i * 60 }, { x: 180, y: 120 }, { x: ex, y: 60 + i * 60 }]);
        enemy.patterns = [new AimedShot(1800, 2.5, 1)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2: Wave-shot mooks
    if (this.timer >= 4000 && this.timer < 4500 && this.enemies.filter(e => !e.isBoss && !e.isMidBoss).length < 2) {
      for (let i = 0; i < 3; i++) {
        const enemy = new Enemy(100 + i * 80, -20, 20, 20, 5, 300);
        enemy.setMovePath([{ x: 100 + i * 80, y: -20 }, { x: 100 + i * 80, y: 90 }]);
        enemy.patterns = [new WaveShot(120, 2, 4000)];
        this.enemies.push(enemy);
      }
    }

    // Wave 3: More aimed shots
    if (this.timer >= 8000 && this.timer < 8500 && this.enemies.filter(e => !e.isBoss && !e.isMidBoss).length < 2) {
      for (let i = 0; i < 5; i++) {
        const enemy = new Enemy(30 + i * 70, -20, 20, 20, 5, 300);
        enemy.setMovePath([{ x: 30 + i * 70, y: -20 }, { x: 30 + i * 70, y: 110 }]);
        enemy.patterns = [new AimedShot(1200, 3, 2)];
        this.enemies.push(enemy);
      }
    }

    // Mid-boss
    if (this.timer >= 12000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(130, -50, 100, 50, 150, 15000, false, true);
      this.boss.setMovePath([{ x: 130, y: -50 }, { x: 130, y: 50 }]);
      this.boss.patterns = [
        new AimedShot(500, 3.5, Infinity),
        new CircleShot(2500, 2.5, 30),
        new WaveShot(100, 2.5, 4000),
      ];
      this.enemies.push(this.boss);
    }

    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    for (const enemy of this.enemies) {
      enemy.update(dt);
      this.enemyBullets.push(...enemy.getBullets(dt, player.cx, player.cy));
    }
    for (const bullet of this.enemyBullets) bullet.update(dt);
    for (const bullet of this.playerBullets) bullet.update(dt);
    this.cleanup();
  }
}
