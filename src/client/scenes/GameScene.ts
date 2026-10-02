import Phaser from 'phaser';
import { Fx } from '../render/Fx';
import { Lighting } from '../render/Lighting';
import { EnemyView, NpcView, PlayerView, muzzleOf, ejectOf } from '../render/Actors';
import { Input } from '../input/Input';
import { Hud } from '../ui/Hud';
import { sfx } from '../audio/Sfx';
import type { Session } from '../net/Session';
import { WEAPONS, WeaponId } from '../../shared/weapons';
import { ENEMIES, PLAYER } from '../../shared/enemies';
import { propDef } from '../../shared/props';
import { angleDiff, clamp, dist, lerp } from '../../shared/math';
import type { Player, SimEvent } from '../../shared/sim/types';
import { TILE } from '../../shared/map';
import { settings, TEXT_RES } from '../settings';

export interface GameSceneData { session: Session; onEnd: (ev: { kind: 'level' | 'gameover' | 'quit'; next?: string; win?: boolean; reason?: string }) => void }

const SHOT_SOUND: Record<WeaponId, string> = { pistol: 'pistol', smg: 'smg', rifle: 'rifle', shotgun: 'shotgun', machinegun: 'machinegun', grenade: 'grenade_launch', flamethrower: 'flame' };
const SHAKE: Record<WeaponId, number> = { pistol: 0.13, smg: 0.055, rifle: 0.11, shotgun: 0.42, machinegun: 0.1, grenade: 0.3, flamethrower: 0.02 };
const KICK: Record<WeaponId, number> = { pistol: 3, smg: 2, rifle: 3.5, shotgun: 10, machinegun: 3.5, grenade: 8, flamethrower: 0.5 };

interface Bubble { text: Phaser.GameObjects.Text; who: string; t: number; d: number }

export class GameScene extends Phaser.Scene {
  session!: Session;
  onEnd!: GameSceneData['onEnd'];
  fx!: Fx;
  lighting!: Lighting;
  input2!: Input;
  hud!: Hud;
  players = new Map<string, PlayerView>();
  enemies = new Map<number, EnemyView>();
  npcs = new Map<string, NpcView>();
  pickups = new Map<number, Phaser.GameObjects.Image>();
  pickupGlows = new Map<number, Phaser.GameObjects.Image>();
  projs = new Map<number, Phaser.GameObjects.Image>();
  doors = new Map<string, Phaser.GameObjects.Image>();
  barrels = new Map<number, Phaser.GameObjects.Image>();
  pods = new Map<number, { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; broken: boolean }>();
  bubbles: Bubble[] = [];
  notes: { x: number; y: number; text: string }[] = [];
  px = 0; py = 0; aim = 0;
  lastTp = -1;
  seq = 0;
  desiredWeapon = 0;
  camX = 0; camY = 0;
  baseZoom = 1;
  ended = false;
  paused = false;
  time0 = 0;
  lastSwingSnd = 0;
  autoTarget: number | null = null;
  crosshair: Phaser.GameObjects.Image | null = null;
  hitMarker = 0;
  hitstop = 0;

  constructor() { super('game'); }

  init(data: GameSceneData) {
    this.session = data.session;
    this.onEnd = data.onEnd;
    this.players = new Map(); this.enemies = new Map(); this.npcs = new Map(); this.pickups = new Map(); this.pickupGlows = new Map();
    this.projs = new Map(); this.doors = new Map(); this.barrels = new Map(); this.pods = new Map(); this.bubbles = []; this.notes = [];
    this.ended = false; this.paused = false; this.lastTp = -1;
  }

  create() {
    const s = this.session;
    const map = s.map;
    this.cameras.main.setBackgroundColor('#17191d').setBounds(-96, -96, map.pw + 192, map.ph + 192);
    // ---- tilemap
    const tm = this.make.tilemap({ key: 'map_' + s.levelId });
    const kt = tm.addTilesetImage('kenney', 'tiles', TILE, TILE, 0, 0)!;
    const wt = tm.addTilesetImage('walls', 'walls', TILE, TILE, 0, 0)!;
    tm.createLayer('floor', [kt], 0, 0)!.setDepth(0);
    tm.createLayer('decor', [kt], 0, 0)!.setDepth(1);
    const walls = tm.createLayer('walls', [wt], 0, 0)!.setDepth(14);
    // soft drop shadow of the walls onto the floor
    const shadow = tm.createBlankLayer('wall_shadow', [wt], 7, 9)!.setDepth(3.5).setAlpha(0.3);
    walls.forEachTile((t) => { if (t.index > 0) shadow.putTileAt(t.index, t.x, t.y).tint = 0x000000; });

    // ---- props, labels, notes
    for (const o of map.objects) {
      if (o.type === 'prop') {
        const def = propDef(o.name);
        const img = this.add.image(o.cx, o.cy, 'props', o.name).setRotation((o.rot * Math.PI) / 180).setDepth(def.top ? 16 : 4);
        if (o.props.tint) img.setTint(parseInt(String(o.props.tint), 16));
        if (o.props.text) this.notes.push({ x: o.cx, y: o.cy, text: String(o.props.text) });
      } else if (o.type === 'label') {
        this.add.text(o.cx, o.cy, String(o.props.text ?? o.name), {
          fontFamily: 'Russo One, sans-serif', fontSize: String(o.props.size ?? 22) + 'px', color: String(o.props.color ?? '#ffffff'),
        }).setOrigin(0.5).setAlpha(Number(o.props.alpha ?? 0.32)).setDepth(2).setRotation(Number(o.props.angle ?? 0) * Math.PI / 180).setResolution(TEXT_RES());
      } else if (o.type === 'note') {
        this.notes.push({ x: o.cx, y: o.cy, text: String(o.props.text ?? '') });
      }
    }

    this.fx = new Fx(this, map.pw, map.ph);
    this.fx.map = map;
    this.fx.shakeScale = settings.shake;
    this.lighting = new Lighting(this, map);
    this.input2 = new Input(this);
    this.hud = new Hud();
    for (const k of Object.keys(this.textures.get('chars').frames)) if (k.startsWith('w_')) this.hud.icons[k] = this.textures.getBase64('chars', k);
    this.hud.objective(s.view.objective);
    if (!this.input2.touch) {
      this.crosshair = this.add.image(0, 0, 'fx', 'crosshair').setDepth(45);
      document.getElementById('game')!.classList.add('ingame');
    }

    const me = s.view.players.find((p) => p.id === s.myId);
    if (me) { this.px = me.x; this.py = me.y; this.lastTp = me.tp; this.camX = me.x; this.camY = me.y; this.desiredWeapon = me.cur; }
    this.scale.on('resize', this.onResize, this);
    this.onResize();
    this.events.once('shutdown', () => this.cleanup());
    this.time0 = this.time.now;
    sfx.resume();
  }

  private onResize() {
    const cam = this.cameras.main;
    const dpr = (this.game as any).dprScale ?? 1;
    const h = this.scale.height / dpr, w = this.scale.width / dpr;
    const touch = this.input2?.touch;
    // show roughly 13 tiles vertically on desktop, a bit more on phones
    const tilesV = touch ? 8.5 : 10;
    this.baseZoom = clamp(Math.min(h / (tilesV * TILE), w / (tilesV * 1.5 * TILE)), 0.42, 2.2) * dpr;
    cam.setZoom(this.baseZoom);
  }

  private cleanup() {
    this.input2?.destroy();
    document.getElementById('game')!.classList.remove('ingame');
    this.crosshair = null;
    this.hud?.destroy();
    this.scale.off('resize', this.onResize, this);
    sfx.loop('flame_me', 'flame', false);
    sfx.loop('alarm', 'alarm', false);
    this.session.dispose();
  }

  // ------------------------------------------------------------------ main loop
  override update(_t: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05);
    const s = this.session;
    const inp = this.input2.poll();
    if (inp.pause && !this.ended) this.togglePause();
    if (this.paused) { this.input2.consume(); return; }
    // hit-stop (solo only): freeze the world for a few frames on heavy hits
    if (this.hitstop > 0 && s.solo) { this.hitstop -= dms; this.updateCamera(0, inp); this.input2.consume(); return; }
    const view0 = s.view;
    const me = view0.players.find((p) => p.id === s.myId);

    // ---- local prediction & input
    if (me) {
      if (me.tp !== this.lastTp) { this.lastTp = me.tp; this.px = me.x; this.py = me.y; }
      const w = me.weapons[me.cur] as WeaponId | undefined;
      const wdef = w ? WEAPONS[w] : WEAPONS.pistol;
      let speed = 0;
      if (me.state === 'alive') speed = PLAYER.speed * wdef.speedMul;
      else if (me.state === 'chicken') speed = PLAYER.chickenSpeed * wdef.speedMul;
      else if (me.state === 'downed') speed = 45;
      if (speed > 0) [this.px, this.py] = s.map.move(this.px, this.py, PLAYER.radius, inp.mx * speed * dt, inp.my * speed * dt);
      // server correction if we drift too far
      if (dist(this.px, this.py, me.x, me.y) > 160) { this.px = me.x; this.py = me.y; }

      let fire = inp.fire;
      if (inp.aimMode === 'mouse') this.aim = Math.atan2(inp.aimWY - this.py, inp.aimWX - this.px);
      else {
        // touch: right stick aims, auto-fire when a chicken is under the aim cone
        const target = this.findAutoTarget(inp.aimMode === 'stick' ? inp.stickA : this.aim, inp.aimMode === 'stick' ? 0.32 : Math.PI, me);
        if (inp.aimMode === 'stick' && inp.stickMag > 0.25) {
          let a = inp.stickA;
          if (target) a += clamp(angleDiff(a, target.a), -0.18, 0.18); // soft aim assist
          this.aim = a;
          fire = !!target && Math.abs(angleDiff(this.aim, target.a)) < 0.2;
          if (inp.stickMag > 0.92) fire = true; // full deflection = fire anyway
        } else if (Math.hypot(inp.mx, inp.my) > 0.2) this.aim = Math.atan2(inp.my, inp.mx);
      }
      if (inp.weaponDelta && me.weapons.length) this.desiredWeapon = (me.cur + inp.weaponDelta + me.weapons.length) % me.weapons.length;
      if (inp.weaponSlot >= 0 && inp.weaponSlot < me.weapons.length) this.desiredWeapon = inp.weaponSlot;
      if (this.desiredWeapon !== me.cur && (inp.weaponDelta || inp.weaponSlot >= 0)) sfx.play('switch', { vol: 0.6 });
      if (this.desiredWeapon >= me.weapons.length) this.desiredWeapon = me.cur;
      if (fire && w && (me.ammo[w]?.mag ?? 0) === 0 && (me.ammo[w]?.reserve ?? 0) === 0 && Math.random() < 0.08) sfx.play('empty', { vol: 0.5 });
      s.send({ seq: ++this.seq, x: this.px, y: this.py, aim: this.aim, fire, reload: inp.reload, interact: inp.interact, weapon: this.desiredWeapon });
      if (!s.solo) this.predictFire(dt, me, fire);
      sfx.loop('flame_me', 'flame', me.firing && w === 'flamethrower', 0.7);
    }

    // ---- simulation / network
    const events = s.poll(dt);
    for (const ev of events) this.handle(ev);

    // ---- sync views
    this.syncWorld(dt);

    // ---- camera
    this.updateCamera(dt, inp);
    sfx.listenerX = this.px; sfx.listenerY = this.py;

    // ---- fx / lighting
    this.fx.update(dt);
    const flashlights: { x: number; y: number; a: number }[] = [];
    if (this.lighting.ambient > 0.25) {
      for (const p of s.view.players) {
        if (p.state !== 'alive' && p.state !== 'downed') continue;
        const pv = this.players.get(p.id);
        if (pv) flashlights.push({ x: pv.dispX, y: pv.dispY, a: pv.dispA });
      }
    }
    this.lighting.update(this.cameras.main, dt, this.fx.lights, flashlights);

    // ---- hud
    const me2 = s.view.players.find((p) => p.id === s.myId);
    this.hud.update(dt, s.view, me2, s.solo);
    this.updateHints(me2);
    this.updateCrosshair(dt, inp, me2);
    this.updateBubbles(dt);
    this.input2.consume();
  }

  // ------------------------------------------------------------------ multiplayer: instant local shots
  localFiring = false;
  private predCd = 0;
  private predictFire(dt: number, me: Player, fire: boolean) {
    const w = me.weapons[me.cur] as WeaponId | undefined;
    this.predCd -= dt;
    const can = !!w && fire && (me.state === 'alive' || me.state === 'chicken') && me.reloadT <= 0 && (me.ammo[w]?.mag ?? 0) > 0 && me.cur === this.desiredWeapon;
    this.localFiring = can && w === 'flamethrower';
    if (!can || !w) { if (this.predCd < 0) this.predCd = 0; return; }
    const def = WEAPONS[w];
    let guard = 0;
    while (this.predCd <= 0 && guard++ < 4) {
      this.predCd += 1 / def.rof;
      if (def.kind === 'flame') continue;
      const ends: number[] = [];
      if (def.kind === 'hitscan') {
        for (let i = 0; i < def.pellets; i++) {
          const spread = def.spread + me.bloom;
          const a = this.aim + (def.pellets > 1 ? ((i + Math.random()) / def.pellets - 0.5) * 2 * spread : (Math.random() * 2 - 1) * spread);
          const wall = this.session.map.raycast(this.px, this.py, a, def.range, true);
          let d = wall.d;
          const dx = Math.cos(a), dy = Math.sin(a);
          for (const e of this.session.view.enemies) {
            const r = ENEMIES[e.type].radius + 3;
            const ex = e.x - this.px, ey = e.y - this.py;
            const along = ex * dx + ey * dy;
            if (along < 0 || along > d) continue;
            if (Math.abs(ex * dy - ey * dx) < r) d = Math.max(0, along - r * 0.5);
          }
          ends.push(this.px + dx * d, this.py + dy * d);
        }
      }
      this.handle({ e: 'shot', o: '__local', w, x: this.px, y: this.py, a: this.aim, ends, team: me.state === 'chicken' ? 'chicken' : 'human' });
    }
  }

  private updateCrosshair(dt: number, inp: ReturnType<Input['poll']>, me: Player | undefined) {
    const c = this.crosshair;
    if (!c) return;
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    const w = me?.weapons[me.cur] as WeaponId | undefined;
    const d = dist(this.px, this.py, inp.aimWX, inp.aimWY);
    const spread = w ? WEAPONS[w].spread + (me?.bloom ?? 0) : 0.05;
    const sc = clamp(0.6 + (Math.tan(spread) * d) / 34, 0.65, 1.5);
    c.setPosition(inp.aimWX, inp.aimWY).setScale(sc / (this.cameras.main.zoom / ((this.game as any).dprScale ?? 1)) * (1 + this.hitMarker * 1.2));
    c.setTint(this.hitMarker > 0 ? 0xff4040 : 0xffffff).setRotation(this.hitMarker * 3);
    c.setVisible(!!me && (me.state === 'alive' || me.state === 'chicken'));
  }

  private findAutoTarget(a: number, cone: number, me: Player) {
    let best: { a: number; d: number } | null = null;
    const range = 650;
    for (const e of this.session.view.enemies) {
      if (e.state === 'rise') continue;
      const d = dist(this.px, this.py, e.x, e.y);
      if (d > range) continue;
      const ea = Math.atan2(e.y - this.py, e.x - this.px);
      const da = Math.abs(angleDiff(a, ea));
      if (da > cone + Math.atan2(ENEMIES[e.type].radius, d)) continue;
      const score = d * (1 + da * 2);
      if (!best || score < best.d) {
        if (!this.session.map.lineOfSight(this.px, this.py, e.x, e.y, true)) continue;
        best = { a: ea, d: score };
      }
    }
    if (me.state === 'chicken') {
      for (const p of this.session.view.players) {
        if (p.state !== 'alive') continue;
        const d = dist(this.px, this.py, p.x, p.y);
        const ea = Math.atan2(p.y - this.py, p.x - this.px);
        if (d < range && Math.abs(angleDiff(a, ea)) < cone && (!best || d < best.d)) best = { a: ea, d };
      }
    }
    return best;
  }

  private updateCamera(dt: number, inp: ReturnType<Input['poll']>) {
    const cam = this.cameras.main;
    // look ahead towards aim
    const lead = inp.aimMode === 'mouse'
      ? Math.min(220, dist(this.px, this.py, inp.aimWX, inp.aimWY) * 0.28)
      : inp.aimMode === 'stick' ? 110 : 40;
    const tx = this.px + Math.cos(this.aim) * lead, ty = this.py + Math.sin(this.aim) * lead;
    const k = 1 - Math.exp(-dt * 7);
    this.camX = lerp(this.camX, tx, k); this.camY = lerp(this.camY, ty, k);
    const tr = this.fx.trauma * this.fx.trauma;
    const t = this.time.now / 1000;
    const sx = tr * 22 * (Math.sin(t * 61) + Math.sin(t * 37.3) * 0.5);
    const sy = tr * 22 * (Math.sin(t * 53.7) + Math.sin(t * 29.1) * 0.5);
    cam.setRotation(tr * 0.03 * Math.sin(t * 41));
    cam.centerOn(this.camX + sx + this.fx.kickX, this.camY + sy + this.fx.kickY);
    cam.setZoom(this.baseZoom * (1 - tr * 0.02));
  }

  // ------------------------------------------------------------------ world sync
  private syncWorld(dt: number) {
    const s = this.session, v = s.view;
    const time = (this.time.now - this.time0) / 1000;
    // players
    const seenP = new Set<string>();
    for (const p of v.players) {
      seenP.add(p.id);
      let pv = this.players.get(p.id);
      if (!pv) { pv = new PlayerView(this, p, !s.solo); this.players.set(p.id, pv); }
      const mine = p.id === s.myId;
      pv.sync(p, mine ? this.px : p.x, mine ? this.py : p.y, mine ? this.aim : p.aim, dt, time);
      const w = p.weapons[p.cur];
      const firing = mine && !s.solo ? this.localFiring : p.firing;
      if (firing && w === 'flamethrower' && (p.state === 'alive' || p.state === 'chicken')) {
        const m = muzzleOf(pv.dispX, pv.dispY, pv.dispA, w);
        this.fx.flame(m.x, m.y, pv.dispA, dt);
        if (!mine) sfx.play('flame', { x: m.x, y: m.y, vol: 0.4, max: 2 });
      }
    }
    for (const [id, pv] of this.players) if (!seenP.has(id)) { pv.destroy(); this.players.delete(id); }

    // enemies
    const seenE = new Set<number>();
    for (const e of v.enemies) {
      seenE.add(e.id);
      let ev = this.enemies.get(e.id);
      if (!ev) { ev = new EnemyView(this, e); this.enemies.set(e.id, ev); }
      ev.sync(e, e.x, e.y, dt, time);
      if (e.burnT > 0) this.fx.burning(e.x, e.y, dt, e.type === 'boss' ? 3 : e.type === 'fat' ? 1.4 : 1);
    }
    for (const [id, ev] of this.enemies) if (!seenE.has(id)) { ev.destroy(); this.enemies.delete(id); }

    // npcs
    for (const n of v.npcs) {
      let nv = this.npcs.get(n.id);
      if (!nv) { nv = new NpcView(this, n); this.npcs.set(n.id, nv); }
      nv.sync(n, n.x, n.y, dt, time, dist(n.x, n.y, this.px, this.py) < 260);
    }

    // pickups
    const seenK = new Set<number>();
    for (const k of v.pickups) {
      seenK.add(k.id);
      let img = this.pickups.get(k.id);
      if (!img) {
        const frame = k.kind === 'weapon' ? 'w_' + k.weapon : 'pk_' + k.kind;
        img = this.add.image(k.x, k.y, 'chars', frame).setDepth(7).setScale(k.kind === 'weapon' ? 1.25 : 1.1);
        const tint = k.kind === 'health' ? 0xff5a5a : k.kind === 'armor' ? 0x5ab0ff : k.kind === 'weapon' ? 0xffd27a : k.kind === 'keycard' ? 0xffe14a : 0x9cff7a;
        const glow = this.add.image(k.x, k.y, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(6).setScale(0.8).setAlpha(0.5);
        this.pickups.set(k.id, img); this.pickupGlows.set(k.id, glow);
      }
      const ph = time * 3 + k.id;
      img.setPosition(k.x, k.y + Math.sin(ph) * 2.5).setRotation(k.kind === 'weapon' ? -0.3 + Math.sin(ph * 0.5) * 0.1 : 0);
      if (k.ttl > 0 && k.ttl < 4) img.setAlpha(Math.sin(time * 18) > 0 ? 1 : 0.3);
      this.pickupGlows.get(k.id)!.setAlpha(0.35 + Math.sin(ph) * 0.15);
    }
    for (const [id, img] of this.pickups) if (!seenK.has(id)) { img.destroy(); this.pickupGlows.get(id)?.destroy(); this.pickups.delete(id); this.pickupGlows.delete(id); }

    // projectiles
    const seenR = new Set<number>();
    for (const pr of v.projectiles) {
      seenR.add(pr.id);
      let img = this.projs.get(pr.id);
      if (!img) {
        const tex = pr.kind === 'egg' ? 'chars' : 'fx';
        const frame = pr.kind === 'grenade' ? 'grenade' : pr.kind === 'spit' ? 'spit' : 'egg';
        img = this.add.image(pr.x, pr.y, tex, frame).setDepth(12).setScale(pr.kind === 'spit' ? 1.3 : 1);
        this.projs.set(pr.id, img);
      }
      img.setPosition(pr.x, pr.y).setRotation(img.rotation + dt * (pr.kind === 'spit' ? 0 : 14));
      if (pr.kind === 'grenade') {
        this.fx.high.emit({ frame: 'smoke', x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.5, s0: 0.15, s1: 0.5, a0: 0.4, a1: 0, tint: 0xcccccc, rot: Math.random() * 6 });
        this.fx.high.emit({ frame: 'glow', x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.04, s0: 0.4, s1: 0.4, a0: 0.6, a1: 0, tint: 0xffa040, add: true });
      } else if (pr.kind === 'spit') {
        this.fx.high.emit({ frame: 'blood_drop', x: pr.x, y: pr.y, vx: -pr.vx * 0.1, vy: -pr.vy * 0.1, life: 0.25, s0: 0.8, s1: 0.2, a0: 0.8, a1: 0, tint: 0x9be22e });
        this.fx.light(pr.x, pr.y, 120, 0x9be22e, 0.6, 0.05);
      }
    }
    for (const [id, img] of this.projs) if (!seenR.has(id)) { img.destroy(); this.projs.delete(id); }

    // doors
    for (const d of v.doors) {
      let img = this.doors.get(d.id);
      const horiz = d.w >= d.h;
      if (!img) {
        const frame = d.locked && d.locked !== '' ? 'door_locked' : 'door_' + d.theme;
        img = this.add.image(horiz ? d.x : d.x + d.w / 2, horiz ? d.y + d.h / 2 : d.y, 'props', frame).setOrigin(0, 0.5).setDepth(13);
        img.setRotation(horiz ? 0 : Math.PI / 2);
        img.setDisplaySize(horiz ? d.w : d.h, 16);
        (img as any).full = img.scaleX;
        this.doors.set(d.id, img);
      }
      const full = (img as any).full as number;
      const target = d.open ? full * 0.08 : full;
      img.scaleX = lerp(img.scaleX, target, Math.min(1, dt * 12));
      const frame = d.locked && d.locked !== '' ? 'door_locked' : 'door_' + d.theme;
      if (img.frame.name !== frame) { img.setFrame(frame); }
    }

    // barrels
    const seenB = new Set<number>();
    for (const b of v.barrels) {
      seenB.add(b.id);
      if (!this.barrels.has(b.id)) this.barrels.set(b.id, this.add.image(b.x, b.y, 'props', 'barrel').setDepth(8).setTint(0xff7a5a));
    }
    for (const [id, img] of this.barrels) if (!seenB.has(id)) { img.destroy(); this.barrels.delete(id); }

    // incubator pods
    for (const p of v.pods) {
      let pv = this.pods.get(p.id);
      if (!pv) {
        const img = this.add.image(p.x, p.y, 'props', p.broken ? 'egg_pod_broken' : 'egg_pod').setDepth(8);
        const glow = this.add.image(p.x, p.y, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7dff8a).setDepth(19).setScale(1.3).setAlpha(0.4);
        pv = { img, glow, broken: p.broken };
        this.pods.set(p.id, pv);
      }
      if (p.broken !== pv.broken) { pv.broken = p.broken; pv.img.setFrame(p.broken ? 'egg_pod_broken' : 'egg_pod'); }
      pv.glow.setVisible(!p.broken).setAlpha(0.3 + Math.sin(time * 2 + p.id) * 0.1);
      if (!p.broken) this.fx.light(p.x, p.y, 150, 0x7dff8a, 0.6, 0.02);
    }
  }

  // ------------------------------------------------------------------ events
  private shooterPose(owner: string): { x: number; y: number; a: number; mine: boolean; view?: PlayerView; npc?: NpcView } | null {
    const pv = this.players.get(owner === '__local' ? this.session.myId : owner);
    if (pv && owner === '__local') return { x: pv.dispX, y: pv.dispY, a: pv.dispA, mine: true, view: pv };
    if (pv) return { x: pv.dispX, y: pv.dispY, a: pv.dispA, mine: owner === this.session.myId, view: pv };
    const nv = this.npcs.get(owner);
    const n = this.session.view.npcs.find((q) => q.id === owner);
    if (nv && n) return { x: n.x, y: n.y, a: n.angle, mine: false, npc: nv };
    return null;
  }

  private handle(ev: SimEvent) {
    const fx = this.fx;
    switch (ev.e) {
      case 'shot': {
        if (!this.session.solo && ev.o === this.session.myId) break; // already predicted locally
        const pose = this.shooterPose(ev.o);
        const sx = pose?.x ?? ev.x, sy = pose?.y ?? ev.y;
        const a = pose?.mine ? this.aim : ev.a;
        const m = muzzleOf(sx, sy, a, ev.w);
        const ej = ejectOf(sx, sy, a);
        const def = WEAPONS[ev.w];
        if (ev.w === 'flamethrower') {
          if (!pose?.view) { fx.flame(m.x, m.y, a, 0.09); sfx.play('flame', { x: m.x, y: m.y, vol: 0.4, max: 2 }); }
          break;
        }
        fx.muzzle(ev.w, m.x, m.y, a, 0, 0, ej.x, ej.y);
        for (let i = 0; i < ev.ends.length; i += 2) {
          const ex = ev.ends[i], ey = ev.ends[i + 1];
          if (def.tracer) {
            const pellet = def.pellets > 1;
            fx.tracer(m.x, m.y, ex, ey, ev.team === 'chicken' ? 0xff8a8a : def.tracer, def.tracerWidth * (pellet ? 1 : 1.2), pellet ? 3200 : 4200, pellet ? 70 : ev.w === 'machinegun' ? 150 : 110);
          }
        }
        const rig = pose?.view?.rig ?? pose?.npc?.rig;
        if (rig) rig.recoil = def.recoil;
        sfx.play(SHOT_SOUND[ev.w], { x: m.x, y: m.y, vol: pose?.mine ? 0.9 : 0.7, max: ev.w === 'smg' || ev.w === 'machinegun' ? 8 : 5 });
        if (ev.w === 'shotgun') setTimeout(() => sfx.play('pump', { x: m.x, y: m.y, vol: 0.6 }), 280);
        if (pose?.mine) { fx.shake(SHAKE[ev.w]); fx.kick(a, KICK[ev.w]); }
        else fx.shake(SHAKE[ev.w] * 0.15 * clamp(1 - dist(sx, sy, this.px, this.py) / 900, 0, 1));
        break;
      }
      case 'hit': {
        let tint = 0xffffff;
        if (typeof ev.id === 'number') {
          const evw = this.enemies.get(ev.id);
          evw?.hit();
          const e = this.session.view.enemies.find((q) => q.id === ev.id);
          if (e) tint = e.type === 'fast' || e.type === 'chick' ? 0xffe27a : e.type === 'spitter' ? 0xe3f5c8 : e.type === 'boss' ? 0xe8a24a : 0xffffff;
        }
        if (ev.o === this.session.myId) this.hitMarker = 0.12;
        if (ev.k === 'player' && ev.id === this.session.myId) break;
        fx.impact(ev.k, ev.x, ev.y, ev.a, tint, ev.big);
        break;
      }
      case 'kill': {
        if (ev.id === -1) { fx.kill('player', 0, ev.x, ev.y, ev.a, true, false); break; }
        const view = this.enemies.get(ev.id);
        const x = view?.dispX ?? ev.x, y = view?.dispY ?? ev.y;
        fx.kill(ev.t, ev.v, x, y, ev.a, ev.gib, ev.burn, ev.t === 'chick' ? 0.7 : 1);
        if (dist(x, y, this.px, this.py) < 700) fx.shake(ev.t === 'boss' ? 0.8 : ev.gib ? 0.12 : 0.05);
        if (ev.by === this.session.myId && (ev.gib || ev.t === 'fat' || ev.t === 'armored')) this.hitstop = Math.max(this.hitstop, ev.t === 'boss' ? 260 : 40);
        if (ev.t === 'boss') { this.hud.message('ГЕНЕРАЛЬНЫЙ ПЕТУХ ПОВЕРЖЕН', 'Корпорация переходит на удалёнку', 5); }
        break;
      }
      case 'boom': {
        fx.boom(ev.x, ev.y, ev.r, ev.k);
        const d = dist(ev.x, ev.y, this.px, this.py);
        fx.shake(clamp(0.75 - d / 1400, 0.05, 0.75));
        if (d < 900) this.hitstop = Math.max(this.hitstop, 55);
        break;
      }
      case 'proj':
        if (ev.k === 'spit') sfx.play('spit', { x: ev.x, y: ev.y, vol: 0.6 });
        break;
      case 'splat': fx.splat(ev.x, ev.y, ev.k); break;
      case 'say': this.say(ev.who, ev.text, ev.d); break;
      case 'pdmg':
        if (ev.id === this.session.myId) {
          this.hud.damage(ev.d);
          fx.shake(0.22);
          sfx.play('hurt', { vol: 0.8 });
          // physical push away from the hit
          const a = Math.atan2(this.py - ev.y, this.px - ev.x);
          [this.px, this.py] = this.session.map.move(this.px, this.py, PLAYER.radius, Math.cos(a) * 9, Math.sin(a) * 9);
          for (let i = 0; i < 6; i++) {
            const aa = a + (Math.random() - 0.5) * 1.4, sp = 100 + Math.random() * 250;
            fx.low.emit({ frame: 'blood_drop', x: this.px, y: this.py, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: 0.3, drag: 7, s0: 1, s1: 0.8, land: true });
          }
        }
        break;
      case 'pick':
        if (ev.id === this.session.myId) {
          this.hud.toast(ev.text);
          sfx.play(ev.k === 'weapon' ? 'weapon_pick' : 'pickup', { vol: 0.8 });
          if (ev.k === 'weapon' && ev.w) {
            const me = this.session.view.players.find((p) => p.id === this.session.myId);
            if (me) this.desiredWeapon = me.weapons.indexOf(ev.w);
          }
        }
        break;
      case 'reload':
        if (ev.id === this.session.myId) sfx.play('reload', { vol: 0.8, rate: ev.w === 'machinegun' ? 0.7 : 1 });
        break;
      case 'down':
        if (ev.id === this.session.myId) this.hud.message(this.session.solo ? 'ВАС ЗАКЛЕВАЛИ' : 'ВЫ РАНЕНЫ', this.session.solo ? '' : 'Попросите друга поднять вас (E)', 3);
        break;
      case 'revived': this.hud.toast('Игрок поднят!'); break;
      case 'chicken':
        if (ev.id === this.session.myId) this.hud.message('ВЫ ПРЕВРАТИЛИСЬ В КУРИЦУ', 'Новая задача: заклевать бывших коллег', 4);
        sfx.play('boss_roar', { vol: 0.5, rate: 1.6 });
        break;
      case 'cured': if (ev.id === this.session.myId) this.hud.message('АНТИДОТ!', 'Вы снова человек', 3); break;
      case 'npcdie':
        fx.kill('normal', 0, ev.x, ev.y, 0, false, false);
        this.hud.toast('Выживший погиб');
        break;
      case 'door': sfx.play('door', { x: this.doors.get(ev.id)?.x, y: this.doors.get(ev.id)?.y, vol: 0.5 }); break;
      case 'msg': this.hud.message(ev.text, ev.sub ?? '', ev.d ?? 3); break;
      case 'obj': this.hud.objective(ev.text); sfx.play('ui', { vol: 0.6 }); break;
      case 'spawn':
        fx.spawnPuff(ev.x, ev.y, ev.how);
        sfx.play('spawn', { x: ev.x, y: ev.y, vol: 0.5, max: 3 });
        break;
      case 'blackout':
        this.lighting.blackout = ev.on;
        sfx.play('explosion', { vol: 0.3, rate: 0.5 });
        break;
      case 'alarm':
        this.lighting.alarm = ev.on;
        sfx.loop('alarm', 'alarm', ev.on, 0.35);
        break;
      case 'shake': fx.shake(ev.s * 20); break;
      case 'swing': {
        const now = this.time.now;
        if (now - this.lastSwingSnd > 120) {
          this.lastSwingSnd = now;
          sfx.play(Math.random() < 0.5 ? 'squawk' : 'cluck', { x: ev.x, y: ev.y, vol: 0.55, max: 4, rate: 0.9 + Math.random() * 0.3 });
        }
        break;
      }
      case 'fuse': {
        const e = this.session.view.enemies.find((q) => q.id === ev.id);
        sfx.play(e?.type === 'boss' ? 'boss_roar' : 'fuse', { x: e?.x, y: e?.y, vol: 0.8 });
        break;
      }
      case 'level':
        if (!this.ended) { this.ended = true; this.time.delayedCall(1800, () => this.onEnd({ kind: 'level', next: ev.next, win: ev.win })); }
        break;
      case 'gameover':
        if (!this.ended) { this.ended = true; this.time.delayedCall(1500, () => this.onEnd({ kind: 'gameover', reason: ev.reason })); }
        break;
    }
  }

  // ------------------------------------------------------------------ speech bubbles & hints
  private say(who: string, text: string, d: number) {
    if (who === 'radio' || who === 'pa') { this.hud.radio(who === 'pa' ? 'ОПОВЕЩЕНИЕ' : 'РАЦИЯ', text, d); return; }
    const old = this.bubbles.find((b) => b.who === who);
    if (old) { old.text.destroy(); this.bubbles.splice(this.bubbles.indexOf(old), 1); }
    const t = this.add.text(0, 0, text, {
      fontFamily: 'Rubik, sans-serif', fontSize: '15px', fontStyle: '600', color: '#1d1f24',
      backgroundColor: '#fffdf6', padding: { x: 8, y: 5 }, wordWrap: { width: 260 }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(41).setResolution(TEXT_RES());
    this.bubbles.push({ text: t, who, t: 0, d });
  }

  private updateBubbles(dt: number) {
    const v = this.session.view;
    for (const b of [...this.bubbles]) {
      b.t += dt;
      if (b.t > b.d) { b.text.destroy(); this.bubbles.splice(this.bubbles.indexOf(b), 1); continue; }
      b.text.setAlpha(Math.min(1, b.t * 8, (b.d - b.t) * 4));
      let x = 0, y = 0, found = false;
      const pv = this.players.get(b.who);
      if (pv) { x = pv.dispX; y = pv.dispY; found = true; }
      const n = v.npcs.find((q) => q.id === b.who);
      if (n) { x = n.x; y = n.y; found = true; }
      const e = v.enemies.find((q) => String(q.id) === b.who);
      if (e) { x = e.x; y = e.y - ENEMIES[e.type].radius; found = true; }
      if (!found) { b.text.destroy(); this.bubbles.splice(this.bubbles.indexOf(b), 1); continue; }
      b.text.setPosition(x, y - 30 - b.t * 4);
    }
  }

  private updateHints(me: Player | undefined) {
    if (!me || me.state !== 'alive') { this.hud.hint(null); this.input2.showInteract(null); return; }
    const v = this.session.view;
    let hint: string | null = null;
    const key = this.input2.touch ? '' : 'E — ';
    for (const p of v.players) if (p.id !== me.id && p.state === 'downed' && dist(p.x, p.y, this.px, this.py) < 70) hint = `${key}держать: поднять ${p.name}`;
    if (!hint) for (const n of v.npcs) {
      if (n.mode === 'dead' || n.mode === 'gone' || dist(n.x, n.y, this.px, this.py) > 80) continue;
      if (n.mode === 'follow' && n.follow === me.id) hint = `${key}${n.name}: ждать здесь`;
      else if (n.rescued || n.weapon) hint = `${key}${n.name}: за мной`;
      else hint = `${key}поговорить`;
      break;
    }
    if (!hint) for (const o of this.session.map.objects) {
      if (o.type === 'use' && dist(o.cx, o.cy, this.px, this.py) < 90 && !(o.props.done && (v as any).flags?.[o.name])) { hint = key + String(o.props.hint ?? 'использовать'); break; }
    }
    if (!hint) for (const d of v.doors) {
      if (!d.open && d.locked && dist(d.x + d.w / 2, d.y + d.h / 2, this.px, this.py) < 115) { hint = key + (me.keys.includes(d.locked) ? 'открыть' : 'заперто'); break; }
    }
    let note: string | null = null;
    for (const n of this.notes) if (dist(n.x, n.y, this.px, this.py) < 95) { note = n.text; break; }
    this.hud.hint(hint ?? note);
    this.input2.showInteract(hint ? hint.replace(/^E — /, '').split(':')[0].slice(0, 14) : null);
  }

  togglePause() {
    this.paused = !this.paused;
    const el = document.querySelector('.pause-menu');
    if (this.paused && !el) {
      const d = document.createElement('div');
      d.className = 'overlay pause-menu';
      d.innerHTML = `<div class="panel"><h2>ПАУЗА</h2>
        <button class="btn primary" data-a="resume">Продолжить</button>
        <button class="btn" data-a="quit">В главное меню</button></div>`;
      d.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).dataset.a;
        if (a === 'resume') this.togglePause();
        if (a === 'quit') { d.remove(); this.ended = true; this.onEnd({ kind: 'quit' }); }
      });
      document.getElementById('ui')!.appendChild(d);
    } else if (!this.paused) el?.remove();
    if (this.session.solo) {
      // freeze local simulation while paused
      if (this.paused) this.time.timeScale = 0;
      else this.time.timeScale = 1;
    }
  }
}
