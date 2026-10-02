import type { World } from '../sim/World';
import type { Enemy, Npc, Pickup, Player } from '../sim/types';
import type { WeaponId } from '../weapons';
import type { AchievementKey } from '../achievements';

/** Level logic. Hooks run inside the authoritative simulation (browser solo or Colyseus room). */
export interface LevelScript {
  /** Called once when an NPC dies or finishes mutating; mandatory items must survive. */
  onNpcLost?: (w: World, n: Npc) => void;
  id: string;            // also the map file name (public/assets/maps/<id>.tmj)
  title: string;
  subtitle: string;
  next?: string;
  startWeapons?: WeaponId[];
  /** Per-level balance: multipliers for enemy HP and the damage enemies deal (default 1). */
  enemyHp?: number;
  enemyDamage?: number;
  music?: string;
  /** D69: first floor of a chapter: «Глава 2. Город» above the title card. */
  chapter?: string;
  /** D69: last floor of a chapter: a chapter-complete panel and an achievement for everyone. */
  chapterEnd?: { title: string; text: string; award?: AchievementKey };
  onStart?(w: World): void;
  onTick?(w: World, dt: number): void;
  onTrigger?(w: World, id: string, by: Player): void;
  onUse?(w: World, id: string, by: Player): void;
  onKill?(w: World, e: Enemy, tag: string | undefined): void;
  onPickup?(w: World, k: Pickup, by: Player): void;
  onRescue?(w: World, n: Npc, by: Player): void;
  onNpcUse?(w: World, n: Npc, by: Player): boolean | void;
  onNpcArrive?(w: World, n: Npc): void;
  onNpcDead?(w: World, n: Npc): void;
  onBossPhase?(w: World, e: Enemy, phase: number): void;
  onBossDead?(w: World, e: Enemy): void;
}
