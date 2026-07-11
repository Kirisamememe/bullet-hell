import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { SpiralShot } from '../patterns/SpiralShot';
import { WaveShot } from '../patterns/WaveShot';
import { LaserShot } from '../patterns/LaserShot';

export class Stage4 extends Stage {
  readonly stageNumber = 4;
  readonly stageName = 'ABYSSAL FLAME';
  readonly themeColor = '#221122';
  private boss: Enemy | null = null;
  private bossSpawned = false;
  private wave2Spawned = false;
  private wave3Spawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1: 8 fast mooks
    if (this.timer >= 1000 && this.enemies.length === 0) {
      for (let i = 0; i < 8; i++) {
        const enemy = new Enemy(20 + i * 42, -30, 16, 16, 7, 500);
        enemy.setMovePath([{ x: 20 + i * 42, y: -30 }, { x: 20 + i * 42, y: 100 }]);
        enemy.driftRange = 20;
        enemy.driftSpeed = 9;
        enemy.patterns = [new AimedShot(1200, 3.5, 2)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2: Spiral enemies
    if (this.timer >= 4000 && !this.wave2Spawned) {
      this.wave2Spawned = true;
      for (let i = 0; i < 2; i++) {
        const enemy = new Enemy(100 + i * 160, -20, 28, 28, 30, 1000);
        enemy.setMovePath([{ x: 100 + i * 160, y: -20 }, { x: 100 + i * 160, y: 80 }]);
        enemy.driftRange = 35;
        enemy.driftSpeed = 12;
        enemy.patterns = [new SpiralShot(60, 3, 5000), new AimedShot(800, 3.5, 3)];
        this.enemies.push(enemy);
      }
    }

    // Wave 3: Laser enemies
    if (this.timer >= 8000 && !this.wave3Spawned) {
      this.wave3Spawned = true;
      const laserEnemy = new Enemy(140, -20, 30, 30, 40, 1200);
      laserEnemy.setMovePath([{ x: 140, y: -20 }, { x: 140, y: 70 }]);
      laserEnemy.driftRange = 45;
      laserEnemy.driftSpeed = 12;
      laserEnemy.patterns = [new LaserShot(1500, 2500), new WaveShot(100, 3, 4000)];
      this.enemies.push(laserEnemy);
    }

    // Mid-boss
    if (this.timer >= 13000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(110, -70, 140, 70, 400, 30000, false, true);
      this.boss.setMovePath([{ x: 110, y: -70 }, { x: 110, y: 40 }]);
      this.boss.driftRange = 80;
      this.boss.driftSpeed = 21;
      this.boss.palette = {
        dark: '#2a0a3a', mid: '#7a1fb0', light: '#e070ff', core: '#fbe0ff', glow: '#cc33ff',
      };
      this.boss.patterns = [
        new AimedShot(350, 4.5, Infinity),
        new CircleShot(1800, 3.5, 48),
        new SpiralShot(50, 3.5, 6000),
        new WaveShot(70, 3.5, 6000),
        new LaserShot(2000, 2000),
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
