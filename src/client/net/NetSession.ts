import type { Room } from 'colyseus.js';
import { GameMap, TiledMap, Collider } from '../../shared/map';
import type { Carry } from '../../shared/sim/World';
import type { Barrel, Door, Enemy, Npc, Pickup, Player, PlayerInput, Pod, Projectile, SimEvent, WorldView } from '../../shared/sim/types';
import { decodeEnemies, decodePickups, decodeProjectiles, Snapshot } from '../../shared/protocol';
import { lerpAngle } from '../../shared/math';
import type { Session } from './Session';

type Smooth = { tx: number; ty: number; ta: number; buf: number[] };

/**
 * D59: remote bodies are drawn INTERP seconds in the past, between the two snapshots around that
 * moment, instead of chasing the newest one. A late or bunched packet no longer stops chickens and
 * makes them jump; a long gap extrapolates briefly, then holds.
 */
const INTERP = 0.1, EXTRAP = 0.12, HISTORY = 6, TELEPORT = 220;
function push(o: Smooth & { x: number; y: number; angle?: number; aim?: number }, t: number, x: number, y: number, a: number) {
  const b = o.buf, n = b.length;
  if (n) {
    // world restarted or someone teleported: start over instead of sliding through walls
    if (t < b[n - 4] - 1 || Math.hypot(x - b[n - 3], y - b[n - 2]) > TELEPORT) b.length = 0;
    else if (t <= b[n - 4]) return;
  }
  b.push(t, x, y, a);
  if (b.length > HISTORY * 4) b.splice(0, b.length - HISTORY * 4);
}
/** Position at render time `rt`; writes into o.x/o.y and returns the angle. */
function sample(o: Smooth & { x: number; y: number }, rt: number, a0: number): number {
  const b = o.buf, n = b.length;
  if (!n) return a0;
  if (rt <= b[0] || n === 4) { o.x = b[1]; o.y = b[2]; return b[3]; }
  for (let i = 0; i + 4 < n; i += 4) {
    if (rt <= b[i + 4]) {
      const k = (rt - b[i]) / Math.max(1e-4, b[i + 4] - b[i]);
      o.x = b[i + 1] + (b[i + 5] - b[i + 1]) * k; o.y = b[i + 2] + (b[i + 6] - b[i + 2]) * k;
      return lerpAngle(b[i + 3], b[i + 7], k);
    }
  }
  // past the newest snapshot: keep moving a little, then wait
  const dt = Math.min(rt - b[n - 4], EXTRAP), span = Math.max(1e-4, b[n - 4] - b[n - 8]);
  o.x = b[n - 3] + (b[n - 3] - b[n - 7]) / span * dt; o.y = b[n - 2] + (b[n - 2] - b[n - 6]) / span * dt;
  return b[n - 1];
}

/** Client side of a multiplayer game: renders server snapshots, sends inputs. */
export class NetSession implements Session {
  solo = false;
  myId: string;
  levelId: string;
  map: GameMap;
  view: WorldView;
  private events: SimEvent[] = [];
  private enemyCache = new Map<number, Enemy & Smooth>();
  private playerCache = new Map<string, Player & Smooth>();
  private npcCache = new Map<string, Npc & Smooth>();
  private doorColliders = new Map<string, Collider>();
  private barrelColliders = new Map<string, Collider>();
  private podColliders = new Map<string, Collider>();
  private sendT = 0;
  private lastInput: PlayerInput | null = null;
  /** server time − local time, tracked from the earliest arrivals */
  private offset = NaN;
  gotSnapshot = false;

  constructor(public room: Room, levelId: string, mapJson: TiledMap) {
    this.myId = room.sessionId;
    this.levelId = levelId;
    this.map = new GameMap(levelId, mapJson);
    this.view = {
      mapId: levelId, time: 0, players: [], enemies: [], npcs: [], projectiles: [], pickups: [], doors: [], barrels: [], pods: [],
      objective: '', objectiveTarget: [], broken: [], blackout: false, alarm: false, bossId: -1,
    };
    // static colliders the simulation adds at runtime (doors, barrels, pods) — mirror them for prediction
    for (const o of this.map.objects) {
      if (o.type === 'door') {
        const d: Door = { id: o.name || 'door' + o.id, x: o.x, y: o.y, w: o.w, h: o.h, open: false, locked: o.props.locked || '', theme: o.props.theme || 'office' };
        this.view.doors.push(d);
        this.doorColliders.set(d.id, this.map.addCollider({ x: o.x, y: o.y, w: o.w, h: o.h, bullets: true, round: false, id: -5000 - o.id, dynamic: true, open: false, door: true, locked: !!d.locked }));
      } else if (o.type === 'barrel') {
        this.barrelColliders.set(`${Math.round(o.cx)},${Math.round(o.cy)}`, this.map.addCollider({ x: o.cx - 18, y: o.cy - 18, w: 36, h: 36, bullets: false, round: true, id: -6000 - o.id }));
      } else if (o.type === 'pod') {
        this.podColliders.set(`${Math.round(o.cx)},${Math.round(o.cy)}`, this.map.addCollider({ x: o.cx - 24, y: o.cy - 24, w: 48, h: 48, bullets: false, round: true, id: -7000 - o.id }));
      }
    }
  }

  onEvents(ev: SimEvent[]) { for (const e of ev) this.events.push(e); }

  onSnapshot(s: Snapshot) {
    const v = this.view;
    const now = performance.now() / 1000, off = s.t - now;
    // earliest arrival defines the clock; drift down slowly; a restarted world resets it
    if (Number.isNaN(this.offset) || off > this.offset || off < this.offset - 2) this.offset = off;
    else this.offset += (off - this.offset) * 0.02;
    v.time = s.t;
    v.incidents = s.incidents ?? [];
    v.bonus = s.bn ?? null;
    v.broken = s.bk ?? [];
    v.objective = s.o; v.objectiveTarget = s.ot ? s.ot.split('|') : []; v.blackout = !!s.bo; v.alarm = !!s.al; v.bossId = s.b;
    // players
    const players: Player[] = [];
    for (const raw of s.p) {
      let p = this.playerCache.get(raw.id!);
      if (!p) {
        p = { ...(raw as Player), vx: 0, vy: 0, shotSeq: 0, input: { seq: 0, x: raw.x!, y: raw.y!, aim: 0, fire: false, reload: false, interact: false, weapon: 0 }, deaths: 0, comboT: 0, connected: true, fireCd: 0, tx: raw.x!, ty: raw.y!, ta: raw.aim!, buf: [] } as Player & Smooth;
        this.playerCache.set(raw.id!, p);
      }
      const { x, y, aim } = p;
      Object.assign(p, raw, { x, y, aim });
      if (raw.id === this.myId) { p.x = raw.x!; p.y = raw.y!; p.aim = raw.aim!; } // own body: newest authority (prediction runs ahead of it)
      p.tx = raw.x!; p.ty = raw.y!; p.ta = raw.aim!;
      push(p, s.t, raw.x!, raw.y!, raw.aim!);
      players.push(p);
    }
    for (const id of [...this.playerCache.keys()]) if (!s.p.some((q) => q.id === id)) this.playerCache.delete(id);
    v.players = players;
    // enemies
    const prev = new Map<number, Enemy>();
    for (const [id, e] of this.enemyCache) prev.set(id, { ...e, x: e.tx, y: e.ty, angle: e.ta });
    const decoded = decodeEnemies(s, prev);
    const enemies: Enemy[] = [];
    const seen = new Set<number>();
    for (const d of decoded) {
      seen.add(d.id);
      let e = this.enemyCache.get(d.id);
      if (!e) { e = { ...d, tx: d.x, ty: d.y, ta: d.angle, buf: [] }; this.enemyCache.set(d.id, e); }
      const { x, y, angle } = e;
      Object.assign(e, d, { x, y, angle });
      e.tx = d.x; e.ty = d.y; e.ta = d.angle;
      push(e, s.t, d.x, d.y, d.angle);
      enemies.push(e);
    }
    for (const id of [...this.enemyCache.keys()]) if (!seen.has(id)) this.enemyCache.delete(id);
    v.enemies = enemies;
    // npcs
    const npcs: Npc[] = [];
    for (const raw of s.n) {
      let n = this.npcCache.get(raw.id!);
      if (!n) { n = { ...(raw as Npc), fireCd: 0, goal: null, lines: [], talkCd: 0, tag: '', vx: 0, vy: 0, tx: raw.x!, ty: raw.y!, ta: raw.angle!, buf: [] }; this.npcCache.set(raw.id!, n); }
      const { x, y, angle } = n;
      Object.assign(n, raw, { x, y, angle });
      n.tx = raw.x!; n.ty = raw.y!; n.ta = raw.angle!;
      push(n, s.t, raw.x!, raw.y!, raw.angle!);
      npcs.push(n);
    }
    for (const id of [...this.npcCache.keys()]) if (!s.n.some((q) => q.id === id)) this.npcCache.delete(id);
    v.npcs = npcs;
    v.projectiles = decodeProjectiles(s);
    v.pickups = decodePickups(s);
    // doors
    for (let i = 0; i < s.d.length; i += 3) {
      const id = s.d[i] as string;
      const d = v.doors.find((q) => q.id === id);
      if (!d) continue;
      d.open = !!s.d[i + 1];
      d.locked = s.d[i + 2] ? (d.locked || 'script') : '';
      const c = this.doorColliders.get(id);
      if (c) { c.open = d.open; c.locked = !!d.locked; }
    }
    // barrels & pods (remove colliders of destroyed ones)
    const barrels: Barrel[] = [];
    const bKeys = new Set<string>();
    for (let i = 0; i < s.br.length; i += 3) { barrels.push({ id: s.br[i], x: s.br[i + 1], y: s.br[i + 2], hp: 1 }); bKeys.add(`${s.br[i + 1]},${s.br[i + 2]}`); }
    for (const [k, c] of this.barrelColliders) if (!bKeys.has(k)) { this.map.removeCollider(c); this.barrelColliders.delete(k); }
    v.barrels = barrels;
    const pods: Pod[] = [];
    for (let i = 0; i < s.pd.length; i += 4) pods.push({ id: s.pd[i], x: s.pd[i + 1], y: s.pd[i + 2], hp: 1, broken: !!s.pd[i + 3], tag: '', hatch: '' });
    v.pods = pods;
    this.gotSnapshot = true;
  }

  poll(dt: number) {
    // remote entities: interpolate between buffered snapshots, INTERP seconds behind the server
    const rt = performance.now() / 1000 + this.offset - INTERP;
    if (!Number.isNaN(rt)) {
      for (const e of this.enemyCache.values()) e.angle = sample(e, rt, e.angle);
      for (const p of this.playerCache.values()) if (p.id !== this.myId) p.aim = sample(p, rt, p.aim);
      for (const n of this.npcCache.values()) n.angle = sample(n, rt, n.angle);
    }
    // projectiles fly between snapshots
    for (const pr of this.view.projectiles) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    // inputs at ~30 Hz (edges are latched until sent)
    this.sendT -= dt;
    if (this.lastInput && this.sendT <= 0) {
      this.sendT = 1 / 30;
      this.room.send('input', this.lastInput);
      this.lastInput = { ...this.lastInput, reload: false };
    }
    const ev = this.events;
    this.events = [];
    return ev;
  }

  send(inp: PlayerInput) {
    const reload = !!(this.lastInput?.reload || inp.reload);
    // Preserve both edges of taps shorter than the regular 30 Hz send interval.
    if (inp.interact !== (this.lastInput?.interact ?? false) || (!inp.fire && this.lastInput?.fire)) this.room.send('input', inp);
    this.lastInput = { ...inp, reload };
  }

  carry(): Carry { return { players: {}, npcs: [] }; }
  dispose() {}
}

export type { Pickup, Projectile };
