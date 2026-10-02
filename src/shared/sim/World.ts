// Authoritative game simulation. Runs in the browser (solo) or in a Colyseus room (multiplayer).
import { LOOK_PRESETS } from '../look';
import { propDef } from '../props';
import { GameMap, MapObject, Collider, rayCircle, TILE } from '../map';
import { FlowField } from '../nav';
import { ENEMIES, EnemyType, PLAYER } from '../enemies';
import { WEAPONS, WeaponId, WEAPON_ORDER } from '../weapons';
import { Rng, angleDiff, clamp, dist, dist2, TAU } from '../math';
import { MUTATION, BUFFS, BUFF_SECONDS, type BuffKind } from './types';
import type {
  Player, Enemy, Npc, Projectile, Pickup, Door, Barrel, Pod, SimEvent, PlayerInput, Team, WorldView, PickupKind, ProjKind,
} from './types';
import { updateEnemy } from './enemyAI';
import { rayBody, enemyBox, HUMAN_BOX, type BodyBox } from './hitbox';
import { updateNpc } from './npcAI';
import { SupportController } from './support';
import type { LevelScript } from '../levels/types';

export interface CarryNpc { id: string; kind: string; name: string; weapon: WeaponId | null; hp: number; maxHp: number; betrayal?: Npc['betrayal']; mutation?: Npc['mutation']; props?: Npc['props'] }
export interface Carry {
  players: Record<string, { weapons: WeaponId[]; ammo: Player['ammo']; hp: number; armor: number; supplies?: Player['supplies']; achievements?: string[] }>;
  npcs: CarryNpc[];
}
export interface WorldOptions {
  solo: boolean;
  carry?: Carry;
  difficulty?: number;
  seed?: number;
}

interface Timer { t: number; fn: () => void; every?: number }
interface Wave { group: string; types: EnemyType[]; left: number; interval: number; t: number; aggro: boolean; tag: string; waited: number; corridorOnly?: boolean }

const HUMAN_R = PLAYER.radius;
const BARREL_BOX: BodyBox = { hw: 18, h: 50, head: 0 };
const POD_BOX: BodyBox = { hw: 22, h: 64, head: 0 };

export class World implements WorldView {
  map: GameMap;
  mapId: string;
  flow: FlowField;
  rng = new Rng(1337);
  time = 0;
  players: Player[] = [];
  enemies: Enemy[] = [];
  npcs: Npc[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  doors: Door[] = [];
  barrels: Barrel[] = [];
  pods: Pod[] = [];
  broken: number[] = [];
  /** Destructible props still standing (map object id → state). */
  dprops: { id: number; name: string; x: number; y: number; hp: number; mat: string; box: BodyBox; blocksBullets: boolean; drop?: string }[] = [];
  objective = '';
  objectiveTarget: string[] = [];
  blackout = false;
  alarm = false;
  bossId = -1;
  events: SimEvent[] = [];
  flags: Record<string, any> = {};
  script: LevelScript;
  opts: WorldOptions;
  finished = false;
  over = false;
  /** Developer mode (solo only): players take no damage. */
  god = false;

  private nextId = 1;
  private timers: Timer[] = [];
  private waves: Wave[] = [];
  private flowT = 0;
  private doorColliders = new Map<string, Collider>();
  private firedTriggers = new Set<string>();
  private insideTriggers = new Set<string>();
  private trails = new Map<string, { x: number; y: number }[]>();
  private trailT = 0;
  private spawnPoints: MapObject[] = [];
  enemyTags = new Map<number, string>();
  private supportController = new SupportController();
  private hadCombat = false;
  private betrayals = 0;
  private lastBetrayal = -30;

  constructor(map: GameMap, script: LevelScript, opts: WorldOptions) {
    this.map = map;
    this.mapId = map.id;
    this.script = script;
    this.opts = opts;
    opts.seed ??= Math.floor(Math.random() * 0xffffffff);
    this.rng = new Rng(opts.seed);
    for (const o of map.objects) this.loadObject(o);
    for (const o of map.objects) {
      if (o.type !== 'prop') continue;
      const def = propDef(o.name);
      if (!def.hp) continue;
      const feetY = o.cy + o.h / 2 - (def.inset ?? 0);
      this.dprops.push({ id: o.id, name: o.name, x: o.cx, y: feetY, hp: def.hp, mat: def.mat ?? 'wood', box: { hw: Math.max(12, o.w / 2 - (def.inset ?? 0)), h: def.h ?? 50, head: 0 }, blocksBullets: def.bullets, drop: def.drop });
    }
    this.flow = new FlowField(map);
    this.spawnPoints = map.objects.filter((o) => o.type === 'spawn');
  }

  // ------------------------------------------------------------------ setup
  private loadObject(o: MapObject) {
    const cx = o.cx, cy = o.cy;
    switch (o.type) {
      case 'enemy':
        this.spawnEnemy((o.name || 'normal') as EnemyType, cx, cy, { aggro: !!o.props.aggro, how: null, tag: o.props.tag || '', dormant: !!o.props.dormant });
        break;
      case 'npc':
        this.npcs.push({
          id: o.name || 'npc' + o.id, kind: o.props.look || (LOOK_PRESETS[o.name] ? o.name : o.props.kind) || 'manBlue', name: o.props.title || o.name, x: cx, y: cy,
          angle: (o.props.angle ?? 90) * Math.PI / 180, hp: o.props.hp ?? 80, maxHp: o.props.hp ?? 80,
          mode: o.props.mode || 'idle', weapon: o.props.weapon || null, fireCd: 0, follow: null, goal: null,
          lines: o.props.lines ? String(o.props.lines).split('|') : [], talkCd: 2 + this.rng.next() * 4, tag: o.props.tag || o.name,
          rescued: false, vx: 0, vy: 0, hurtT: 0, props: o.props,
        });
        break;
      case 'pickup':
        this.addPickup(o.name as PickupKind, cx, cy, { weapon: o.props.weapon, key: o.props.key, ttl: -1 });
        break;
      case 'barrel':
        this.barrels.push({ id: this.nextId++, x: cx, y: cy, hp: 30 });
        this.map.addCollider({ x: cx - 18, y: cy - 18, w: 36, h: 36, bullets: false, round: true, id: -(this.nextId - 1) });
        break;
      case 'pod': {
        const id = this.nextId++;
        this.pods.push({ id, x: cx, y: cy, hp: 20, broken: !!o.props.broken, tag: o.props.tag || '', hatch: o.props.hatch || 'chick' });
        this.map.addCollider({ x: cx - 24, y: cy - 24, w: 48, h: 48, bullets: false, round: true, id: -id });
        break;
      }
      case 'door': {
        const d: Door = { id: o.name || 'door' + o.id, x: o.x, y: o.y, w: o.w, h: o.h, open: false, locked: o.props.locked || '', theme: o.props.theme || 'office' };
        this.doors.push(d);
        const c = this.map.addCollider({ x: o.x, y: o.y, w: o.w, h: o.h, bullets: true, round: false, id: -1000 - this.doors.length, dynamic: true, open: false, door: true, locked: !!d.locked });
        this.doorColliders.set(d.id, c);
        break;
      }
    }
  }

  addPlayer(id: string, name: string, slot: number, look = '') {
    const sp = this.spawnPoints.filter((s) => s.name === 'player');
    const s0 = sp[slot % Math.max(1, sp.length)];
    const s = s0 ? { x: s0.cx, y: s0.cy } : { x: 200, y: 200 };
    const carry = this.opts.carry?.players[id];
    const p: Player = {
      id, slot, name, look, x: s.x + (sp.length ? 0 : slot * 40), y: s.y, aim: 0, vx: 0, vy: 0,
      hp: carry?.hp ?? PLAYER.hp, maxHp: PLAYER.hp, armor: carry?.armor ?? 0, state: 'alive', downT: 0, reviveT: 0, respawnT: 0,
      weapons: carry?.weapons ? [...carry.weapons] : ['pistol'], cur: 0, ammo: carry?.ammo ? JSON.parse(JSON.stringify(carry.ammo)) : { pistol: { mag: 12, reserve: -1 } },
      reloadT: 0, fireCd: 0, bloom: 0, firing: false, shotSeq: 0,
      input: { seq: 0, x: s.x, y: s.y, aim: 0, fire: false, reload: false, interact: false, weapon: 0 },
      kills: 0, deaths: 0, score: 0, hurtT: 0, keys: [], combo: 0, comboT: 0, connected: true, tp: 0,
      supplies: { ...(carry?.supplies ?? { medkit: 1, ammo: 1 }) }, support: null, supportVersion: 0,
      buffs: {}, achievements: [...(carry?.achievements ?? [])],
    };
    p.input.x = p.x; p.input.y = p.y;
    p.cur = Math.max(0, p.weapons.length - 1);
    for (const w of this.script.startWeapons ?? []) this.giveWeapon(p, w, false);
    this.players.push(p);
    this.trails.set(p.id, []);
    return p;
  }

  removePlayer(id: string) {
    const p = this.players.find(q => q.id === id);
    if (p) this.supportController.reset(p, this);
    this.players = this.players.filter((p) => p.id !== id);
    this.trails.delete(id);
    // companions switch to another teammate
    const next = this.players.find((q) => q.state === 'alive') ?? this.players[0];
    for (const n of this.npcs) if (n.follow === id) n.follow = next?.id ?? null;
  }

  start() {
    // survivors who followed us through the last level come along
    const lead = this.players[0];
    (this.opts.carry?.npcs ?? []).forEach((c, i) => {
      if (!lead || this.npcs.some((n) => n.id === c.id)) return;
      const a = Math.PI / 2 + (i - 0.5) * 0.9;
      this.npcs.push({
        id: c.id, kind: c.kind, name: c.name, x: lead.x + Math.cos(a) * 60, y: lead.y + Math.sin(a) * 60, angle: 0, hp: c.hp, maxHp: c.maxHp,
        mode: 'follow', weapon: c.weapon, fireCd: 0, follow: lead.id, goal: null, lines: [], talkCd: 5, tag: c.id, rescued: true, vx: 0, vy: 0, hurtT: 0,
        betrayal: c.betrayal ? { ...c.betrayal } : undefined, mutation: c.mutation ? { ...c.mutation } : undefined,
        props: c.props ? { ...c.props } : undefined,
      });
    });
    this.script.onStart?.(this);
  }

  /** State that carries over into the next level. */
  carryOut(): Carry {
    const players: Carry['players'] = {};
    for (const p of this.players) {
      const src = p.state === 'alive' || !p.saved ? p : p.saved;
      players[p.id] = { weapons: [...src.weapons], ammo: JSON.parse(JSON.stringify(src.ammo)), hp: Math.max(60, p.state === 'alive' ? p.hp : 60), armor: p.armor, supplies: { ...p.supplies }, achievements: [...(p.achievements ?? [])] };
    }
    const npcs = this.npcs.filter((n) => n.mode === 'follow').map((n) => ({ id: n.id, kind: n.kind, name: n.name, weapon: n.weapon, hp: Math.max(n.hp, n.maxHp * 0.6), maxHp: n.maxHp, betrayal: n.betrayal ? { ...n.betrayal } : undefined, mutation: n.mutation ? { ...n.mutation } : undefined, props: n.props }));
    return { players, npcs };
  }

  // ------------------------------------------------------------------ script API
  emit(ev: SimEvent) { this.events.push(ev); }
  say(who: string, text: string, d = 3.2) { this.emit({ e: 'say', who, text, d }); }
  /** target: map object / NPC name(s) or a point; empty = no direction (survive/defend). */
  setObjective(text: string, target?: string | string[] | { x: number; y: number }) {
    const targets = !target ? [] : typeof target === 'string' ? [target] : Array.isArray(target) ? target : [`@${Math.round(target.x)},${Math.round(target.y)}`];
    if (this.objective === text && this.objectiveTarget.join('|') === targets.join('|')) return;
    const changedText = this.objective !== text;
    this.objective = text;
    this.objectiveTarget = targets;
    if (changedText) this.emit({ e: 'obj', text });
  }
  msg(text: string, sub?: string, d = 3) { this.emit({ e: 'msg', text, sub, d }); }
  after(t: number, fn: () => void) { this.timers.push({ t, fn }); }
  every(t: number, fn: () => void) { this.timers.push({ t, fn, every: t }); }
  /** Turn a survivor into a chicken (scripted infection). */
  infect(n: Npc, type: EnemyType = 'normal', tag = '') {
    if (n.mode === 'dead' || n.mode === 'gone' || n.mutation) return;
    n.mutation = { stage: 'twitch', elapsed: 0, type, tag };
    this.emit({ e: 'mutation', id: n.id, x: n.x, y: n.y, stage: 'twitch' });
  }
  setBlackout(on: boolean) { this.blackout = on; this.emit({ e: 'blackout', on }); }
  setAlarm(on: boolean) { this.alarm = on; this.emit({ e: 'alarm', on }); }
  npc(id: string) { return this.npcs.find((n) => n.id === id); }
  object(name: string) { return this.map.objects.find((o) => o.name === name); }
  objects(type: string, name?: string) { return this.map.objects.filter((o) => o.type === type && (name === undefined || o.name === name)); }
  get humanPlayers() { return this.players.filter((p) => p.state === 'alive'); }
  get anyPlayer() { return this.humanPlayers[0] ?? this.players[0]; }

  spawnWave(group: string, types: EnemyType[], count: number, interval = 0.5, aggro = true, tag = '', corridorOnly = false) {
    this.waves.push({ group, types, left: count, interval, t: 0, aggro, tag: tag || group, waited: 0, corridorOnly });
  }
  cancelWaves() { this.waves.length = 0; }
  rebindPlayer(oldId: string, id: string, name: string, look: string) {
    const p = this.players.find(p => p.id === oldId);
    if (!p) return;
    const trail = this.trails.get(oldId) ?? [];
    this.trails.delete(oldId); this.trails.set(id, trail);
    for (const n of this.npcs) if (n.follow === oldId) n.follow = id;
    for (const pr of this.projectiles) if (pr.owner === oldId) pr.owner = id;
    p.id = id; p.name = name; p.look = look; p.tp++; p.support = null;
    this.resetInput(id);
    return p;
  }
  /** Enemies alive with tag (wave group or map tag) + pending wave spawns. */
  countTag(tag: string) {
    let n = 0;
    for (const e of this.enemies) if (this.enemyTags.get(e.id) === tag) n++;
    for (const w of this.waves) if (w.tag === tag) n += w.left;
    for (const q of this.npcs) if (q.mode !== 'dead' && q.mode !== 'gone' && q.mutation?.tag === tag) n++;
    return n;
  }

  openDoor(id: string, open = true) {
    const d = this.doors.find((x) => x.id === id);
    if (!d || d.open === open) return;
    d.open = open;
    if (open) d.locked = '';
    const c = this.doorColliders.get(id);
    if (c) { c.open = open; c.locked = !!d.locked; }
    this.emit({ e: 'door', id, open });
    this.flow.rebuildBlocked();
  }
  lockDoor(id: string, key = 'script') {
    const d = this.doors.find((x) => x.id === id);
    if (!d) return;
    d.locked = key;
    const c = this.doorColliders.get(id);
    if (c) c.locked = true;
    if (d.open) this.openDoor(id, false);
    this.flow.rebuildBlocked();
  }

  completeLevel(next?: string) {
    if (this.finished) return;
    this.finished = true;
    // chickens are cured at the end of a level
    for (const p of this.players) if (p.state !== 'alive') this.cure(p);
    this.emit({ e: 'level', next: next ?? this.script.next ?? '', win: !(next ?? this.script.next) });
  }

  gameOver(reason: string) {
    if (this.over) return;
    this.over = true;
    this.emit({ e: 'gameover', reason });
  }

  // ------------------------------------------------------------------ entities
  spawnEnemy(type: EnemyType, x: number, y: number, o: { aggro?: boolean; how?: 'egg' | 'vent' | 'rise' | null; tag?: string; dormant?: boolean } = {}) {
    const def = ENEMIES[type];
    const diff = this.opts.difficulty ?? 1;
    const hpMul = (type === 'boss' ? 0.6 + 0.4 * Math.max(1, this.players.length) : 1) * (this.script.enemyHp ?? 1);
    const e: Enemy = {
      id: this.nextId++, type, variant: this.rng.int(0, def.sprite.length - 1), x, y, angle: this.rng.range(0, TAU), vx: 0, vy: 0,
      hp: def.hp * hpMul * diff, maxHp: def.hp * hpMul * diff, state: o.how ? 'rise' : 'idle', t: o.how ? 0.55 : 0, cd: this.rng.range(0, 0.6),
      aggro: !!o.aggro, target: null, speedMul: this.rng.range(0.9, 1.12), burnT: 0, stunT: 0, flashT: 0, wanderA: this.rng.range(0, TAU),
      phase: 0, abilityCd: 3, ability: '', dormant: !!o.dormant,
    };
    this.enemies.push(e);
    if (this.mapId !== 'office' && type !== 'boss' && type !== 'chick' && !o.tag?.startsWith('root') && this.rng.chance(.12)) {
      const odd: Record<string, [string, string]> = {
        normal: ['Ко-коуч · требует дейли', 'manBlue'], fast: ['Петух-отпускник · без согласования', 'worker'],
        fat: ['Директор по корму · всё включено', 'arkady'], armored: ['Служба петушиной безопасности', 'guard'],
        spitter: ['Бухгалтер · плюётся отчётами', 'scientist'], exploder: ['DevOops · горячий релиз', 'scientist'],
      };
      const [name, kind] = odd[type]; e.appearance = { npcId: 'odd_' + e.id, kind, name };
    }
    if (o.tag) this.enemyTags.set(e.id, o.tag);
    if (type === 'boss') this.bossId = e.id;
    if (o.how) this.emit({ e: 'spawn', id: e.id, x, y, how: o.how });
    return e;
  }

  addPickup(kind: PickupKind, x: number, y: number, o: { weapon?: WeaponId; key?: string; ttl?: number } = {}) {
    const p: Pickup = { id: this.nextId++, kind, weapon: o.weapon, key: o.key, x, y, ttl: o.ttl ?? 25 };
    this.pickups.push(p);
    return p;
  }

  giveWeapon(p: Player, w: WeaponId, select = true) {
    const def = WEAPONS[w];
    if (!p.weapons.includes(w)) {
      p.weapons.push(w);
      p.weapons.sort((a, b) => WEAPON_ORDER.indexOf(a) - WEAPON_ORDER.indexOf(b));
      p.ammo[w] = { mag: def.mag, reserve: def.reserveMax < 0 ? -1 : Math.min(def.reserveMax, def.pickupAmmo * 2) };
      if (select) { p.cur = p.weapons.indexOf(w); p.reloadT = 0; }
    } else {
      const a = p.ammo[w]!;
      if (a.reserve >= 0) a.reserve = Math.min(def.reserveMax, a.reserve + def.pickupAmmo);
    }
  }

  // ------------------------------------------------------------------ main loop
  step(dt: number) {
    if (this.over) { this.time += dt; return; }
    this.time += dt;
    // timers
    for (const t of [...this.timers]) {
      t.t -= dt;
      if (t.t <= 0) {
        t.fn();
        if (t.every) t.t += t.every; else this.timers.splice(this.timers.indexOf(t), 1);
      }
    }
    this.updateWaves(dt);
    for (const p of this.players) this.updatePlayer(p, dt);
    this.updateTrails(dt);
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.35;
      const targets: { x: number; y: number }[] = [];
      for (const p of this.players) if (p.state === 'alive') targets.push(p);
      for (const n of this.npcs) if (this.npcTargetable(n)) targets.push(n);
      this.flow.compute(targets);
    }
    for (const n of this.npcs) {
      this.updateBetrayal(n, dt);
      if (n.mutation && n.mode !== 'gone' && n.mode !== 'dead') this.updateMutation(n, dt);
      else updateNpc(this, n, dt);
    }
    this.separate();
    this.separateNpcs();
    for (const e of [...this.enemies]) updateEnemy(this, e, dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateDoors();
    this.updateTriggers();
    this.script.onTick?.(this, dt);
    if (this.time >= (this.flags.gagAt ?? 12) && this.mapId !== 'office') {
      this.flags.gagAt = this.time + this.rng.range(18, 28);
      const odd = this.enemies.find(e => e.appearance?.npcId.startsWith('odd_') && e.aggro && this.onScreen(e.x, e.y));
      if (odd) this.say(String(odd.id), this.rng.pick(['Ко-ко-ко… у вас микрофон выключен!', 'Это совещание могло быть яйцом!', 'Я не агрессивный, я проактивный!', 'Отпуск согласован. Согласован КЛЮВОМ!', 'Кто выкатил птиц в прод?!']), 2.6);
      else if (this.rng.chance(.3) && this.enemies.length) this.say('pa', this.rng.pick(['Коллеги, перестаньте клевать кулер. Он на гарантии.', 'Потерянное яйцо можно забрать в отделе кадров.', 'Напоминаем: драка с петухом считается тимбилдингом.']), 4);
    }
    const combat = this.enemies.length > 0 || this.waves.length > 0 || this.npcs.some(n => n.mutation && n.mode !== 'gone' && n.mode !== 'dead');
    if (this.hadCombat && !combat) this.rallyTeam();
    this.hadCombat = combat;
    this.checkLose();
  }

  private updateMutation(n: Npc, dt: number) {
    const m = n.mutation!;
    m.elapsed += dt;
    const stage = m.elapsed < MUTATION.feathers ? 'twitch' : m.elapsed < MUTATION.silhouette ? 'feathers' : 'silhouette';
    if (stage !== m.stage) {
      m.stage = stage; this.emit({ e: 'mutation', id: n.id, x: n.x, y: n.y, stage });
    }
    if (m.elapsed < MUTATION.done) return;
    n.mode = 'gone';
    if (n.weapon) this.addPickup('weapon', n.x + 18, n.y, { weapon: n.weapon });
    this.script.onNpcLost?.(this, n);
    const e = this.spawnEnemy(m.type, n.x, n.y, { how: 'egg', aggro: true, tag: m.tag });
    e.appearance = { npcId: n.id, kind: n.kind, name: n.name };
    this.emit({ e: 'mutation', id: n.id, x: n.x, y: n.y, stage: 'complete' });
  }

  private updateBetrayal(n: Npc, dt: number) {
    if (n.props?.story || ['marat', 'petrovich', 'galina', 'omletov', 'mihalych'].includes(n.id)) return;
    if (n.mode === 'dead' || n.mode === 'gone' || n.mutation || (n.mode !== 'follow' && !n.rescued)) return;
    if (!n.betrayal) n.betrayal = { checked: true, remaining: this.rng.chance(0.65) ? this.rng.range(18, 45) : -1, helped: 0 };
    const plan = n.betrayal;
    plan.helped += dt;
    if (plan.remaining < 0) return;
    plan.remaining = Math.max(0, plan.remaining - dt);
    if (plan.remaining > 0 || plan.helped < 12 || this.time - this.lastBetrayal < 12 ||
      this.npcs.some(q => q.mutation && q.mode !== 'gone' && q.mode !== 'dead')) return;
    this.betrayals++; this.lastBetrayal = this.time;
    this.say(n.id, 'Я прикрою… ко… ЧТО СО МНОЙ?!', 2.2);
    this.infect(n, n.weapon ? 'armored' : 'normal', 'betrayal');
  }

  /** Only after combat clears; spectators return as teammates with their loadout. */
  rallyTeam() {
    const lead = this.humanPlayers.find(p => p.connected);
    if (!lead || this.over) return;
    for (const p of this.players) if (p.state === 'dead' && p.connected) {
      const [x, y] = this.map.move(lead.x, lead.y, HUMAN_R, 0, 0);
      p.x = x; p.y = y; p.input.x = x; p.input.y = y; p.tp++;
      p.state = 'alive'; p.hp = 60; p.downT = 0; p.reviveT = 0;
      p.reloadT = 0; p.fireCd = 0; p.hurtT = 0;
      this.supportController.reset(p, this);
      this.emit({ e: 'revived', id: p.id, by: '' });
    }
  }

  private updateWaves(dt: number) {
    for (const w of [...this.waves]) {
      w.t -= dt;
      if (w.t > 0) continue;
      w.t = w.interval;
      const pts = this.objects('spawner', w.group);
      if (!pts.length) { w.left = 0; this.waves.splice(this.waves.indexOf(w), 1); continue; }
      const pt = this.pickSpawner(pts, w);
      if (!pt) { w.t = 0.25; continue; } // every spawner is on someone's screen: wait a moment
      const type = this.rng.pick(w.types);
      const ang = this.rng.range(0, TAU), r = this.rng.range(0, 18);
      this.spawnEnemy(type, pt.cx + Math.cos(ang) * r, pt.cy + Math.sin(ang) * r, { aggro: w.aggro, how: (pt.props.how as any) || 'vent', tag: w.tag });
      w.left--;
      if (w.left <= 0) this.waves.splice(this.waves.indexOf(w), 1);
    }
  }

  /** Is a point (a body standing there) on any player's screen? Generous: desktop ≈ 15×10 tiles + camera lead, phones wider. */
  onScreen(x: number, y: number) {
    for (const p of this.players) {
      if (!p.connected || p.state === 'dead') continue;
      const dx = Math.abs(x - p.x), dy = y - p.y;
      if (dx < 820 && dy > -560 && dy < 480) return true;
    }
    return false;
  }

  /**
   * Enemies never pop out of thin air in view: use a spawner of the group nobody can see; otherwise the closest
   * hidden spawner of any group that still has a path to the players; after ~3 s of waiting, the group's own one.
   */
  private pickSpawner(pts: MapObject[], w: Wave): MapObject | null {
    const hidden = pts.filter((o) => !this.onScreen(o.cx, o.cy));
    if (hidden.length) { w.waited = 0; return this.rng.pick(hidden); }
    let best: MapObject | null = null, bestD = 2600;
    for (const o of this.spawnersAll) {
      if (w.corridorOnly && !o.props.corridorOnly) continue;
      if (this.onScreen(o.cx, o.cy)) continue;
      const d = this.flow.distAt(o.cx, o.cy);
      if (d >= 900 && d < bestD) { bestD = d; best = o; }
    }
    if (best) return best;
    w.waited += 0.25;
    return w.waited >= 3 ? this.rng.pick(pts) : null;
  }
  private get spawnersAll() { return this.map.objects.filter((o) => o.type === 'spawner' && o.name !== 'boss_spawn'); }

  private updateTrails(dt: number) {
    this.trailT -= dt;
    if (this.trailT > 0) return;
    this.trailT = 0.2;
    for (const p of this.players) {
      const tr = this.trails.get(p.id);
      if (!tr) continue;
      const last = tr[tr.length - 1];
      if (!last || dist2(last.x, last.y, p.x, p.y) > 30 * 30) {
        tr.push({ x: p.x, y: p.y });
        if (tr.length > 60) tr.shift();
      }
    }
  }
  trail(id: string) { return this.trails.get(id) ?? []; }

  /** Survivors chickens hunt. Cowering ones are left alone until a player shows up (staged rescues). */
  npcTargetable(n: Npc) {
    if (n.mode === 'dead' || n.mode === 'gone') return false;
    if (n.mode === 'cower') return this.players.some((p) => p.state === 'alive' && dist(p.x, p.y, n.x, n.y) < 420);
    return true;
  }

  // ------------------------------------------------------------------ players
  setInput(id: string, inp: PlayerInput) {
    const p = this.players.find((q) => q.id === id);
    if (!p) return;
    this.supportController.input(p, inp.interact);
    // reload is an edge: keep it latched until consumed
    const reload = p.input.reload || inp.reload;
    p.input = { ...inp, reload };
  }

  resetInput(id: string) {
    const p = this.players.find(q => q.id === id);
    if (!p) return;
    p.input = { ...p.input, x: p.x, y: p.y, fire: false, reload: false, interact: false };
    this.supportController.reset(p, this);
  }

  private updatePlayer(p: Player, dt: number) {
    for (const kind of Object.keys(p.buffs ?? {}) as BuffKind[]) {
      p.buffs![kind] = Math.max(0, (p.buffs![kind] ?? 0) - dt);
      if (!p.buffs![kind]) delete p.buffs![kind];
    }
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.comboT -= dt;
    if (p.comboT <= 0) p.combo = 0;
    const inp = p.input;
    p.firing = false;

    if (p.state === 'dead') {
      this.supportController.reset(p, this);
      return;
    }
    if (p.state === 'downed') {
      p.downT -= dt * (p.reviveT > 0 ? 0.25 : 1);
      // crawl slowly
      this.acceptMove(p, inp.x, inp.y, dt, 50);
      this.supportController.reset(p, this);
      if (p.downT <= 0) { p.state = 'dead'; p.reviveT = 0; }
      return;
    }

    const def0 = WEAPONS[p.weapons[p.cur]];
    const speed = (p.state === 'chicken' ? PLAYER.chickenSpeed : PLAYER.speed) * def0.speedMul * ((p.buffs?.sprint ?? 0) > 0 ? 1.6 : 1);
    this.acceptMove(p, inp.x, inp.y, dt, speed);
    p.aim = inp.aim;
    const helping = this.supportController.update(this, p, dt, () => this.interact(p));

    // weapon switch
    if (inp.weapon >= 0 && inp.weapon < p.weapons.length && inp.weapon !== p.cur) {
      p.cur = inp.weapon; p.reloadT = 0; p.fireCd = Math.max(p.fireCd, 0.12); p.bloom = 0;
    }
    const w = p.weapons[p.cur];
    const def = WEAPONS[w];
    const ammo = p.ammo[w] ?? (p.ammo[w] = { mag: def.mag, reserve: def.reserveMax });
    p.fireCd -= dt;
    p.bloom = Math.max(0, p.bloom - dt * 0.35);
    const infinite = (p.buffs?.infinite ?? 0) > 0;
    if (infinite) p.reloadT = 0;

    // reload
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const need = def.mag - ammo.mag;
        const take = ammo.reserve < 0 ? need : Math.min(need, ammo.reserve);
        ammo.mag += take;
        if (ammo.reserve >= 0) ammo.reserve -= take;
      }
    } else if (!infinite && ((inp.reload && ammo.mag < def.mag && ammo.reserve !== 0) || (ammo.mag === 0 && ammo.reserve !== 0))) {
      p.reloadT = def.reload;
      this.emit({ e: 'reload', id: p.id, w });
    }
    inp.reload = false;

    // fire
    if (!helping && inp.fire && p.reloadT <= 0 && (ammo.mag > 0 || infinite)) {
      let guard = 0;
      while (p.fireCd <= 0 && (ammo.mag > 0 || infinite) && guard++ < 4) {
        this.fire(p, w);
        if (!infinite) ammo.mag = Math.max(0, ammo.mag - 1);
        p.fireCd += 1 / def.rof;
        p.firing = true;
      }
      if (p.fireCd > 0) p.firing = true;
    }
    if (p.fireCd < 0) p.fireCd = 0;

    // interact with NPCs (toggle follow), locked doors, use-objects

    // chicken player: hurt by nothing special, can't pick up stuff
  }

  private acceptMove(p: Player, x: number, y: number, dt: number, speed: number) {
    const d = dist(p.x, p.y, x, y);
    const maxD = speed * dt * 1.8 + 24;
    if (d <= maxD) {
      p.vx = (x - p.x) / Math.max(dt, 1e-3); p.vy = (y - p.y) / Math.max(dt, 1e-3);
      p.x = x; p.y = y;
    } else {
      // too far: move towards claimed position at max speed (anti-teleport)
      const k = (speed * dt * 1.3) / d;
      [p.x, p.y] = this.map.move(p.x, p.y, HUMAN_R, (x - p.x) * k, (y - p.y) * k);
    }
  }

  private interactCd = new Map<string, number>();
  private interact(p: Player) {
    const last = this.interactCd.get(p.id) ?? -1;
    if (this.time - last < 0.4) return;
    // NPC
    // companions always follow: they never take the action key, so doors/terminals next to them stay usable
    for (const n of this.npcs) {
      if (n.mode === 'dead' || n.mode === 'gone' || n.mode === 'follow' || n.mutation || dist(n.x, n.y, p.x, p.y) > 80 || !this.map.lineOfSight(p.x, p.y, n.x, n.y, false)) continue;
      this.interactCd.set(p.id, this.time);
      const r = this.script.onNpcUse?.(this, n, p);
      if (r === true) return;
      if (n.rescued || n.weapon) {
        n.mode = 'follow'; n.follow = p.id;
        this.say(n.id, n.weapon ? this.rng.pick(['Я с тобой! Прикрою.', 'Веди, я стреляю.', 'Пошли, покажем им KPI.']) : this.rng.pick(['Иду за тобой!', 'Только не бросай меня!']));
      } else if (n.lines.length) {
        this.say(n.id, this.rng.pick(n.lines));
      }
      return;
    }
    // use objects (terminals, switches) and locked doors
    for (const o of this.map.objects) {
      if (o.type !== 'use') continue;
      if (dist(o.cx, o.cy, p.x, p.y) > 90) continue;
      this.interactCd.set(p.id, this.time);
      this.script.onUse?.(this, o.name, p);
      return;
    }
    for (const d of this.doors) {
      if (d.open || !d.locked) continue;
      if (dist(d.x + d.w / 2, d.y + d.h / 2, p.x, p.y) > 115) continue;
      this.interactCd.set(p.id, this.time);
      if (p.keys.includes(d.locked)) { this.openDoor(d.id); this.say(p.id, 'Пропуск подошёл.'); }
      else if (d.locked === 'script') this.say(p.id, this.rng.pick(['Заперто. Надо найти другой путь.', 'Не открывается.']));
      else this.say(p.id, 'Нужен пропуск: ' + keyName(d.locked));
      return;
    }
  }

  cure(p: Player) {
    const saved = p.saved;
    p.state = 'alive'; p.hp = p.maxHp = PLAYER.hp; p.downT = 0; p.reviveT = 0;
    if (saved) { p.weapons = saved.weapons; p.ammo = saved.ammo; }
    p.cur = Math.min(p.cur, p.weapons.length - 1);
    this.emit({ e: 'cured', id: p.id });
  }

  damagePlayer(p: Player, dmg: number, fx: number, fy: number) {
    if (p.state !== 'alive' && p.state !== 'chicken') return;
    if (this.god || (p.buffs?.invincible ?? 0) > 0) return;
    if (p.state === 'alive' && p.armor > 0) {
      const absorb = Math.min(p.armor, dmg * 0.6);
      p.armor -= absorb; dmg -= absorb;
    }
    p.hp -= dmg;
    p.hurtT = 0.25;
    this.emit({ e: 'pdmg', id: p.id, d: dmg, x: fx, y: fy });
    if (p.hp > 0) return;
    p.hp = 0;
    p.deaths++;
    if (p.state === 'chicken') {
      p.state = 'dead'; p.respawnT = PLAYER.chickenRespawn;
      this.emit({ e: 'kill', id: -1, x: p.x, y: p.y, a: Math.atan2(p.y - fy, p.x - fx), t: 'normal', v: 0, gib: true, by: '', burn: false });
      return;
    }
    if (this.opts.solo) {
      p.state = 'dead';
      this.emit({ e: 'down', id: p.id });
      this.after(1.6, () => this.gameOver('Вас заклевали. Корпорация выражает соболезнования.'));
      return;
    }
    p.state = 'downed'; p.downT = PLAYER.bleedout; p.reviveT = 0;
    this.emit({ e: 'down', id: p.id });
    this.say(p.id, 'Я ранен! Поднимите меня, пока не закукарекал!');
  }

  private checkLose() {
    if (this.opts.solo || this.finished || !this.players.length) return;
    if (this.players.every((p) => p.state !== 'alive' || !p.connected)) {
      this.gameOver('Курицы победили. Все сотрудники оптимизированы.');
    }
  }

  // ------------------------------------------------------------------ shooting
  /** Entities that `team` can hit. */
  private victims(team: Team) {
    const list: { kind: 'enemy' | 'player' | 'npc' | 'barrel' | 'pod' | 'dprop'; ref: any; x: number; y: number; r: number; box: BodyBox }[] = [];
    if (team === 'human') {
      for (const e of this.enemies) if (e.state !== 'rise') list.push({ kind: 'enemy', ref: e, x: e.x, y: e.y, r: ENEMIES[e.type].radius + 3, box: enemyBox(e.type) });
      for (const p of this.players) if (p.state === 'chicken') list.push({ kind: 'player', ref: p, x: p.x, y: p.y, r: HUMAN_R + 4, box: HUMAN_BOX });
    } else {
      for (const p of this.players) if (p.state === 'alive') list.push({ kind: 'player', ref: p, x: p.x, y: p.y, r: HUMAN_R + 2, box: HUMAN_BOX });
      for (const n of this.npcs) if (n.mode !== 'dead' && n.mode !== 'gone') list.push({ kind: 'npc', ref: n, x: n.x, y: n.y, r: HUMAN_R + 2, box: HUMAN_BOX });
    }
    for (const b of this.barrels) list.push({ kind: 'barrel', ref: b, x: b.x, y: b.y, r: 18, box: BARREL_BOX });
    if (team === 'human') for (const p of this.pods) if (!p.broken) list.push({ kind: 'pod', ref: p, x: p.x, y: p.y, r: 22, box: POD_BOX });
    for (const d of this.dprops) if (!d.blocksBullets) list.push({ kind: 'dprop', ref: d, x: d.x, y: d.y, r: d.box.hw, box: d.box });
    return list;
  }

  fire(p: Player, w: WeaponId) { this.fireFrom(p.id, p.state === 'chicken' ? 'chicken' : 'human', w, p.x, p.y, p.aim, p, (p.buffs?.damage ?? 0) > 0 ? 3 : 1); }

  /** Shared by players and armed NPCs. */
  fireFrom(owner: string, team: Team, w: WeaponId, x: number, y: number, aim: number, p: Player | null, dmgMul: number) {
    const def = WEAPONS[w];
    const bloom = p ? p.bloom : 0.02;
    if (p) p.bloom = Math.min(def.maxBloom, p.bloom + def.bloom);
    this.noise(x, y, 750);
    if (def.kind === 'grenade') {
      const a = aim + this.rng.range(-def.spread, def.spread);
      const sp = def.projSpeed!;
      const pr = this.addProjectile('grenade', x + Math.cos(a) * 30, y + Math.sin(a) * 30, Math.cos(a) * sp, Math.sin(a) * sp, owner, team, def.damage * dmgMul, 1.1);
      this.emit({ e: 'shot', o: owner, w, x, y, a: aim, ends: [], team });
      return pr;
    }
    if (def.kind === 'flame') {
      this.flameCone(owner, team, x, y, aim, def.range, def.damage * dmgMul);
      // players' flames are drawn from their 'firing' flag; NPC flames need an event
      if (!p) this.emit({ e: 'shot', o: owner, w, x: Math.round(x), y: Math.round(y), a: aim, ends: [], team });
      return;
    }
    const ends: number[] = [];
    const victims = this.victims(team);
    for (let i = 0; i < def.pellets; i++) {
      const spread = def.spread + bloom;
      const a = aim + (def.pellets > 1 ? ((i + this.rng.next()) / def.pellets - 0.5) * 2 * spread : this.rng.range(-spread, spread));
      const range = def.range * (def.pellets > 1 ? this.rng.range(0.85, 1) : 1);
      const wall = this.map.raycast(x, y, a, range, true);
      const dx = Math.cos(a), dy = Math.sin(a);
      const hits: { t: number; v: (typeof victims)[number]; head: boolean }[] = [];
      for (const v of victims) {
        // quick reject
        const px = v.x - x, py = v.y - y;
        if (Math.abs(px) > wall.d + v.box.h + 40 || Math.abs(py) > wall.d + v.box.h + 40) continue;
        const h = rayBody(x, y, dx, dy, v.x, v.y, v.box, wall.d);
        if (h) hits.push({ t: h.t, v, head: h.head });
      }
      hits.sort((a1, b1) => a1.t - b1.t);
      let endT = wall.d;
      let pierce = def.pierce;
      let dmg = def.damage * dmgMul;
      for (const h of hits) {
        // headshots: double damage (boss ×1.4)
        const head = h.head && (h.v.kind === 'enemy' || h.v.kind === 'player');
        const hm = head ? (h.v.kind === 'enemy' && h.v.ref.type === 'boss' ? 1.4 : 2) : 1;
        this.applyHit(h.v, dmg * hm, a, def.knockback, owner, x + dx * h.t, y + dy * h.t, head);
        if (h.v.kind === 'barrel' || h.v.kind === 'pod' || h.v.kind === 'dprop') { endT = h.t; break; }
        if (pierce-- <= 0) { endT = h.t; break; }
        dmg *= 0.7;
      }
      if (endT === wall.d && wall.what === 'prop') { const d = this.dprops.find((q) => q.id === wall.id); if (d) this.damageProp(d, dmg); }
      if (endT === wall.d && wall.what !== 'none') {
        this.emit({ e: 'hit', x: x + dx * wall.d, y: y + dy * wall.d, a: Math.atan2(wall.ny, wall.nx), k: wall.what === 'wall' ? 'wall' : 'prop', d: 0 });
      }
      ends.push(Math.round(x + dx * endT), Math.round(y + dy * endT));
    }
    this.emit({ e: 'shot', o: owner, w, x: Math.round(x), y: Math.round(y), a: aim, ends, team });
  }

  private applyHit(v: { kind: string; ref: any }, dmg: number, a: number, knock: number, owner: string, hx: number, hy: number, head = false) {
    if (v.kind === 'enemy') this.damageEnemy(v.ref, dmg, a, knock, owner, 'bullet', hx, hy, head);
    else if (v.kind === 'barrel') this.damageBarrel(v.ref, dmg, owner);
    else if (v.kind === 'pod') { this.emit({ e: 'hit', x: hx, y: hy, a, k: 'prop', d: dmg }); this.damagePod(v.ref, dmg); }
    else if (v.kind === 'dprop') { this.emit({ e: 'hit', x: hx, y: hy, a, k: 'prop', d: 0 }); this.damageProp(v.ref, dmg); }
    else if (v.kind === 'player') {
      this.emit({ e: 'hit', x: hx, y: hy, a, k: 'player', d: dmg, id: v.ref.id });
      this.damagePlayer(v.ref, dmg * (v.ref.state === 'chicken' ? 1 : 0.55), hx - Math.cos(a) * 50, hy - Math.sin(a) * 50);
      const shooter = this.players.find((q) => q.id === owner);
      if (shooter && v.ref.hp <= 0) { shooter.kills++; shooter.score += 50; }
    } else if (v.kind === 'npc') {
      this.emit({ e: 'hit', x: hx, y: hy, a, k: 'npc', d: dmg, id: v.ref.id });
      this.damageNpc(v.ref, dmg * 0.6);
    }
  }

  private flameCone(owner: string, team: Team, x: number, y: number, aim: number, range: number, dmg: number) {
    const half = 0.32;
    for (const v of this.victims(team)) {
      const d = dist(x, y, v.x, v.y);
      if (d > range + v.r) continue;
      const a = Math.atan2(v.y - y, v.x - x);
      if (Math.abs(angleDiff(aim, a)) > half + Math.atan2(v.r, Math.max(d, 1))) continue;
      if (!this.map.lineOfSight(x, y, v.x, v.y, true)) continue;
      if (v.kind === 'enemy') {
        const e = v.ref as Enemy;
        e.burnT = 3;
        this.damageEnemy(e, dmg, a, WEAPONS.flamethrower.knockback, owner, 'fire', v.x, v.y);
      } else this.applyHit(v, dmg * 0.7, a, 0, owner, v.x, v.y);
    }
  }

  damageEnemy(e: Enemy, dmg: number, a: number, knock: number, by: string, kind: 'bullet' | 'explosion' | 'fire' | 'melee', hx = e.x, hy = e.y, head = false) {
    if (e.hp <= 0) return;
    const def = ENEMIES[e.type];
    let armored = false;
    if (def.armor > 0) {
      const red = kind === 'bullet' ? def.armor : def.armor * 0.3;
      dmg *= 1 - red;
      armored = kind === 'bullet';
    }
    if (e.state === 'rise') dmg *= 0.5;
    e.hp -= dmg;
    e.flashT = 0.09;
    e.aggro = true;
    e.dormant = false;
    if (kind !== 'fire') {
      e.stunT = Math.max(e.stunT, e.type === 'boss' ? 0 : 0.07);
      const k = knock / def.mass;
      e.vx += Math.cos(a) * k; e.vy += Math.sin(a) * k;
      this.emit({ e: 'hit', x: Math.round(hx), y: Math.round(hy), a, k: armored ? 'armor' : 'flesh', d: Math.round(dmg), id: e.id, big: kind === 'explosion', o: by, ...(head ? { hs: true } : {}) });
    }
    if (e.hp <= 0) this.killEnemy(e, a, by, kind === 'explosion' || dmg > 60, kind === 'fire', head);
  }

  killEnemy(e: Enemy, a: number, by: string, gib: boolean, burn: boolean, head = false) {
    const idx = this.enemies.indexOf(e);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);
    const tag = this.enemyTags.get(e.id);
    this.enemyTags.delete(e.id);
    this.emit({ e: 'kill', id: e.id, x: Math.round(e.x), y: Math.round(e.y), a, t: e.type, v: e.variant, gib, by, burn, ...(head ? { hs: true } : {}) });
    const p = this.players.find((q) => q.id === by);
    if (p) {
      p.kills++;
      p.combo++; p.comboT = 2.2;
      p.score += ENEMIES[e.type].score * (1 + Math.min(p.combo, 50) * 0.05);
    }
    // drops
    const r = this.rng.next();
    if (['fat', 'armored', 'spitter', 'exploder'].includes(e.type) && this.rng.chance(.28)) {
      this.addPickup(this.rng.pick(Object.keys(BUFFS) as BuffKind[]), e.x + 18, e.y, { ttl: 20 });
    }
    if (e.type !== 'chick') {
      if (r < 0.07) this.addPickup('ammo', e.x, e.y);
      else if (r < 0.1) this.addPickup('health', e.x, e.y);
      else if (r < 0.11) this.addPickup('armor', e.x, e.y);
    }
    if (e.type === 'exploder') this.after(0.05, () => this.explode(e.x, e.y, 150, 90, by, 'exploder'));
    if (e.type === 'fat') {
      for (let i = 0; i < 3; i++) {
        const aa = a + (i - 1) * 0.9;
        this.spawnEnemy('chick', e.x + Math.cos(aa) * 20, e.y + Math.sin(aa) * 20, { aggro: true, tag }).vx = Math.cos(aa) * 250;
      }
    }
    if (e.type === 'boss') this.script.onBossDead?.(this, e);
    this.script.onKill?.(this, e, tag);
  }

  damageBarrel(b: Barrel, dmg: number, by: string) {
    if (b.hp <= 0) return;
    b.hp -= dmg;
    if (b.hp <= 0) {
      this.barrels.splice(this.barrels.indexOf(b), 1);
      const c = this.map.colliders.find((c1) => c1.id === -b.id);
      if (c) this.map.removeCollider(c);
      this.after(0.06, () => this.explode(b.x, b.y, 170, 140, by, 'barrel'));
    }
  }

  damagePod(p: Pod, dmg: number) {
    if (p.broken) return;
    p.hp -= dmg;
    if (p.hp <= 0) this.hatchPod(p);
  }
  hatchPod(p: Pod) {
    if (p.broken) return;
    p.broken = true;
    this.emit({ e: 'splat', x: Math.round(p.x), y: Math.round(p.y), k: 'egg' });
    if (p.hatch !== 'none') this.spawnEnemy(p.hatch as EnemyType, p.x, p.y + 30, { how: 'egg', aggro: true, tag: p.tag });
  }
  /** Script: hatch all pods with tag over a short random spread. */
  hatchPods(tag: string, spread = 2) {
    for (const p of this.pods) if (p.tag === tag && !p.broken) this.after(this.rng.range(0, spread), () => this.hatchPod(p));
  }

  damageNpc(n: Npc, dmg: number) {
    if (n.props?.essential) { n.hp = Math.max(1, n.hp - dmg); n.hurtT = .2; return; }
    if (n.mode === 'dead' || n.mode === 'gone') return;
    n.hp -= dmg;
    n.hurtT = 0.2;
    if (n.hp <= 0) {
      n.mode = 'dead';
      this.script.onNpcLost?.(this, n);
      this.emit({ e: 'npcdie', id: n.id, x: n.x, y: n.y });
      this.script.onNpcDead?.(this, n);
    }
  }

  explode(x: number, y: number, r: number, dmg: number, by: string, k: 'gl' | 'barrel' | 'exploder' | 'boss') {
    this.emit({ e: 'boom', x: Math.round(x), y: Math.round(y), r, k });
    this.noise(x, y, 1000);
    for (const e of [...this.enemies]) {
      const d = dist(x, y, e.x, e.y);
      const er = ENEMIES[e.type].radius;
      if (d > r + er) continue;
      if (!this.map.lineOfSight(x, y, e.x, e.y, true) && d > 40) continue;
      const f = 1 - clamp((d - er) / r, 0, 1) * 0.6;
      this.damageEnemy(e, dmg * f, Math.atan2(e.y - y, e.x - x), 600 * f, by, 'explosion');
    }
    const fromPlayer = this.players.some((p) => p.id === by);
    for (const p of this.players) {
      const d = dist(x, y, p.x, p.y);
      if (d > r) continue;
      if (!this.map.lineOfSight(x, y, p.x, p.y, true)) continue;
      const f = 1 - clamp(d / r, 0, 1) * 0.7;
      if (p.state === 'chicken') { this.damagePlayer(p, dmg * f, x, y); continue; }
      const mul = fromPlayer ? (p.id === by ? 0.2 : 0) : k === 'barrel' ? 0.35 : 0.5;
      if (mul > 0) this.damagePlayer(p, dmg * f * mul, x, y);
    }
    for (const n of this.npcs) {
      const d = dist(x, y, n.x, n.y);
      if (d < r && !fromPlayer) this.damageNpc(n, dmg * 0.3 * (1 - d / r));
    }
    for (const b of [...this.barrels]) if (dist(x, y, b.x, b.y) < r * 0.85) this.damageBarrel(b, 100, by);
    for (const p of this.pods) if (!p.broken && dist(x, y, p.x, p.y) < r * 0.8) this.damagePod(p, 100);
    for (const d of [...this.dprops]) if (dist(x, y, d.x, d.y) < r * 0.9) this.damageProp(d, dmg * 1.5);
  }

  damageProp(d: World['dprops'][number], dmg: number) {
    if (d.hp <= 0) return;
    d.hp -= dmg;
    if (d.hp > 0) return;
    this.dprops.splice(this.dprops.indexOf(d), 1);
    this.broken.push(d.id);
    const c = this.map.colliders.find((q) => q.id === d.id);
    if (c) { this.map.removeCollider(c); this.flow.rebuildBlocked(); }
    this.emit({ e: 'propbreak', id: d.id, x: Math.round(d.x), y: Math.round(d.y), m: d.mat });
    this.noise(d.x, d.y, 400);
    const r = this.rng.next();
    if (d.drop === 'crate') { if (r < 0.3) this.addPickup('ammo', d.x, d.y + 6); else if (r < 0.42) this.addPickup('health', d.x, d.y + 6); }
    if (d.drop === 'vending' && r < 0.6) this.addPickup('health', d.x, d.y + 22);
  }

  /** Gunfire / explosions wake chickens up. */
  noise(x: number, y: number, r: number) {
    const r2 = r * r;
    for (const e of this.enemies) if (!e.aggro && dist2(x, y, e.x, e.y) < r2) { e.aggro = true; e.dormant = false; }
  }

  // ------------------------------------------------------------------ projectiles
  addProjectile(kind: ProjKind, x: number, y: number, vx: number, vy: number, owner: string, team: Team, dmg: number, ttl: number) {
    const pr: Projectile = { id: this.nextId++, kind, x, y, vx, vy, ttl, owner, team, dmg, r: kind === 'grenade' ? 7 : kind === 'egg' ? 10 : 9 };
    this.projectiles.push(pr);
    this.emit({ e: 'proj', id: pr.id, k: kind, x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy) });
    return pr;
  }

  private updateProjectiles(dt: number) {
    for (const pr of [...this.projectiles]) {
      pr.ttl -= dt;
      const sp = Math.hypot(pr.vx, pr.vy);
      const a = Math.atan2(pr.vy, pr.vx);
      const stepD = sp * dt;
      const wall = this.map.raycast(pr.x, pr.y, a, stepD + pr.r, true);
      let hitT = wall.what !== 'none' ? Math.max(0, wall.d - pr.r) : Infinity;
      let victim: any = null;
      if (pr.kind !== 'egg') {
        for (const v of this.victims(pr.team)) {
          if (v.kind === 'barrel' && pr.kind === 'spit') continue;
          const t = rayCircle(pr.x, pr.y, Math.cos(a), Math.sin(a), v.x, v.y, v.r + pr.r);
          if (t >= 0 && t <= stepD && t < hitT) { hitT = t; victim = v; }
        }
      }
      if (hitT <= stepD || pr.ttl <= 0) {
        const t = Math.min(hitT, stepD);
        pr.x += Math.cos(a) * t; pr.y += Math.sin(a) * t;
        this.projectiles.splice(this.projectiles.indexOf(pr), 1);
        if (pr.kind === 'grenade') {
          this.explode(pr.x, pr.y, WEAPONS.grenade.splash!, pr.dmg, pr.owner, 'gl');
        } else if (pr.kind === 'spit') {
          this.emit({ e: 'splat', x: Math.round(pr.x), y: Math.round(pr.y), k: 'spit' });
          if (victim) this.applyHit(victim, pr.dmg / 0.55, a, 0, pr.owner, pr.x, pr.y);
        } else if (pr.kind === 'egg') {
          this.emit({ e: 'splat', x: Math.round(pr.x), y: Math.round(pr.y), k: 'egg' });
          this.spawnEnemy('chick', pr.x, pr.y, { aggro: true, how: 'egg', tag: 'boss' });
        }
        continue;
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.kind === 'egg') { pr.vx *= 1 - dt * 1.6; pr.vy *= 1 - dt * 1.6; }
    }
  }

  // ------------------------------------------------------------------ pickups, doors, triggers
  private pickupReach = new WeakMap<Pickup, number>();
  /** Items lying on furniture (a table, a counter) are picked up from its edge. */
  reachOf(k: Pickup) {
    let r = this.pickupReach.get(k);
    if (r === undefined) { r = pickupReach(this.map, k.x, k.y); this.pickupReach.set(k, r); }
    return r;
  }
  private updatePickups(dt: number) {
    for (const k of [...this.pickups]) {
      if (k.ttl > 0) { k.ttl -= dt; if (k.ttl <= 0) { this.pickups.splice(this.pickups.indexOf(k), 1); continue; } }
      const reach = this.reachOf(k);
      for (const p of this.players) {
        if (p.state !== 'alive' || dist2(p.x, p.y, k.x, k.y) > reach * reach) continue;
        if (this.tryPickup(p, k)) { this.pickups.splice(this.pickups.indexOf(k), 1); break; }
      }
    }
  }

  private tryPickup(p: Player, k: Pickup) {
    let text = '';
    if (k.kind in BUFFS) {
      const kind = k.kind as BuffKind;
      (p.buffs ??= {})[kind] = BUFF_SECONDS;
      text = BUFFS[kind].name + ' · 10 секунд';
    }
    switch (k.kind) {
      case 'health':
        if (p.hp >= p.maxHp && p.supplies.medkit >= 1) return false;
        p.supplies.medkit = 1;
        p.hp = Math.min(p.maxHp, p.hp + 35); text = 'Аптечка · +35 здоровья';
        break;
      case 'armor':
        if (p.armor >= 100) return false;
        p.armor = Math.min(100, p.armor + 50); text = '+50 брони';
        break;
      case 'ammo': {
        let any = p.supplies.ammo < 1;
        p.supplies.ammo = 1;
        for (const w of p.weapons) {
          const def = WEAPONS[w], a = p.ammo[w]!;
          if (a.reserve < 0 || a.reserve >= def.reserveMax) continue;
          a.reserve = Math.min(def.reserveMax, a.reserve + Math.ceil(def.pickupAmmo * 0.6));
          any = true;
        }
        if (!any) return false;
        text = 'Патроны';
        break;
      }
      case 'weapon': {
        if (!k.weapon) return false;
        const had = p.weapons.includes(k.weapon);
        if (had) {
          const a = p.ammo[k.weapon]!, def = WEAPONS[k.weapon];
          if (a.reserve >= def.reserveMax) return false;
        }
        this.giveWeapon(p, k.weapon, !had);
        text = had ? 'Патроны: ' + WEAPONS[k.weapon].name : WEAPONS[k.weapon].name;
        break;
      }
      case 'keycard':
        p.keys.push(k.key || 'card');
        for (const q of this.players) if (!q.keys.includes(k.key || 'card')) q.keys.push(k.key || 'card');
        text = 'Пропуск: ' + keyName(k.key || 'card');
        break;
      case 'antidote':
        text = 'Антидот';
        break;
      case 'achievement':
        for (const q of this.players) if (!(q.achievements ??= []).includes(k.key || 'root_rooster')) q.achievements.push(k.key || 'root_rooster');
        text = '🏆 Ачивка: Рутовый петушок';
        this.msg('РУТОВЫЙ ПЕТУШОК', 'Ачивка получена всей командой · sudo отпуск', 4);
        break;
    }
    this.emit({ e: 'pick', id: p.id, k: k.kind, w: k.weapon, text });
    this.script.onPickup?.(this, k, p);
    return true;
  }

  private updateDoors() {
    for (const d of this.doors) {
      if (d.locked) continue;
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      let near = false;
      for (const p of this.players) if ((p.state === 'alive' || p.state === 'chicken') && dist2(p.x, p.y, cx, cy) < 110 * 110) near = true;
      if (!near) for (const n of this.npcs) if (n.mode !== 'dead' && n.mode !== 'gone' && dist2(n.x, n.y, cx, cy) < 100 * 100) near = true;
      if (!near) for (const e of this.enemies) if (e.aggro && dist2(e.x, e.y, cx, cy) < 90 * 90) near = true;
      if (near !== d.open) {
        d.open = near;
        const c = this.doorColliders.get(d.id);
        if (c) c.open = near;
        this.emit({ e: 'door', id: d.id, open: near });
      }
    }
  }

  private updateTriggers() {
    for (const o of this.map.objects) {
      if (o.type !== 'trigger' || this.firedTriggers.has(o.name)) continue;
      let who: Player | null = null;
      if (o.props.npc) {
        const n = this.npcs.find((q) => q.tag === o.props.npc || q.id === o.props.npc);
        if (n && n.mode !== 'dead' && inRect(n.x, n.y, o)) who = this.anyPlayer;
      } else {
        const need = o.props.all ? this.players.filter((p) => p.state === 'alive') : null;
        if (need) { if (need.length && need.every((p) => inRect(p.x, p.y, o))) who = need[0]; }
        else who = this.players.find((p) => p.state === 'alive' && inRect(p.x, p.y, o)) ?? null;
      }
      if (!who) { this.insideTriggers.delete(o.name); continue; }
      if (o.props.once === false) {
        // repeatable triggers fire on enter only
        if (this.insideTriggers.has(o.name)) continue;
        this.insideTriggers.add(o.name);
      } else this.firedTriggers.add(o.name);
      if (o.props.say) this.say(o.props.who || who.id, o.props.say);
      this.script.onTrigger?.(this, o.name, who);
    }
  }

  /** Push overlapping enemies apart (spatial hash). */
  private separate() {
    const cell = 64;
    const grid = new Map<number, Enemy[]>();
    for (const e of this.enemies) {
      const k = Math.floor(e.x / cell) * 4096 + Math.floor(e.y / cell);
      let b = grid.get(k); if (!b) grid.set(k, (b = [])); b.push(e);
    }
    for (const e of this.enemies) {
      const cx = Math.floor(e.x / cell), cy = Math.floor(e.y / cell);
      const re = ENEMIES[e.type].radius;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const b = grid.get((cx + dx) * 4096 + cy + dy);
        if (!b) continue;
        for (const o of b) {
          if (o === e) continue;
          const ro = ENEMIES[o.type].radius;
          const ddx = e.x - o.x, ddy = e.y - o.y, d2 = ddx * ddx + ddy * ddy, m = (re + ro) * 0.85;
          if (d2 >= m * m || d2 < 1e-4) continue;
          const d = Math.sqrt(d2), push = (m - d) * 0.5;
          const wE = ENEMIES[o.type].mass / (ENEMIES[e.type].mass + ENEMIES[o.type].mass);
          e.x += (ddx / d) * push * wE * 2; e.y += (ddy / d) * push * wE * 2;
        }
      }
    }
  }

  /** Companions keep personal space from each other and from players instead of stacking on one spot. */
  private separateNpcs() {
    const live = this.npcs.filter((n) => n.mode !== 'dead' && n.mode !== 'gone' && n.mode !== 'cower' && !n.mutation);
    for (const n of live) {
      if (n.mode !== 'follow' && n.mode !== 'goto') continue;
      let px = 0, py = 0;
      const push = (ox: number, oy: number, min: number, k: number) => {
        const dx = n.x - ox, dy = n.y - oy, d2 = dx * dx + dy * dy;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2) || 0.01, f = (min - d) * k;
        px += d2 < 1e-4 ? (n.id.length % 2 ? f : -f) : (dx / d) * f; py += d2 < 1e-4 ? 0 : (dy / d) * f;
      };
      for (const o of live) if (o !== n) push(o.x, o.y, 46, 0.25);
      for (const p of this.players) if (p.state === 'alive' || p.state === 'downed') push(p.x, p.y, 40, 0.3);
      if (px || py) [n.x, n.y] = this.map.move(n.x, n.y, 14, px, py);
    }
  }

  /** Developer helpers (solo): every weapon with full reserve, kill every enemy. */
  devArsenal(p: Player) {
    for (const w of WEAPON_ORDER) { this.giveWeapon(p, w, false); const a = p.ammo[w]!, def = WEAPONS[w]; a.mag = def.mag; if (a.reserve >= 0) a.reserve = def.reserveMax; }
    p.supplies = { medkit: 1, ammo: 1 }; p.hp = p.maxHp; p.armor = 100;
  }
  devKillAll(by: string) {
    this.waves.length = 0;
    for (const e of [...this.enemies]) this.killEnemy(e, 0, by, false, false);
  }

  view(): WorldView { return this; }
}

/** Pickup radius from the feet: 34 on open floor, up to 84 when the item lies on a solid prop. */
export function pickupReach(map: GameMap, x: number, y: number) {
  return map.blockedAt(x, y, 14) ? 84 : 34;
}

function inRect(x: number, y: number, o: MapObject) { return x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h; }

export function keyName(k: string) {
  return ({ red: 'красный', blue: 'синий', yellow: 'жёлтый', lab: 'лаборатории', ceo: 'гендиректора', server: 'серверной' } as Record<string, string>)[k] ?? k;
}

export { TILE };
