import type { EnemyType } from '../enemies';
import type { WeaponId } from '../weapons';

export type Team = 'human' | 'chicken';

export interface PlayerInput {
  seq: number;
  x: number; y: number;   // client-predicted position
  aim: number;
  fire: boolean;
  reload: boolean;
  interact: boolean;
  weapon: number;         // desired weapon index
}

export type PlayerState = 'alive' | 'downed' | 'chicken' | 'dead';

export interface AmmoState { mag: number; reserve: number }

export interface Supplies { medkit: number; ammo: number }
export interface SupportAction {
  target: string; kind: 'revive' | 'heal' | 'ammo';
  elapsed: number; progress: number; anchorX: number; anchorY: number;
  cancelled: boolean; completed: boolean;
  targetVersion: number;
}
export interface Mutation {
  stage: 'twitch' | 'feathers' | 'silhouette'; elapsed: number;
  type: EnemyType; tag: string;
}
/** Mutation timeline (s): twitch → feathers → silhouette → hostile. Readable on purpose (D34). */
export const MUTATION = { feathers: 1.0, silhouette: 2.0, done: 3.0 };
export interface BetrayalPlan { checked: boolean; remaining: number; helped: number }
/** Feet remain in the existing collision plane; artwork grows upwards from them. */
export interface VisualAnchor { feetX: number; feetY: number; weaponY: number }

export interface Player {
  id: string;
  slot: number;
  name: string;
  look: string;            // encoded appearance (shared/look.ts); '' = slot default
  x: number; y: number; aim: number;
  vx: number; vy: number;
  hp: number; maxHp: number; armor: number;
  state: PlayerState;
  downT: number;          // bleed-out timer
  reviveT: number;        // revive progress 0..1
  respawnT: number;       // chicken respawn countdown
  /** D59: returned to a dead character mid-floor — spectates until the next floor (no rally). */
  benched?: boolean;
  weapons: WeaponId[];
  cur: number;
  ammo: Partial<Record<WeaponId, AmmoState>>;
  reloadT: number;
  fireCd: number;
  bloom: number;
  firing: boolean;        // trigger held & able to fire this tick (for flame visuals)
  shotSeq: number;
  input: PlayerInput;
  kills: number; deaths: number; score: number;
  hurtT: number;
  keys: string[];
  buffs?: Partial<Record<BuffKind, number>>;
  achievements?: string[];
  combo: number; comboT: number;
  connected: boolean;
  supplies: Supplies;
  support: SupportAction | null;
  supportVersion: number;
  tp: number;             // teleport counter (client resets prediction when it changes)
  saved?: { weapons: WeaponId[]; ammo: Partial<Record<WeaponId, AmmoState>> };
}

export type EnemyState = 'idle' | 'chase' | 'windup' | 'fuse' | 'charge' | 'rise';

export interface Enemy {
  id: number;
  type: EnemyType;
  variant: number;
  x: number; y: number; angle: number;
  vx: number; vy: number;     // knockback velocity
  hp: number; maxHp: number;
  state: EnemyState;
  t: number;                  // state timer
  cd: number;                 // attack cooldown
  aggro: boolean;
  target: string | null;      // human entity id
  speedMul: number;
  burnT: number;
  stunT: number;
  flashT: number;
  wanderA: number;
  // boss
  phase: number;
  abilityCd: number;
  ability: string;
  dormant: boolean;           // ignores sight until damaged / woken by script or noise
  appearance?: { npcId: string; kind: string; name: string };
}

export type NpcMode = 'idle' | 'cower' | 'follow' | 'guard' | 'flee' | 'goto' | 'dead' | 'gone';

export interface Npc {
  id: string;
  kind: string;               // Kenney character key
  name: string;
  x: number; y: number; angle: number;
  hp: number; maxHp: number;
  mode: NpcMode;
  weapon: WeaponId | null;
  fireCd: number;
  follow: string | null;      // player id
  followMoving?: boolean;
  goal: { x: number; y: number } | null;
  lines: string[];
  talkCd: number;
  tag: string;                // script tag
  rescued: boolean;
  vx: number; vy: number;
  hurtT: number;
  mutation?: Mutation;
  betrayal?: BetrayalPlan;
  props?: Record<string, any>;  // raw Tiled properties (server only)
}

export type ProjKind = 'grenade' | 'spit' | 'egg';

export interface Projectile {
  id: number;
  kind: ProjKind;
  x: number; y: number; vx: number; vy: number;
  ttl: number;
  owner: string;
  team: Team;
  dmg: number;
  r: number;
}

export const BUFFS = {
  invincible: { name: 'Непробиваемый сотрудник', label: 'Бессмертие', icon: '✦', color: 0xffd65c },
  damage: { name: 'Ультраурон ×3', label: 'Ультраурон', icon: '×3', color: 0xff7568 },
  infinite: { name: 'Бесконечные патроны', label: 'Патроны', icon: '∞', color: 0x78baff },
  sprint: { name: 'Бег ×1.6', label: 'Бег ×1.6', icon: '»', color: 0x8dffbd },
} as const;
export type BuffKind = keyof typeof BUFFS;
export const BUFF_SECONDS = 10;
export type PickupKind = 'ammo' | 'health' | 'armor' | 'weapon' | 'keycard' | 'antidote' | BuffKind | 'achievement';
export interface Pickup { id: number; kind: PickupKind; weapon?: WeaponId; key?: string; x: number; y: number; ttl: number }

export interface Door { id: string; x: number; y: number; w: number; h: number; open: boolean; locked: string; theme: string }
export interface Barrel { id: number; x: number; y: number; hp: number }
export interface Pod { id: number; x: number; y: number; hp: number; broken: boolean; tag: string; hatch: string }

export type HitKind = 'flesh' | 'wall' | 'armor' | 'prop' | 'player' | 'npc';

export type SimEvent =
  | { e: 'achievement'; id: string; key: string }
  | { e: 'notice'; tone: 'danger' | 'reward' | 'tip'; text: string; sub: string }
  | { e: 'shot'; o: string; w: WeaponId; x: number; y: number; a: number; ends: number[]; team: Team }
  | { e: 'hit'; x: number; y: number; a: number; k: HitKind; d: number; id?: number | string; big?: boolean; o?: string; hs?: boolean }
  | { e: 'kill'; id: number; x: number; y: number; a: number; t: EnemyType; v: number; gib: boolean; by: string; burn: boolean; hs?: boolean }
  | { e: 'boom'; x: number; y: number; r: number; k: 'gl' | 'barrel' | 'exploder' | 'boss' }
  | { e: 'proj'; id: number; k: ProjKind; x: number; y: number; vx: number; vy: number }
  | { e: 'splat'; x: number; y: number; k: ProjKind }
  | { e: 'say'; who: string; text: string; d: number; flavor?: boolean }
  | { e: 'pdmg'; id: string; d: number; x: number; y: number }
  | { e: 'pick'; id: string; k: PickupKind; w?: WeaponId; text: string }
  | { e: 'reload'; id: string; w: WeaponId }
  | { e: 'down'; id: string }
  | { e: 'revived'; id: string; by: string }
  | { e: 'help'; id: string; by: string; kind: 'heal' | 'ammo' }
  | { e: 'mutation'; id: string; x: number; y: number; stage: Mutation['stage'] | 'complete' }
  | { e: 'chicken'; id: string }
  | { e: 'cured'; id: string }
  | { e: 'npcdie'; id: string; x: number; y: number }
  | { e: 'door'; id: string; open: boolean }
  | { e: 'msg'; text: string; sub?: string; d?: number }
  | { e: 'obj'; text: string }
  | { e: 'spawn'; id: number; x: number; y: number; how: 'egg' | 'vent' | 'rise' }
  | { e: 'blackout'; on: boolean }
  | { e: 'alarm'; on: boolean }
  | { e: 'shake'; s: number }
  | { e: 'swing'; id: number; x: number; y: number; a: number }
  | { e: 'level'; next: string; win?: boolean }
  | { e: 'gameover'; reason: string }
  | { e: 'fuse'; id: number }
  | { e: 'propbreak'; id: number; x: number; y: number; m: string };

/** Render-facing view of the world (identical for local sim and network snapshots). */
export interface WorldView {
  incidents?: IncidentView[];
  /** D57 floor bonus goal (null on floors without one). */
  bonus?: import('./Bonus').BonusView | null;
  mapId: string;
  time: number;
  players: Player[];
  enemies: Enemy[];
  npcs: Npc[];
  projectiles: Projectile[];
  pickups: Pickup[];
  doors: Door[];
  barrels: Barrel[];
  pods: Pod[];
  /** Map object ids of destroyed props (late joiners remove them too). */
  broken: number[];
  objective: string;
  /** Where the objective is: map object / NPC names or "@x,y" points; the guide arrow points at the nearest. */
  objectiveTarget: string[];
  blackout: boolean;
  alarm: boolean;
  bossId: number;
}

export interface IncidentView {
  id: string; kind: 'alarm' | 'coffee' | 'cache'; x: number; y: number;
  phase: 'ready' | 'warning' | 'active' | 'done' | 'disabled';
  seconds: number; left: number; paused?: boolean;
}
