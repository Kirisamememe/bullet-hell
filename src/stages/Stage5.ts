import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { SpiralShot } from '../patterns/SpiralShot';
import { WaveShot } from '../patterns/WaveShot';
import { LaserShot } from '../patterns/LaserShot';
import { BulletType } from '../entities/types';

export class Stage5 extends Stage {
  readonly stageNumber = 5;
  readonly stageName = 'DANMA RENGO';
  readonly themeColor = '#220011';
  private boss: Enemy | null = null;
  private bossSpawned = false;
  private wave1Spawned = false;
  private wave2Spawned = false;
  private wave3Spawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Pre-boss gauntlet: mixed dense waves
    if (this.timer >= 800 && !this.wave1Spawned) {
      this.wave1Spawned = true;
      for (let i = 0; i < 3; i++) {
        const enemy = new Enemy(60 + i * 120, -20, 24, 24, 20, 800);
        enemy.setMovePath([{ x: 60 + i * 120, y: -20 }, { x: 60 + i * 120, y: 90 }]);
        enemy.driftRange = 30;
        enemy.driftSpeed = 12;
        enemy.patterns = [new SpiralShot(70, 3, 4000), new AimedShot(900, 4, 3)];
        this.enemies.push(enemy);
      }
    }

    if (this.timer >= 4000 && !this.wave2Spawned) {
      this.wave2Spawned = true;
      for (let i = 0; i < 4; i++) {
        const enemy = new Enemy(30 + i * 95, -20, 20, 20, 15, 600);
        enemy.setMovePath([{ x: 30 + i * 95, y: -20 }, { x: 30 + i * 95, y: 100 }]);
        enemy.driftRange = 20;
        enemy.driftSpeed = 12;
        enemy.patterns = [new WaveShot(90, 3.5, 4000), new CircleShot(2500, 3, 24)];
        this.enemies.push(enemy);
      }
    }

    if (this.timer >= 8000 && !this.wave3Spawned) {
      this.wave3Spawned = true;
      const laserEnemy = new Enemy(120, -20, 40, 40, 50, 2000);
      laserEnemy.setMovePath([{ x: 120, y: -20 }, { x: 120, y: 70 }]);
      laserEnemy.driftRange = 45;
      laserEnemy.driftSpeed = 12;
      laserEnemy.patterns = [new LaserShot(1200, 3000), new SpiralShot(50, 4, 4000)];
      this.enemies.push(laserEnemy);
    }

    // Final Boss — 5 phases
    if (this.timer >= 14000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(100, -80, 160, 80, 800, 50000, true, false);
      this.boss.setMovePath([{ x: 100, y: -80 }, { x: 100, y: 30 }]);
      this.boss.driftRange = 70;
      this.boss.driftSpeed = 8;
      this.boss.palette = {
        dark: '#3a2400', mid: '#cc8800', light: '#ffe066', core: '#ffffff', glow: '#ffcc00',
      };
      this.boss.patterns = [
        new AimedShot(300, 5, Infinity),
        new CircleShot(1500, 4, 60),
        new SpiralShot(40, 4, Infinity),
        new WaveShot(60, 4, Infinity),
        new LaserShot(2000, 2000),
        new AimedShot(200, 6, Infinity, BulletType.Fast),
        new CircleShot(3000, 3.5, 72),
      ];
      this.enemies.push(this.boss);
    }

    if (this.boss && !this.boss.active) {
      this.isComplete = true;
      this.isBossActive = false;
    }

    // Phase transitions for final boss
    if (this.boss && this.boss.active && this.boss.checkPhase()) {
      if (this.boss.phase >= 3) {
        const hasExtraSpiral = this.boss.patterns.some(
          (p, i) => p instanceof SpiralShot && i > 2
        );
        if (!hasExtraSpiral) {
          this.boss.patterns.push(new SpiralShot(30, 5, Infinity));
        }
      }
      if (this.boss.phase >= 4) {
        this.boss.patterns.push(new LaserShot(1500, 3000));
      }
      if (this.boss.phase >= 5) {
        this.boss.patterns.push(new CircleShot(1000, 5, 90, BulletType.Fast));
      }
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
