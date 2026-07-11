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
  private wave1Spawned = false;
  private wave2Spawned = false;
  private wave3Spawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1 (1s): 4 mooks
    if (this.timer >= 1000 && !this.wave1Spawned) {
      this.wave1Spawned = true;
      for (let i = 0; i < 4; i++) {
        const enemy = new Enemy(50 + i * 80, -20, 20, 20, 4, 200);
        enemy.setMovePath([{ x: 50 + i * 80, y: -20 }, { x: 50 + i * 80, y: 100 }]);
        enemy.driftRange = 25;
        enemy.driftSpeed = 9;
        enemy.patterns = [new AimedShot(1800, 2.5, 1)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2 (4s): Wave-shot mooks
    if (this.timer >= 4000 && !this.wave2Spawned) {
      this.wave2Spawned = true;
      for (let i = 0; i < 3; i++) {
        const enemy = new Enemy(100 + i * 80, -20, 20, 20, 5, 300);
        enemy.setMovePath([{ x: 100 + i * 80, y: -20 }, { x: 100 + i * 80, y: 90 }]);
        enemy.driftRange = 20;
        enemy.driftSpeed = 9;
        enemy.patterns = [new WaveShot(120, 2, 4000)];
        this.enemies.push(enemy);
      }
    }

    // Wave 3 (8s): More aimed shots
    if (this.timer >= 8000 && !this.wave3Spawned) {
      this.wave3Spawned = true;
      for (let i = 0; i < 5; i++) {
        const enemy = new Enemy(30 + i * 70, -20, 20, 20, 5, 300);
        enemy.setMovePath([{ x: 30 + i * 70, y: -20 }, { x: 30 + i * 70, y: 110 }]);
        enemy.driftRange = 25;
        enemy.driftSpeed = 12;
        enemy.patterns = [new AimedShot(1200, 3, 2)];
        this.enemies.push(enemy);
      }
    }

    // Mid-boss (12s)
    if (this.timer >= 12000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(130, -50, 100, 50, 150, 15000, false, true);
      this.boss.setMovePath([{ x: 130, y: -50 }, { x: 130, y: 50 }]);
      this.boss.driftRange = 70;
      this.boss.driftSpeed = 18;
      this.boss.palette = {
        dark: '#0d2a4a', mid: '#1f6fbf', light: '#7fd4ff', core: '#eaffff', glow: '#33aaff',
      };
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
