export type EnemyType = 'normal' | 'fast' | 'fat' | 'spitter' | 'armored' | 'exploder' | 'chick' | 'boss' | 'jumper';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  attackRange: number;
  attackCd: number;
  windup: number;        // seconds before a melee hit lands
  armor: number;         // bullet damage reduction 0..1 (explosions/fire ignore half)
  mass: number;          // knockback divisor
  sight: number;
  score: number;
  sprite: string[];      // sprite variants (frame prefixes)
  scale: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  normal: {
    type: 'normal', name: 'Офисный кур', hp: 48, speed: 118, radius: 16, damage: 10, attackRange: 34, attackCd: 0.85, windup: 0.22,
    armor: 0, mass: 1, sight: 640, score: 10, sprite: ['ck_normal_a', 'ck_normal_b', 'ck_normal_c'], scale: 1,
  },
  fast: {
    type: 'fast', name: 'Стажёр', hp: 24, speed: 215, radius: 13, damage: 6, attackRange: 30, attackCd: 0.55, windup: 0.12,
    armor: 0, mass: 0.7, sight: 760, score: 12, sprite: ['ck_fast'], scale: 1,
  },
  fat: {
    type: 'fat', name: 'Менеджер среднего звена', hp: 260, speed: 72, radius: 26, damage: 24, attackRange: 46, attackCd: 1.3, windup: 0.4,
    armor: 0, mass: 4, sight: 600, score: 40, sprite: ['ck_fat'], scale: 1,
  },
  spitter: {
    type: 'spitter', name: 'Бухгалтер-плевун', hp: 55, speed: 100, radius: 16, damage: 12, attackRange: 430, attackCd: 1.7, windup: 0.35,
    armor: 0, mass: 1, sight: 700, score: 20, sprite: ['ck_spitter'], scale: 1,
  },
  armored: {
    type: 'armored', name: 'Охранник', hp: 170, speed: 92, radius: 19, damage: 18, attackRange: 38, attackCd: 1.0, windup: 0.3,
    armor: 0.55, mass: 3, sight: 640, score: 35, sprite: ['ck_armored'], scale: 1,
  },
  exploder: {
    type: 'exploder', name: 'Химик', hp: 46, speed: 150, radius: 18, damage: 70, attackRange: 70, attackCd: 99, windup: 0.6,
    armor: 0, mass: 1.5, sight: 700, score: 25, sprite: ['ck_exploder'], scale: 1,
  },
  chick: {
    type: 'chick', name: 'Цыплёнок', hp: 14, speed: 235, radius: 11, damage: 5, attackRange: 26, attackCd: 0.5, windup: 0.1,
    armor: 0, mass: 0.5, sight: 800, score: 4, sprite: ['ck_fast'], scale: 0.7,
  },
  // D71: the street «прыгун» — tougher and quicker than an office chicken, closes the distance with a leap
  jumper: {
    type: 'jumper', name: 'Прыгун-курьер', hp: 95, speed: 175, radius: 16, damage: 14, attackRange: 34, attackCd: 0.8, windup: 0.18,
    armor: 0, mass: 1.3, sight: 760, score: 30, sprite: ['ck_fast'], scale: 1,
  },
  boss: {
    type: 'boss', name: 'Генеральный Петух', hp: 9000, speed: 95, radius: 62, damage: 35, attackRange: 110, attackCd: 1.4, windup: 0.5,
    armor: 0, mass: 40, sight: 2000, score: 1000, sprite: ['boss'], scale: 1,
  },
};

export const PLAYER = {
  hp: 100,
  speed: 245,
  radius: 15,
  reviveTime: 2.6,
  bleedout: 18,
  chickenHp: 190,
  chickenSpeed: 285,
  chickenRespawn: 4,
};
