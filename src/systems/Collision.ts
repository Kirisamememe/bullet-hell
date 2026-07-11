import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';

/**
 * Player hitbox: 1px point at center.
 * Bullet hitbox: circle with bullet.radius.
 */
export function isPlayerHitByBullet(player: Player, bullet: Bullet): boolean {
  if (!bullet.active || bullet.friendly) return false; // friendly bullets don't hit player
  if (player.invincible) return false;

  const dx = player.cx - bullet.cx;
  const dy = player.cy - bullet.cy;
  const dist = dx * dx + dy * dy; // squared distance
  const hitRadius = bullet.radius;
  return dist <= hitRadius * hitRadius;
}

/**
 * Enemy hitbox: rectangle overlap with bullet circle.
 * Simplified: check bullet center vs enemy rect.
 */
export function isEnemyHitByBullet(enemy: Enemy, bullet: Bullet): boolean {
  if (!bullet.active || !bullet.friendly) return false;
  if (!enemy.active) return false;

  // Circle vs rect: find closest point on rect to circle center
  const cx = Math.max(enemy.x, Math.min(bullet.cx, enemy.x + enemy.width));
  const cy = Math.max(enemy.y, Math.min(bullet.cy, enemy.y + enemy.height));
  const dx = bullet.cx - cx;
  const dy = bullet.cy - cy;
  const dist = dx * dx + dy * dy;
  return dist <= bullet.radius * bullet.radius;
}

/**
 * Check all enemy bullets against player. Returns true if player was hit.
 */
export function checkPlayerCollisions(
  player: Player,
  enemyBullets: Bullet[]
): boolean {
  for (const bullet of enemyBullets) {
    if (isPlayerHitByBullet(player, bullet)) {
      bullet.active = false;
      return true;
    }
  }
  return false;
}

/**
 * Check all player bullets against all enemies. Returns enemies that were destroyed.
 * Sets bullet.active = false on hit.
 */
export function checkEnemyCollisions(
  enemies: Enemy[],
  playerBullets: Bullet[],
  onHit?: (x: number, y: number, enemy: Enemy) => void
): Enemy[] {
  const destroyed: Enemy[] = [];
  for (const bullet of playerBullets) {
    if (!bullet.active) continue;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (isEnemyHitByBullet(enemy, bullet)) {
        const hitX = bullet.cx, hitY = bullet.cy;
        bullet.active = false;
        const dead = enemy.takeDamage(bullet.damage);
        onHit?.(hitX, hitY, enemy);
        if (dead) {
          destroyed.push(enemy);
        }
        break; // bullet hits only one enemy
      }
    }
  }
  return destroyed;
}

/**
 * Check if bullet grazed the player (passed within grazeRadius of player hitbox).
 */
export function checkGraze(player: Player, bullet: Bullet, grazeRadius = 15): boolean {
  if (!bullet.active || bullet.friendly) return false;
  const dx = player.cx - bullet.cx;
  const dy = player.cy - bullet.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist <= grazeRadius;
}
