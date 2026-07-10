export enum BulletType {
  Normal = 'normal',
  Odd = 'odd',
  Laser = 'laser',
  Fast = 'fast',
}

export const BULLET_COLORS: Record<BulletType, string> = {
  [BulletType.Normal]: '#ff4444',
  [BulletType.Odd]: '#4488ff',
  [BulletType.Laser]: '#cc44ff',
  [BulletType.Fast]: '#ffcc00',
};

export const BULLET_RADII: Record<BulletType, number> = {
  [BulletType.Normal]: 3,
  [BulletType.Odd]: 4,
  [BulletType.Laser]: 5,
  [BulletType.Fast]: 3,
};
