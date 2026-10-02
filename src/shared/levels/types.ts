import type { World } from '../sim/World';
import type { Enemy, Npc, Pickup, Player } from '../sim/types';
import type { WeaponId } from '../weapons';

/** Level logic. Hooks run inside the authoritative simulation (browser solo or Colyseus room). */
export interface LevelScript {
  id: string;            // also the map file name (public/assets/maps/<id>.tmj)
  title: string;
  subtitle: string;
  next?: string;
  startWeapons?: WeaponId[];
  music?: string;
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
