// Network protocol shared by the Colyseus room and the browser client.
// Lobby/meta state is a Colyseus schema (server/schema.ts); the game world travels as compact snapshots.
import type { EnemyType } from './enemies';
import type { WeaponId } from './weapons';
import type { Enemy, EnemyState, Npc, Pickup, PickupKind, Player, Projectile, ProjKind, WorldView } from './sim/types';

export const MAX_PLAYERS = 4;
export const TICK_HZ = 30;
export const SNAP_HZ = 20;

const ETYPES: EnemyType[] = ['normal', 'fast', 'fat', 'spitter', 'armored', 'exploder', 'chick', 'boss'];
const ESTATES: EnemyState[] = ['idle', 'chase', 'windup', 'fuse', 'charge', 'rise'];
const PKINDS: ProjKind[] = ['grenade', 'spit', 'egg'];
const KKINDS: PickupKind[] = ['ammo', 'health', 'armor', 'weapon', 'keycard', 'antidote', 'invincible', 'damage', 'infinite', 'sprint', 'achievement'];

export interface Snapshot {
  t: number;
  o: string; ot: string; bk: number[]; bo: number; al: number; b: number;
  p: Partial<Player>[];
  e: number[];          // flat enemies, E_STRIDE each
  bm: number;           // boss max hp
  n: Partial<Npc>[];
  appearances: Record<number, NonNullable<Enemy['appearance']>>;
  r: number[];          // flat projectiles, 6 each
  k: number[];          // flat pickups, 6 each
  d: (string | number)[]; // door id, open, locked-flag triples
  br: number[];         // barrels: id, x, y
  pd: number[];         // pods: id, x, y, broken
  incidents?: WorldView['incidents'];
  bn?: WorldView['bonus'];
}
export const E_STRIDE = 11;

const r1 = (v: number) => Math.round(v);

export function encodeSnapshot(w: WorldView): Snapshot {
  const e: number[] = [];
  let bm = 0;
  for (const x of w.enemies) {
    e.push(x.id, ETYPES.indexOf(x.type), x.variant, r1(x.x), r1(x.y), r1(x.angle * 100), r1((x.hp / x.maxHp) * 1000),
      ESTATES.indexOf(x.state), r1(Math.max(0, x.t) * 100), x.burnT > 0 ? 1 : 0, x.ability === 'charge_wind' ? 1 : 0);
    if (x.type === 'boss') bm = r1(x.maxHp);
  }
  const r: number[] = [];
  for (const pr of w.projectiles) r.push(pr.id, PKINDS.indexOf(pr.kind), r1(pr.x), r1(pr.y), r1(pr.vx), r1(pr.vy));
  const k: number[] = [];
  for (const pk of w.pickups) k.push(pk.id, KKINDS.indexOf(pk.kind), pk.weapon ? WEAPON_IDS.indexOf(pk.weapon) : -1, r1(pk.x), r1(pk.y), r1(pk.ttl * 10));
  return {
    t: Math.round(w.time * 1000) / 1000,
    bn: w.bonus ? { ...w.bonus } : null,
    incidents: w.incidents?.map(({ id, kind, x, y, phase, seconds, left, paused }) => ({ id, kind, x: r1(x), y: r1(y), phase, seconds: Math.ceil(seconds * 10) / 10, left, paused })),
    o: w.objective, ot: w.objectiveTarget.join('|'), bk: w.broken, bo: w.blackout ? 1 : 0, al: w.alarm ? 1 : 0, b: w.bossId,
    p: w.players.map((p) => ({
      id: p.id, slot: p.slot, name: p.name, look: p.look, x: r1(p.x), y: r1(p.y), aim: Math.round(p.aim * 100) / 100,
      hp: Math.ceil(p.hp), maxHp: p.maxHp, armor: Math.ceil(p.armor), state: p.state,
      downT: Math.round(p.downT * 10) / 10, reviveT: Math.round(p.reviveT * 100) / 100, respawnT: Math.round(p.respawnT * 10) / 10,
      weapons: p.weapons, cur: p.cur, ammo: p.ammo, reloadT: Math.round(p.reloadT * 100) / 100, firing: p.firing,
      kills: p.kills, score: Math.floor(p.score), combo: p.combo, tp: p.tp, keys: p.keys, hurtT: Math.round(p.hurtT * 100) / 100, bloom: Math.round(p.bloom * 1000) / 1000,
      supplies: p.supplies, support: p.support, supportVersion: p.supportVersion, connected: p.connected, buffs: p.buffs, achievements: p.achievements,
    })),
    e, bm, appearances: Object.fromEntries(w.enemies.filter(x => x.appearance).map(x => [x.id, x.appearance!])),
    n: w.npcs.filter((x) => x.mode !== 'gone').map((x) => ({ id: x.id, kind: x.kind, name: x.name, x: r1(x.x), y: r1(x.y), angle: Math.round(x.angle * 100) / 100, hp: Math.ceil(x.hp), maxHp: x.maxHp, mode: x.mode, weapon: x.weapon, rescued: x.rescued, follow: x.follow, hurtT: x.hurtT > 0 ? 0.2 : 0, mutation: x.mutation })),
    r, k,
    d: w.doors.flatMap((d) => [d.id, d.open ? 1 : 0, d.locked ? 1 : 0]),
    br: w.barrels.flatMap((b) => [b.id, r1(b.x), r1(b.y)]),
    pd: w.pods.flatMap((p) => [p.id, r1(p.x), r1(p.y), p.broken ? 1 : 0]),
  };
}

export const WEAPON_IDS: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'machinegun', 'grenade', 'flamethrower'];

/** Decode enemies of a snapshot into Enemy-shaped view objects (reusing `prev` objects by id). */
export function decodeEnemies(s: Snapshot, prev: Map<number, Enemy>): Enemy[] {
  const out: Enemy[] = [];
  const e = s.e;
  for (let i = 0; i < e.length; i += E_STRIDE) {
    const id = e[i];
    const type = ETYPES[e[i + 1]];
    let x = prev.get(id);
    if (!x) {
      x = { id, type, variant: e[i + 2], x: e[i + 3], y: e[i + 4], angle: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, state: 'idle', t: 0, cd: 0, aggro: true, target: null, speedMul: 1, burnT: 0, stunT: 0, flashT: 0, wanderA: 0, phase: 0, abilityCd: 0, ability: '', dormant: false };
    }
    x.type = type;
    x.appearance = s.appearances?.[id];
    x.variant = e[i + 2];
    x.x = e[i + 3]; x.y = e[i + 4];
    x.angle = e[i + 5] / 100;
    const maxHp = type === 'boss' ? s.bm || 1 : 1000;
    x.maxHp = maxHp; x.hp = (e[i + 6] / 1000) * maxHp;
    x.state = ESTATES[e[i + 7]];
    x.t = e[i + 8] / 100;
    x.burnT = e[i + 9] ? 1 : 0;
    x.ability = e[i + 10] ? 'charge_wind' : '';
    out.push(x);
  }
  return out;
}

export function decodeProjectiles(s: Snapshot): Projectile[] {
  const out: Projectile[] = [];
  for (let i = 0; i < s.r.length; i += 6) out.push({ id: s.r[i], kind: PKINDS[s.r[i + 1]], x: s.r[i + 2], y: s.r[i + 3], vx: s.r[i + 4], vy: s.r[i + 5], ttl: 1, owner: '', team: 'chicken', dmg: 0, r: 8 });
  return out;
}

export function decodePickups(s: Snapshot): Pickup[] {
  const out: Pickup[] = [];
  for (let i = 0; i < s.k.length; i += 6) out.push({ id: s.k[i], kind: KKINDS[s.k[i + 1]], weapon: s.k[i + 2] >= 0 ? WEAPON_IDS[s.k[i + 2]] : undefined, x: s.k[i + 3], y: s.k[i + 4], ttl: s.k[i + 5] / 10 });
  return out;
}
