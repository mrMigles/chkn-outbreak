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
  /** D73: seconds left held by potato tops (Вершков): the player walks at 30 % speed. */
  slowT?: number;
  /** D72: personal statistics — this chapter and the whole run (carried between floors; never affect the rules). */
  stats?: { run: PlayerStats; chap: PlayerStats };
}

/** D72: what a player did (chapter summaries, the final personal statistics, the chronicle). */
export interface PlayerStats {
  kills: number; downs: number; heads: number; shots: number; dmg: number; taken: number;
  revives: number; heals: number; maxCombo: number; closeCalls: number; barrels: number; floors: number; time: number;
  /** elites and bosses this player finished off */
  elites: string[];
  /** achievements earned (chapter: in this chapter) */
  ach: string[];
  /** scripted funny moments («открыл не ту переговорку») */
  moments: string[];
}
export const newStats = (): PlayerStats => ({ kills: 0, downs: 0, heads: 0, shots: 0, dmg: 0, taken: 0, revives: 0, heals: 0, maxCombo: 0, closeCalls: 0, barrels: 0, floors: 0, time: 0, elites: [], ach: [], moments: [] });
export interface SummaryPlayer { id: string; name: string; slot: number; look: string; stats: PlayerStats; titles: string[] }
/** D72: a chapter's mini summary (kept in the chronicle). `final`: the whole run, shown after the victory. */
export interface ChapterSummary { chapter: string; title: string; players: SummaryPlayer[]; final?: SummaryPlayer[] }

/** D72: a scripted vehicle (street 1: the Lithuanian's stolen sports car) — drives along a path, runs chickens over. */
export interface Vehicle { id: number; kind: string; x: number; y: number; angle: number; speed: number; path: { x: number; y: number }[]; moving: boolean; honk?: number }

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
  /** D72: a deep sleeper — gunfire does not wake it (the parking-lot flock waits for the car). Sim only. */
  deaf?: boolean;
  /** D69: seconds left blinded by a flashlight (elite Валера): slower and takes more damage. Sim only. */
  blindT?: number;
  /** D69: hit-and-run elites retreat into the dark for this long after a bite. Sim only. */
  fleeT?: number;
  /** D69: how long the elite has been held in a flashlight beam. Sim only. */
  litT?: number;
  /** D72: seconds to the next blink through the dark (Валера) / the next bottle (Толик). Sim only. */
  blinkT?: number;
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
  /** D71: follow-stuck detector (sim only). */
  stuck?: { x: number; y: number; t: number; nav: number };
}

export type ProjKind = 'grenade' | 'spit' | 'egg' | 'bottle';

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
export type PickupKind = 'ammo' | 'health' | 'armor' | 'weapon' | 'keycard' | 'antidote' | BuffKind | 'achievement' | 'doc';
/**
 * ts (D72): bit mask of player slots who already took this weapon/ammo — in a team every player takes their own.
 * amount (D72): a special weapon dropped by a mini-boss carries only part of its ammo.
 */
export interface Pickup { id: number; kind: PickupKind; weapon?: WeaponId; key?: string; x: number; y: number; ttl: number; ts?: number; amount?: number }

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
  | { e: 'propbreak'; id: number; x: number; y: number; m: string }
  /** D69: scripted horror beats (floor 8) and cutscene props (floor 12). */
  | { e: 'scare'; k: 'jump' | 'ring' | 'flicker' | 'scream' | 'spark' | 'eyes' | 'knock' | 'grain' | 'poof' | 'blink' | 'crash' | 'engine' | 'roots' | 'rooted'; x: number; y: number }
  /** D72: a chapter is over — per-player mini summary (and the whole run's statistics after the victory). */
  | { e: 'chapter'; summary: ChapterSummary }
  | { e: 'light'; v: number }
  | { e: 'cine'; k: 'heli' | 'chapter' | 'victory' | 'intro'; text?: string; sub?: string };

/** Render-facing view of the world (identical for local sim and network snapshots). */
export interface WorldView {
  /** D66 simulation rules version (absent on network views = current). */
  rules?: number;
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
  /** D69: name over the boss bar (elite chickens: Валера, директор); absent = the final boss. */
  bossName?: string;
  /** D69: darkness override set by a script (−1 = the map's own ambient). */
  light?: number;
  /** D72: scripted vehicles. */
  vehicles?: Vehicle[];
}

export interface IncidentView {
  id: string; kind: 'alarm' | 'coffee' | 'cache'; x: number; y: number;
  phase: 'ready' | 'warning' | 'active' | 'done' | 'disabled';
  seconds: number; left: number; paused?: boolean;
}
