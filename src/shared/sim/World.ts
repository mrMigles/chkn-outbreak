// Authoritative game simulation. Runs in the browser (solo) or in a Colyseus room (multiplayer).
import { GameMap, MapObject, Collider, rayCircle, TILE } from '../map';
import { FlowField } from '../nav';
import { ENEMIES, EnemyType, PLAYER } from '../enemies';
import { WEAPONS, WeaponId, WEAPON_ORDER } from '../weapons';
import { Rng, angleDiff, clamp, dist, dist2, TAU } from '../math';
import type {
  Player, Enemy, Npc, Projectile, Pickup, Door, Barrel, Pod, SimEvent, PlayerInput, Team, WorldView, PickupKind, ProjKind,
} from './types';
import { updateEnemy } from './enemyAI';
import { updateNpc } from './npcAI';
import type { LevelScript } from '../levels/types';

export interface CarryNpc { id: string; kind: string; name: string; weapon: WeaponId | null; hp: number; maxHp: number }
export interface Carry {
  players: Record<string, { weapons: WeaponId[]; ammo: Player['ammo']; hp: number; armor: number }>;
  npcs: CarryNpc[];
}
export interface WorldOptions {
  solo: boolean;
  carry?: Carry;
  difficulty?: number;
}

interface Timer { t: number; fn: () => void; every?: number }
interface Wave { group: string; types: EnemyType[]; left: number; interval: number; t: number; aggro: boolean; tag: string }

const HUMAN_R = PLAYER.radius;

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
  objective = '';
  blackout = false;
  alarm = false;
  bossId = -1;
  events: SimEvent[] = [];
  flags: Record<string, any> = {};
  script: LevelScript;
  opts: WorldOptions;
  finished = false;
  over = false;

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

  constructor(map: GameMap, script: LevelScript, opts: WorldOptions) {
    this.map = map;
    this.mapId = map.id;
    this.script = script;
    this.opts = opts;
    for (const o of map.objects) this.loadObject(o);
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
          id: o.name || 'npc' + o.id, kind: o.props.kind || 'manBlue', name: o.props.title || o.name, x: cx, y: cy,
          angle: (o.props.angle ?? 90) * Math.PI / 180, hp: o.props.hp ?? 80, maxHp: o.props.hp ?? 80,
          mode: o.props.mode || 'idle', weapon: o.props.weapon || null, fireCd: 0, follow: null, goal: null,
          lines: o.props.lines ? String(o.props.lines).split('|') : [], talkCd: 2 + Math.random() * 4, tag: o.props.tag || o.name,
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

  addPlayer(id: string, name: string, slot: number) {
    const sp = this.spawnPoints.filter((s) => s.name === 'player');
    const s0 = sp[slot % Math.max(1, sp.length)];
    const s = s0 ? { x: s0.cx, y: s0.cy } : { x: 200, y: 200 };
    const carry = this.opts.carry?.players[id];
    const p: Player = {
      id, slot, name, x: s.x + (sp.length ? 0 : slot * 40), y: s.y, aim: 0, vx: 0, vy: 0,
      hp: carry?.hp ?? PLAYER.hp, maxHp: PLAYER.hp, armor: carry?.armor ?? 0, state: 'alive', downT: 0, reviveT: 0, respawnT: 0,
      weapons: carry?.weapons ? [...carry.weapons] : ['pistol'], cur: 0, ammo: carry?.ammo ? JSON.parse(JSON.stringify(carry.ammo)) : { pistol: { mag: 12, reserve: -1 } },
      reloadT: 0, fireCd: 0, bloom: 0, firing: false, shotSeq: 0,
      input: { seq: 0, x: s.x, y: s.y, aim: 0, fire: false, reload: false, interact: false, weapon: 0 },
      kills: 0, deaths: 0, score: 0, hurtT: 0, keys: [], combo: 0, comboT: 0, connected: true, tp: 0,
    };
    p.input.x = p.x; p.input.y = p.y;
    p.cur = Math.max(0, p.weapons.length - 1);
    for (const w of this.script.startWeapons ?? []) this.giveWeapon(p, w, false);
    this.players.push(p);
    this.trails.set(p.id, []);
    return p;
  }

  removePlayer(id: string) {
    this.players = this.players.filter((p) => p.id !== id);
    this.trails.delete(id);
    for (const n of this.npcs) if (n.follow === id) n.follow = null;
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
      });
    });
    this.script.onStart?.(this);
  }

  /** State that carries over into the next level. */
  carryOut(): Carry {
    const players: Carry['players'] = {};
    for (const p of this.players) {
      const src = p.state === 'alive' || !p.saved ? p : p.saved;
      players[p.id] = { weapons: [...src.weapons], ammo: JSON.parse(JSON.stringify(src.ammo)), hp: Math.max(60, p.state === 'alive' ? p.hp : 60), armor: p.armor };
    }
    const npcs = this.npcs.filter((n) => n.mode === 'follow').map((n) => ({ id: n.id, kind: n.kind, name: n.name, weapon: n.weapon, hp: Math.max(n.hp, n.maxHp * 0.6), maxHp: n.maxHp }));
    return { players, npcs };
  }

  // ------------------------------------------------------------------ script API
  emit(ev: SimEvent) { this.events.push(ev); }
  say(who: string, text: string, d = 3.2) { this.emit({ e: 'say', who, text, d }); }
  setObjective(text: string) { this.objective = text; this.emit({ e: 'obj', text }); }
  msg(text: string, sub?: string, d = 3) { this.emit({ e: 'msg', text, sub, d }); }
  after(t: number, fn: () => void) { this.timers.push({ t, fn }); }
  every(t: number, fn: () => void) { this.timers.push({ t, fn, every: t }); }
  /** Turn a survivor into a chicken (scripted infection). */
  infect(n: Npc, type: EnemyType = 'normal', tag = '') {
    if (n.mode === 'dead' || n.mode === 'gone') return null;
    n.mode = 'gone';
    return this.spawnEnemy(type, n.x, n.y, { how: 'egg', aggro: true, tag });
  }
  setBlackout(on: boolean) { this.blackout = on; this.emit({ e: 'blackout', on }); }
  setAlarm(on: boolean) { this.alarm = on; this.emit({ e: 'alarm', on }); }
  npc(id: string) { return this.npcs.find((n) => n.id === id); }
  object(name: string) { return this.map.objects.find((o) => o.name === name); }
  objects(type: string, name?: string) { return this.map.objects.filter((o) => o.type === type && (name === undefined || o.name === name)); }
  get humanPlayers() { return this.players.filter((p) => p.state === 'alive'); }
  get anyPlayer() { return this.humanPlayers[0] ?? this.players[0]; }

  spawnWave(group: string, types: EnemyType[], count: number, interval = 0.5, aggro = true, tag = '') {
    this.waves.push({ group, types, left: count, interval, t: 0, aggro, tag: tag || group });
  }
  /** Enemies alive with tag (wave group or map tag) + pending wave spawns. */
  countTag(tag: string) {
    let n = 0;
    for (const e of this.enemies) if (this.enemyTags.get(e.id) === tag) n++;
    for (const w of this.waves) if (w.tag === tag) n += w.left;
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
    const hpMul = type === 'boss' ? 0.6 + 0.4 * Math.max(1, this.players.length) : 1;
    const e: Enemy = {
      id: this.nextId++, type, variant: this.rng.int(0, def.sprite.length - 1), x, y, angle: this.rng.range(0, TAU), vx: 0, vy: 0,
      hp: def.hp * hpMul * diff, maxHp: def.hp * hpMul * diff, state: o.how ? 'rise' : 'idle', t: o.how ? 0.55 : 0, cd: this.rng.range(0, 0.6),
      aggro: !!o.aggro, target: null, speedMul: this.rng.range(0.9, 1.12), burnT: 0, stunT: 0, flashT: 0, wanderA: this.rng.range(0, TAU),
      phase: 0, abilityCd: 3, ability: '', dormant: !!o.dormant,
    };
    this.enemies.push(e);
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
    for (const n of this.npcs) updateNpc(this, n, dt);
    this.separate();
    for (const e of [...this.enemies]) updateEnemy(this, e, dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateDoors();
    this.updateTriggers();
    this.script.onTick?.(this, dt);
    this.checkLose();
  }

  private updateWaves(dt: number) {
    for (const w of [...this.waves]) {
      w.t -= dt;
      if (w.t > 0) continue;
      w.t = w.interval;
      const pts = this.objects('spawner', w.group);
      const pt = pts.length ? this.rng.pick(pts) : null;
      if (!pt) { w.left = 0; }
      else {
        const type = this.rng.pick(w.types);
        const ang = this.rng.range(0, TAU), r = this.rng.range(0, 18);
        this.spawnEnemy(type, pt.cx + Math.cos(ang) * r, pt.cy + Math.sin(ang) * r, { aggro: w.aggro, how: (pt.props.how as any) || 'vent', tag: w.tag });
        w.left--;
      }
      if (w.left <= 0) this.waves.splice(this.waves.indexOf(w), 1);
    }
  }

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
    // reload is an edge: keep it latched until consumed
    const reload = p.input.reload || inp.reload;
    p.input = { ...inp, reload };
  }

  private updatePlayer(p: Player, dt: number) {
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.comboT -= dt;
    if (p.comboT <= 0) p.combo = 0;
    const inp = p.input;
    p.firing = false;

    if (p.state === 'dead') {
      p.respawnT -= dt;
      if (p.respawnT <= 0 && !this.opts.solo) this.becomeChicken(p, true);
      return;
    }
    if (p.state === 'downed') {
      p.downT -= dt * (p.reviveT > 0 ? 0.25 : 1);
      // crawl slowly
      this.acceptMove(p, inp.x, inp.y, dt, 50);
      // revive by nearby human holding interact
      const helper = this.players.find((q) => q !== p && q.state === 'alive' && q.input.interact && dist(q.x, q.y, p.x, p.y) < 70);
      if (helper) {
        p.reviveT += dt / PLAYER.reviveTime;
        if (p.reviveT >= 1) {
          p.state = 'alive'; p.hp = 45; p.reviveT = 0;
          this.emit({ e: 'revived', id: p.id, by: helper.id });
          this.say(p.id, this.rng.pick(['Спасибо! Я уже чувствовал перья!', 'Фух… кукаре… то есть спасибо!', 'Я снова человек!']));
        }
      } else p.reviveT = Math.max(0, p.reviveT - dt * 0.5);
      if (p.downT <= 0) this.becomeChicken(p, false);
      return;
    }

    const def0 = WEAPONS[p.weapons[p.cur]];
    const speed = (p.state === 'chicken' ? PLAYER.chickenSpeed : PLAYER.speed) * def0.speedMul;
    this.acceptMove(p, inp.x, inp.y, dt, speed);
    p.aim = inp.aim;

    // weapon switch
    if (inp.weapon >= 0 && inp.weapon < p.weapons.length && inp.weapon !== p.cur) {
      p.cur = inp.weapon; p.reloadT = 0; p.fireCd = Math.max(p.fireCd, 0.12); p.bloom = 0;
    }
    const w = p.weapons[p.cur];
    const def = WEAPONS[w];
    const ammo = p.ammo[w] ?? (p.ammo[w] = { mag: def.mag, reserve: def.reserveMax });
    p.fireCd -= dt;
    p.bloom = Math.max(0, p.bloom - dt * 0.35);

    // reload
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const need = def.mag - ammo.mag;
        const take = ammo.reserve < 0 ? need : Math.min(need, ammo.reserve);
        ammo.mag += take;
        if (ammo.reserve >= 0) ammo.reserve -= take;
      }
    } else if ((inp.reload && ammo.mag < def.mag && ammo.reserve !== 0) || (ammo.mag === 0 && ammo.reserve !== 0)) {
      p.reloadT = def.reload;
      this.emit({ e: 'reload', id: p.id, w });
    }
    inp.reload = false;

    // fire
    if (inp.fire && p.reloadT <= 0 && ammo.mag > 0) {
      let guard = 0;
      while (p.fireCd <= 0 && ammo.mag > 0 && guard++ < 4) {
        this.fire(p, w);
        if (def.fuel) ammo.mag = Math.max(0, ammo.mag - 1); else ammo.mag--;
        p.fireCd += 1 / def.rof;
        p.firing = true;
      }
      if (p.fireCd > 0) p.firing = true;
    }
    if (p.fireCd < 0) p.fireCd = 0;

    // interact with NPCs (toggle follow), locked doors, use-objects
    if (inp.interact && p.state === 'alive') this.interact(p);

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
    for (const n of this.npcs) {
      if (n.mode === 'dead' || n.mode === 'gone' || dist(n.x, n.y, p.x, p.y) > 80) continue;
      this.interactCd.set(p.id, this.time);
      const r = this.script.onNpcUse?.(this, n, p);
      if (r === true) return;
      if (n.mode === 'follow' && n.follow === p.id) {
        n.mode = 'guard'; n.follow = null;
        this.say(n.id, n.weapon ? 'Держу позицию!' : 'Подожду здесь. Только недолго!');
      } else if (n.rescued || n.weapon) {
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

  private becomeChicken(p: Player, respawn: boolean) {
    if (this.opts.solo) {
      p.state = 'dead';
      this.gameOver('Вы превратились в курицу.');
      return;
    }
    if (!respawn) {
      p.saved = { weapons: [...p.weapons], ammo: JSON.parse(JSON.stringify(p.ammo)) };
      this.emit({ e: 'chicken', id: p.id });
      this.msg(`${p.name} превратился в курицу!`, 'Теперь он охотится на вас', 3);
    }
    p.state = 'chicken';
    p.hp = p.maxHp = PLAYER.chickenHp;
    p.armor = 0;
    const w = this.rng.pick<WeaponId>(['smg', 'shotgun', 'rifle']);
    p.weapons = [w];
    p.ammo = { [w]: { mag: WEAPONS[w].mag, reserve: -1 } };
    p.cur = 0; p.reloadT = 0;
    // spawn far away from humans
    const humans = [...this.players.filter((q) => q.state === 'alive'), ...this.npcs.filter((n) => n.mode !== 'dead' && n.mode !== 'gone')];
    const cand = this.map.objects.filter((o) => o.type === 'spawner' || o.type === 'enemy' || o.type === 'chickenspawn');
    let best: { x: number; y: number } = p, bestScore = -1;
    for (const c of cand) {
      const dmin = humans.length ? Math.min(...humans.map((h) => dist(h.x, h.y, c.cx, c.cy))) : 1000;
      const score = dmin > 650 ? 3000 - Math.abs(dmin - 1000) : dmin;
      if (score > bestScore) { bestScore = score; best = { x: c.cx, y: c.cy }; }
    }
    p.x = best.x; p.y = best.y; p.input.x = p.x; p.input.y = p.y;
    p.tp++;
  }

  cure(p: Player) {
    const saved = p.saved;
    p.state = 'alive'; p.hp = p.maxHp = PLAYER.hp; p.downT = 0; p.reviveT = 0;
    if (saved) { p.weapons = saved.weapons; p.ammo = saved.ammo; } else { p.weapons = ['pistol']; p.ammo = { pistol: { mag: 12, reserve: -1 } }; }
    p.cur = Math.min(p.cur, p.weapons.length - 1);
    this.emit({ e: 'cured', id: p.id });
  }

  damagePlayer(p: Player, dmg: number, fx: number, fy: number) {
    if (p.state !== 'alive' && p.state !== 'chicken') return;
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
    if (this.players.every((p) => p.state !== 'alive' && p.state !== 'downed')) {
      this.gameOver('Курицы победили. Все сотрудники оптимизированы.');
    }
  }

  // ------------------------------------------------------------------ shooting
  /** Entities that `team` can hit. */
  private victims(team: Team) {
    const list: { kind: 'enemy' | 'player' | 'npc' | 'barrel' | 'pod'; ref: any; x: number; y: number; r: number }[] = [];
    if (team === 'human') {
      for (const e of this.enemies) if (e.state !== 'rise') list.push({ kind: 'enemy', ref: e, x: e.x, y: e.y, r: ENEMIES[e.type].radius + 3 });
      for (const p of this.players) if (p.state === 'chicken') list.push({ kind: 'player', ref: p, x: p.x, y: p.y, r: HUMAN_R + 4 });
    } else {
      for (const p of this.players) if (p.state === 'alive') list.push({ kind: 'player', ref: p, x: p.x, y: p.y, r: HUMAN_R + 2 });
      for (const n of this.npcs) if (n.mode !== 'dead' && n.mode !== 'gone') list.push({ kind: 'npc', ref: n, x: n.x, y: n.y, r: HUMAN_R + 2 });
    }
    for (const b of this.barrels) list.push({ kind: 'barrel', ref: b, x: b.x, y: b.y, r: 18 });
    if (team === 'human') for (const p of this.pods) if (!p.broken) list.push({ kind: 'pod', ref: p, x: p.x, y: p.y, r: 22 });
    return list;
  }

  fire(p: Player, w: WeaponId) { this.fireFrom(p.id, p.state === 'chicken' ? 'chicken' : 'human', w, p.x, p.y, p.aim, p, 1); }

  /** Shared by players and armed NPCs. */
  fireFrom(owner: string, team: Team, w: WeaponId, x: number, y: number, aim: number, p: Player | null, dmgMul: number) {
    const def = WEAPONS[w];
    const bloom = p ? p.bloom : 0.02;
    if (p) p.bloom = Math.min(def.maxBloom, p.bloom + def.bloom);
    this.noise(x, y, 750);
    if (def.kind === 'grenade') {
      const a = aim + this.rng.range(-def.spread, def.spread);
      const sp = def.projSpeed!;
      const pr = this.addProjectile('grenade', x + Math.cos(a) * 30, y + Math.sin(a) * 30, Math.cos(a) * sp, Math.sin(a) * sp, owner, team, def.damage, 1.1);
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
      const hits: { t: number; v: (typeof victims)[number] }[] = [];
      for (const v of victims) {
        // quick reject
        const px = v.x - x, py = v.y - y;
        const along = px * dx + py * dy;
        if (along < -v.r || along > wall.d + v.r) continue;
        const t = rayCircle(x, y, dx, dy, v.x, v.y, v.r);
        if (t >= 0 && t <= wall.d) hits.push({ t, v });
      }
      hits.sort((a1, b1) => a1.t - b1.t);
      let endT = wall.d;
      let pierce = def.pierce;
      let dmg = def.damage * dmgMul;
      for (const h of hits) {
        this.applyHit(h.v, dmg, a, def.knockback, owner, x + dx * h.t, y + dy * h.t);
        if (h.v.kind === 'barrel' || h.v.kind === 'pod') { endT = h.t; break; }
        if (pierce-- <= 0) { endT = h.t; break; }
        dmg *= 0.7;
      }
      if (endT === wall.d && wall.what !== 'none') {
        this.emit({ e: 'hit', x: x + dx * wall.d, y: y + dy * wall.d, a: Math.atan2(wall.ny, wall.nx), k: wall.what === 'wall' ? 'wall' : 'prop', d: 0 });
      }
      ends.push(Math.round(x + dx * endT), Math.round(y + dy * endT));
    }
    this.emit({ e: 'shot', o: owner, w, x: Math.round(x), y: Math.round(y), a: aim, ends, team });
  }

  private applyHit(v: { kind: string; ref: any }, dmg: number, a: number, knock: number, owner: string, hx: number, hy: number) {
    if (v.kind === 'enemy') this.damageEnemy(v.ref, dmg, a, knock, owner, 'bullet', hx, hy);
    else if (v.kind === 'barrel') this.damageBarrel(v.ref, dmg, owner);
    else if (v.kind === 'pod') { this.emit({ e: 'hit', x: hx, y: hy, a, k: 'prop', d: dmg }); this.damagePod(v.ref, dmg); }
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

  damageEnemy(e: Enemy, dmg: number, a: number, knock: number, by: string, kind: 'bullet' | 'explosion' | 'fire' | 'melee', hx = e.x, hy = e.y) {
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
      this.emit({ e: 'hit', x: Math.round(hx), y: Math.round(hy), a, k: armored ? 'armor' : 'flesh', d: Math.round(dmg), id: e.id, big: kind === 'explosion', o: by });
    }
    if (e.hp <= 0) this.killEnemy(e, a, by, kind === 'explosion' || dmg > 60, kind === 'fire');
  }

  killEnemy(e: Enemy, a: number, by: string, gib: boolean, burn: boolean) {
    const idx = this.enemies.indexOf(e);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);
    const tag = this.enemyTags.get(e.id);
    this.enemyTags.delete(e.id);
    this.emit({ e: 'kill', id: e.id, x: Math.round(e.x), y: Math.round(e.y), a, t: e.type, v: e.variant, gib, by, burn });
    const p = this.players.find((q) => q.id === by);
    if (p) {
      p.kills++;
      p.combo++; p.comboT = 2.2;
      p.score += ENEMIES[e.type].score * (1 + Math.min(p.combo, 50) * 0.05);
    }
    // drops
    const r = this.rng.next();
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
    if (n.mode === 'dead' || n.mode === 'gone') return;
    n.hp -= dmg;
    n.hurtT = 0.2;
    if (n.hp <= 0) {
      n.mode = 'dead';
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
  private updatePickups(dt: number) {
    for (const k of [...this.pickups]) {
      if (k.ttl > 0) { k.ttl -= dt; if (k.ttl <= 0) { this.pickups.splice(this.pickups.indexOf(k), 1); continue; } }
      for (const p of this.players) {
        if (p.state !== 'alive' || dist2(p.x, p.y, k.x, k.y) > 34 * 34) continue;
        if (this.tryPickup(p, k)) { this.pickups.splice(this.pickups.indexOf(k), 1); break; }
      }
    }
  }

  private tryPickup(p: Player, k: Pickup) {
    let text = '';
    switch (k.kind) {
      case 'health':
        if (p.hp >= p.maxHp) return false;
        p.hp = Math.min(p.maxHp, p.hp + 35); text = '+35 здоровья';
        break;
      case 'armor':
        if (p.armor >= 100) return false;
        p.armor = Math.min(100, p.armor + 50); text = '+50 брони';
        break;
      case 'ammo': {
        let any = false;
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

  view(): WorldView { return this; }
}

function inRect(x: number, y: number, o: MapObject) { return x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h; }

export function keyName(k: string) {
  return ({ red: 'красный', blue: 'синий', yellow: 'жёлтый', lab: 'лаборатории', ceo: 'гендиректора', server: 'серверной' } as Record<string, string>)[k] ?? k;
}

export { TILE };
