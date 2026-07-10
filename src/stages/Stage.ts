import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Player } from '../entities/Player';

export abstract class Stage {
  abstract readonly stageNumber: number;
  abstract readonly stageName: string;
  abstract readonly themeColor: string;

  enemies: Enemy[] = [];
  enemyBullets: Bullet[] = [];
  playerBullets: Bullet[] = [];
  isComplete = false;
  isBossActive = false;
  protected timer = 0;

  abstract update(dt: number, player: Player): void;

  /** Clean up inactive entities */
  protected cleanup(): void {
    this.enemies = this.enemies.filter(e => e.active);
    this.enemyBullets = this.enemyBullets.filter(b => b.active);
    this.playerBullets = this.playerBullets.filter(b => b.active);
  }
}
