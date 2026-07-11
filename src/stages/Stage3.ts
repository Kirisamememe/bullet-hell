import { Stage } from './Stage';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { AimedShot } from '../patterns/AimedShot';
import { CircleShot } from '../patterns/CircleShot';
import { WaveShot } from '../patterns/WaveShot';
import { SpiralShot } from '../patterns/SpiralShot';

export class Stage3 extends Stage {
  readonly stageNumber = 3;
  readonly stageName = 'CRIMSON SKY';
  readonly themeColor = '#221111';
  private boss: Enemy | null = null;
  private bossSpawned = false;
  private wave2Spawned = false;
  private wave3Spawned = false;

  update(dt: number, player: Player): void {
    this.timer += dt;

    // Wave 1: Mooks with aimed shots
    if (this.timer >= 1000 && this.enemies.length === 0) {
      for (let i = 0; i < 6; i++) {
        const enemy = new Enemy(30 + i * 55, -30, 18, 18, 6, 400);
        enemy.setMovePath([{ x: 30 + i * 55, y: -30 }, { x: 30 + i * 55, y: 100 }]);
        enemy.driftRange = 25;
        enemy.driftSpeed = 9;
        enemy.patterns = [new AimedShot(1400, 3, 2)];
        this.enemies.push(enemy);
      }
    }

    // Wave 2: Wave + Spiral combination
    if (this.timer >= 4000 && !this.wave2Spawned) {
      this.wave2Spawned = true;
      const e1 = new Enemy(140, -20, 24, 24, 20, 800);
      e1.setMovePath([{ x: 140, y: -20 }, { x: 140, y: 80 }]);
      e1.driftRange = 35;
      e1.driftSpeed = 12;
      e1.patterns = [new SpiralShot(80, 2.5, 4000), new WaveShot(150, 2, 4000)];
      this.enemies.push(e1);
    }

    // Wave 3: Dense wave
    if (this.timer >= 8000 && !this.wave3Spawned) {
      this.wave3Spawned = true;
      for (let i = 0; i < 4; i++) {
        const enemy = new Enemy(50 + i * 80, -20, 20, 20, 6, 400);
        enemy.setMovePath([{ x: 50 + i * 80, y: -20 }, { x: 50 + i * 80, y: 100 }]);
        enemy.driftRange = 20;
        enemy.driftSpeed = 12;
        enemy.patterns = [new AimedShot(1000, 3.5, 2)];
        this.enemies.push(enemy);
      }
    }

    // Mid-boss
    if (this.timer >= 12000 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.isBossActive = true;
      this.boss = new Enemy(120, -60, 120, 60, 250, 20000, false, true);
      this.boss.setMovePath([{ x: 120, y: -60 }, { x: 120, y: 50 }]);
      this.boss.driftRange = 70;
      this.boss.driftSpeed = 18;
      this.boss.palette = {
        dark: '#3a0510', mid: '#a5122f', light: '#ff5577', core: '#ffe0e8', glow: '#ff2255',
      };
      this.boss.patterns = [
        new AimedShot(400, 4, Infinity),
        new CircleShot(2000, 3, 40),
        new SpiralShot(60, 3, 5000),
        new WaveShot(80, 3, 5000),
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
